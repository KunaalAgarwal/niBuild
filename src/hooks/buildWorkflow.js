import YAML from 'js-yaml';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { computeScatteredNodes } from '../utils/scatterPropagation.js';

/**
 * Expand custom workflow nodes into their internal nodes/edges.
 * Rewrites external edges so their namespaced mappings (internalNodeId/ioName)
 * point to the correct expanded internal node with plain ioName.
 * Returns a flat graph with no custom workflow nodes.
 */
function expandCustomWorkflowNodes(graph) {
    const { nodes, edges } = graph;
    const customNodes = nodes.filter(n => n.data?.isCustomWorkflow);

    if (customNodes.length === 0) return graph;

    const customNodeIds = new Set(customNodes.map(n => n.id));
    const expandedNodes = [];
    const expandedEdges = [];

    // 1. Expand each custom workflow node into its internal nodes + edges
    for (const customNode of customNodes) {
        const { internalNodes = [], internalEdges = [] } = customNode.data;

        for (const iNode of internalNodes) {
            expandedNodes.push({
                id: `${customNode.id}__${iNode.id}`,
                type: 'default',
                data: {
                    label: iNode.label,
                    isDummy: iNode.isDummy || false,
                    parameters: iNode.parameters || {},
                    dockerVersion: iNode.dockerVersion || 'latest',
                    scatterEnabled: iNode.scatterEnabled || false,
                    linkMergeOverrides: iNode.linkMergeOverrides || {},
                    whenExpression: iNode.whenExpression || '',
                    expressions: iNode.expressions || {},
                },
                position: iNode.position || { x: 0, y: 0 },
            });
        }

        for (const iEdge of internalEdges) {
            expandedEdges.push({
                id: `${customNode.id}__${iEdge.id}`,
                source: `${customNode.id}__${iEdge.source}`,
                target: `${customNode.id}__${iEdge.target}`,
                data: iEdge.data ? structuredClone(iEdge.data) : {},
            });
        }
    }

    // 2. Keep non-custom nodes as-is
    const regularNodes = nodes.filter(n => !customNodeIds.has(n.id));

    // 3. Rewrite external edges that touch custom workflow nodes
    const rewrittenEdges = [];

    for (const edge of edges) {
        const srcIsCustom = customNodeIds.has(edge.source);
        const tgtIsCustom = customNodeIds.has(edge.target);

        if (!srcIsCustom && !tgtIsCustom) {
            rewrittenEdges.push(edge);
            continue;
        }

        const mappings = edge.data?.mappings || [];

        // Group mappings by (expandedSource, expandedTarget) pair
        // since one external edge can map to multiple internal nodes
        const edgeGroups = new Map();

        for (const m of mappings) {
            let newSource = edge.source;
            let newSourceOutput = m.sourceOutput;
            let newTarget = edge.target;
            let newTargetInput = m.targetInput;

            if (srcIsCustom) {
                const slashIdx = m.sourceOutput.indexOf('/');
                if (slashIdx > -1) {
                    const internalNodeId = m.sourceOutput.substring(0, slashIdx);
                    newSourceOutput = m.sourceOutput.substring(slashIdx + 1);
                    newSource = `${edge.source}__${internalNodeId}`;
                }
            }

            if (tgtIsCustom) {
                const slashIdx = m.targetInput.indexOf('/');
                if (slashIdx > -1) {
                    const internalNodeId = m.targetInput.substring(0, slashIdx);
                    newTargetInput = m.targetInput.substring(slashIdx + 1);
                    newTarget = `${edge.target}__${internalNodeId}`;
                }
            }

            const key = `${newSource}::${newTarget}`;
            if (!edgeGroups.has(key)) {
                edgeGroups.set(key, { source: newSource, target: newTarget, mappings: [] });
            }
            edgeGroups.get(key).mappings.push({
                sourceOutput: newSourceOutput,
                targetInput: newTargetInput,
            });
        }

        for (const [key, group] of edgeGroups) {
            rewrittenEdges.push({
                id: `${edge.id}__${key}`,
                source: group.source,
                target: group.target,
                data: { mappings: group.mappings },
            });
        }
    }

    return {
        nodes: [...regularNodes, ...expandedNodes],
        edges: [...rewrittenEdges, ...expandedEdges],
    };
}

/**
 * Convert the React-Flow graph into a CWL Workflow JS object.
 * Returns the raw object before YAML serialization.
 */
export function buildCWLWorkflowObject(graph) {
    // Pre-process: expand any custom workflow nodes into flat internal nodes
    graph = expandCustomWorkflowNodes(graph);

    // Extract BIDS nodes before filtering (they generate workflow-level inputs)
    const bidsNodes = graph.nodes.filter(n => n.data?.isBIDS && n.data?.bidsSelections);
    const bidsNodeIds = new Set(bidsNodes.map(n => n.id));

    // Collect edges FROM BIDS nodes (used for wired-inputs computation)
    const bidsEdges = graph.edges.filter(e => bidsNodeIds.has(e.source));

    // Filter out ALL dummy nodes (including BIDS) before processing
    const dummyNodeIds = new Set(
        graph.nodes.filter(n => n.data?.isDummy).map(n => n.id)
    );

    // Get non-dummy nodes and filter edges that connect to/from dummy nodes
    const nodes = graph.nodes.filter(n => !n.data?.isDummy);
    const edges = graph.edges.filter(e =>
        !dummyNodeIds.has(e.source) && !dummyNodeIds.has(e.target)
    );

    /* ---------- Pre-compute lookup maps for O(1) access ---------- */
    // Node lookup by ID
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const nodeById = id => nodeMap.get(id);

    // Pre-compute incoming and outgoing edges per node
    const inEdgeMap = new Map();
    const outEdgeMap = new Map();
    for (const node of nodes) {
        inEdgeMap.set(node.id, []);
        outEdgeMap.set(node.id, []);
    }
    for (const edge of edges) {
        inEdgeMap.get(edge.target)?.push(edge);
        outEdgeMap.get(edge.source)?.push(edge);
    }
    const inEdgesOf = id => inEdgeMap.get(id) || [];
    const outEdgesOf = id => outEdgeMap.get(id) || [];

    /* ---------- topo-sort (Kahn's algorithm) ---------- */
    const incoming = Object.fromEntries(nodes.map(n => [n.id, 0]));
    edges.forEach(e => incoming[e.target]++);
    const queue = nodes.filter(n => incoming[n.id] === 0).map(n => n.id);
    const order = [];
    let head = 0;

    while (head < queue.length) {
        const id = queue[head++];
        order.push(id);
        outEdgesOf(id).forEach(e => {
            if (--incoming[e.target] === 0) queue.push(e.target);
        });
    }

    if (order.length !== nodes.length) {
        throw new Error('Workflow graph has cycles.');
    }

    /* ---------- generate readable step IDs ---------- */
    // Count occurrences of each tool to handle duplicates
    const toolCounts = {};
    const nodeIdToStepId = {};

    order.forEach((nodeId) => {
        const node = nodeById(nodeId);
        const tool = getToolConfigSync(node.data.label);
        // Use tool.id if available, otherwise generate from label
        const toolId = tool?.id || node.data.label.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Track how many times we've seen this tool
        if (!(toolId in toolCounts)) {
            toolCounts[toolId] = 0;
        }
        toolCounts[toolId]++;

        // Store mapping from node ID to step ID
        nodeIdToStepId[nodeId] = { toolId, count: toolCounts[toolId] };
    });

    // Generate final step IDs (only add number suffix if duplicates exist)
    const getStepId = (nodeId) => {
        const { toolId, count } = nodeIdToStepId[nodeId];
        const totalCount = toolCounts[toolId];
        return totalCount > 1 ? `${toolId}_${count}` : toolId;
    };

    /* ---------- resolve CWL source reference for a wired input ---------- */
    const resolveWiredSource = (ws) => {
        if (ws.isBIDSInput) return ws.sourceOutput; // workflow-level input name
        return `${getStepId(ws.sourceNodeId)}/${ws.sourceOutput}`;
    };

    /* ---------- compute scatter propagation ---------- */
    // Include BIDS nodes in scatter computation (they have scatterEnabled: true)
    const scatterNodes = [...nodes, ...bidsNodes];
    const scatterEdges = [...edges, ...bidsEdges];
    const { scatteredNodeIds: scatteredSteps, sourceNodeIds } = computeScatteredNodes(scatterNodes, scatterEdges);

    /* ---------- helper: wrap a type string in CWL array ---------- */
    const toArrayType = (typeStr) => {
        // Strip nullable marker - array can be empty instead
        const base = (typeStr || 'File').replace(/\?$/, '');
        return { type: 'array', items: base };
    };

    /* ---------- build CWL skeleton ---------- */
    const wf = {
        cwlVersion: 'v1.2',
        class: 'Workflow',
        inputs: {},
        outputs: {},
        steps: {}
    };

    // Generate workflow-level File[] inputs only for BIDS selections consumed by non-dummy nodes
    const consumedBidsSelections = new Set();
    for (const edge of bidsEdges) {
        if (dummyNodeIds.has(edge.target)) continue;
        for (const m of (edge.data?.mappings || [])) {
            consumedBidsSelections.add(m.sourceOutput);
        }
    }
    for (const selKey of consumedBidsSelections) {
        wf.inputs[selKey] = { type: { type: 'array', items: 'File' } };
    }

    // Requirement flags — assembled after the node walk loop
    let needsMultipleInputFeature = false;
    let needsInlineJavascript = false;
    let needsStepInputExpression = false;
    const conditionalStepIds = new Set();

    // Separate map for job template values (not embedded in CWL)
    const jobDefaults = {};

    /* ---------- helper: convert type string to CWL type ---------- */
    const toCWLType = (typeStr, makeNullable = false) => {
        if (!typeStr) return makeNullable ? ['null', 'File'] : 'File';

        // Skip record types - handled separately
        if (typeStr === 'record') return null;

        // Handle array types like 'File[]'
        if (typeStr.endsWith('[]')) {
            const itemType = typeStr.slice(0, -2);
            const arrayType = { type: 'array', items: itemType };
            return makeNullable ? ['null', arrayType] : arrayType;
        }

        // Handle nullable types like 'File?'
        if (typeStr.endsWith('?')) {
            return ['null', typeStr.slice(0, -1)];
        }

        // Plain type
        return makeNullable ? ['null', typeStr] : typeStr;
    };

    /* ---------- helper: check if a value is YAML-serializable ---------- */
    const isSerializable = (val) => {
        if (val === null || val === undefined) return false;
        const t = typeof val;
        if (t === 'string' || t === 'number' || t === 'boolean') return true;
        if (t === 'function') return false;
        if (Array.isArray(val)) return val.every(isSerializable);
        if (t === 'object') return Object.values(val).every(isSerializable);
        return false;
    };

    /* ---------- helper: safely extract user parameters ---------- */
    const getUserParams = (nodeData) => {
        const p = nodeData.parameters;
        if (p && typeof p === 'object' && !Array.isArray(p)) return p;
        return null;
    };

    /* ---------- helper: type-based default for optional inputs ---------- */
    const defaultForType = (type, inputDef) => {
        switch (type) {
            case 'boolean': return false;
            case 'int':     return inputDef?.bounds ? inputDef.bounds[0] : 0;
            case 'double':  return inputDef?.bounds ? inputDef.bounds[0] : 0.0;
            case 'string':  return '';
            default:        return null;
        }
    };

    /* ---------- helper: generate workflow input name ---------- */
    const makeWfInputName = (stepId, inputName, isSingleNode) => {
        return isSingleNode ? inputName : `${stepId}_${inputName}`;
    };

    /* ---------- pre-compute wired inputs per node from edge mappings ---------- */
    // wiredInputsMap: Map<nodeId, Map<inputName, Array<{ sourceNodeId, sourceOutput, isBIDSInput? }>>>
    const wiredInputsMap = new Map();
    for (const edge of edges) {
        const mappings = edge.data?.mappings || [];
        for (const m of mappings) {
            if (!wiredInputsMap.has(edge.target)) wiredInputsMap.set(edge.target, new Map());
            const nodeInputs = wiredInputsMap.get(edge.target);
            const sourceInfo = { sourceNodeId: edge.source, sourceOutput: m.sourceOutput };
            if (nodeInputs.has(m.targetInput)) {
                nodeInputs.get(m.targetInput).push(sourceInfo);
            } else {
                nodeInputs.set(m.targetInput, [sourceInfo]);
            }
        }
    }

    // Add BIDS edges to the wired inputs map (BIDS sources are workflow-level inputs)
    for (const edge of bidsEdges) {
        const mappings = edge.data?.mappings || [];
        for (const m of mappings) {
            if (!wiredInputsMap.has(edge.target)) wiredInputsMap.set(edge.target, new Map());
            const nodeInputs = wiredInputsMap.get(edge.target);
            const sourceInfo = {
                sourceNodeId: null,
                sourceOutput: m.sourceOutput, // This is the BIDS selection key (workflow input name)
                isBIDSInput: true,
            };
            if (nodeInputs.has(m.targetInput)) {
                nodeInputs.get(m.targetInput).push(sourceInfo);
            } else {
                nodeInputs.set(m.targetInput, [sourceInfo]);
            }
        }
    }

    /* ---------- walk nodes in topo order ---------- */
    order.forEach((nodeId) => {
        const node = nodeById(nodeId);
        const { label } = node.data;

        const tool = getToolConfigSync(label);

        // Generic fallback for undefined tools
        const genericTool = {
            id: label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            cwlPath: `cwl/generic/${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.cwl`,
            requiredInputs: {
                input: { type: 'File', label: 'Input' }
            },
            optionalInputs: {},
            outputs: { output: { type: 'File', label: 'Output' } }
        };

        const effectiveTool = tool || genericTool;

        const stepId = getStepId(nodeId);
        const incomingEdges = inEdgesOf(nodeId);
        const isSingleNode = nodes.length === 1;

        // Step skeleton
        const step = {
            run: `../${effectiveTool.cwlPath}`,
            in: {},
            out: Object.keys(effectiveTool.outputs)
        };

        // Read expressions from node data
        const expressions = node.data.expressions || {};

        /* ---------- handle required inputs ---------- */
        Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
            const { type } = inputDef;
            const expr = expressions[inputName];
            const wiredSources = wiredInputsMap.get(nodeId)?.get(inputName) || [];

            if (expr) {
                // Expression mode: valueFrom transforms the input
                needsStepInputExpression = true;
                needsInlineJavascript = true;
                if (wiredSources.length === 0) {
                    // Unwired + expression: expose as workflow input, valueFrom transforms it
                    const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                    wf.inputs[wfInputName] = { type: toCWLType(type) };
                    step.in[inputName] = { source: wfInputName, valueFrom: expr };
                } else if (wiredSources.length === 1) {
                    // Single wired + expression: source is upstream output, valueFrom transforms it
                    step.in[inputName] = {
                        source: resolveWiredSource(wiredSources[0]),
                        valueFrom: expr,
                    };
                } else {
                    // Multi-source + expression: preserve linkMerge alongside valueFrom
                    const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                    step.in[inputName] = {
                        source: wiredSources.map(ws => resolveWiredSource(ws)),
                        linkMerge,
                        valueFrom: expr,
                    };
                    needsMultipleInputFeature = true;
                }
            } else if (wiredSources.length === 1) {
                // Single source: simple string reference (backward-compatible)
                step.in[inputName] = resolveWiredSource(wiredSources[0]);
            } else if (wiredSources.length > 1) {
                // Multiple sources: use source array + linkMerge
                const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                step.in[inputName] = {
                    source: wiredSources.map(ws => resolveWiredSource(ws)),
                    linkMerge,
                };
                needsMultipleInputFeature = true;
            } else {
                // Not wired - expose as workflow input
                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                const inputType = scatteredSteps.has(nodeId) && (type === 'File' || type === 'Directory')
                    ? toArrayType(type)
                    : toCWLType(type);
                wf.inputs[wfInputName] = { type: inputType };
                step.in[inputName] = wfInputName;

                // Pre-fill jobDefaults for scalar required params if user set a value
                if (type !== 'File' && type !== 'Directory') {
                    const params = getUserParams(node.data);
                    const userValue = params?.[inputName];
                    if (userValue !== undefined && userValue !== null && userValue !== '' && isSerializable(userValue)) {
                        jobDefaults[wfInputName] = userValue;
                    }
                }
            }
        });

        /* ---------- handle optional inputs ---------- */
        if (effectiveTool.optionalInputs) {
            Object.entries(effectiveTool.optionalInputs).forEach(([inputName, inputDef]) => {
                const { type } = inputDef;
                const optExpr = expressions[inputName];

                // Expression on optional input: emit valueFrom, respecting wired sources
                if (optExpr) {
                    needsStepInputExpression = true;
                    needsInlineJavascript = true;
                    const wiredSources = wiredInputsMap.get(nodeId)?.get(inputName) || [];
                    if (wiredSources.length === 1) {
                        step.in[inputName] = {
                            source: resolveWiredSource(wiredSources[0]),
                            valueFrom: optExpr,
                        };
                    } else if (wiredSources.length > 1) {
                        const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                        step.in[inputName] = {
                            source: wiredSources.map(ws => resolveWiredSource(ws)),
                            linkMerge,
                            valueFrom: optExpr,
                        };
                        needsMultipleInputFeature = true;
                    } else {
                        const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                        wf.inputs[wfInputName] = { type: toCWLType(type, true) };
                        step.in[inputName] = { source: wfInputName, valueFrom: optExpr };
                    }
                    return;
                }

                // Skip record types - these are complex types handled by CWL directly
                if (type === 'record') {
                    const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                    const recordEntry = { type: ['null', 'Any'] };
                    const params = getUserParams(node.data);
                    const recordValue = params?.[inputName];
                    if (recordValue !== undefined && recordValue !== null && recordValue !== '' && isSerializable(recordValue)) {
                        recordEntry.default = recordValue;
                    }
                    wf.inputs[wfInputName] = recordEntry;
                    step.in[inputName] = wfInputName;
                    return;
                }

                // Check wired sources for non-expression optional inputs
                const wiredSources = wiredInputsMap.get(nodeId)?.get(inputName) || [];

                if (wiredSources.length === 1) {
                    step.in[inputName] = resolveWiredSource(wiredSources[0]);
                } else if (wiredSources.length > 1) {
                    const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                    step.in[inputName] = {
                        source: wiredSources.map(ws => resolveWiredSource(ws)),
                        linkMerge,
                    };
                    needsMultipleInputFeature = true;
                } else {
                    // Not wired — expose as nullable workflow input with job default
                    const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                    const inputEntry = { type: toCWLType(type, true) };
                    const params = getUserParams(node.data);
                    const userValue = params?.[inputName];
                    let value;
                    if (userValue !== undefined && userValue !== null && userValue !== '' && isSerializable(userValue)) {
                        value = userValue;
                    } else {
                        value = defaultForType(type, inputDef);
                    }
                    if (value !== null && value !== undefined) {
                        jobDefaults[wfInputName] = value;
                    }
                    wf.inputs[wfInputName] = inputEntry;
                    step.in[inputName] = wfInputName;
                }
            });
        }

        /* ---------- add Docker hints ---------- */
        const dockerVersion = node.data.dockerVersion || 'latest';
        const dockerImage = effectiveTool.dockerImage;

        if (dockerImage) {
            step.hints = {
                DockerRequirement: {
                    dockerPull: `${dockerImage}:${dockerVersion}`
                }
            };
        }

        /* ---------- add scatter to step if needed ---------- */
        if (scatteredSteps.has(nodeId)) {
            const scatterInputs = [];

            if (sourceNodeIds.has(nodeId)) {
                // Source node: scatter on File/Directory required inputs that are workflow-level inputs
                Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
                    const isFileOrDir = inputDef.type === 'File' || inputDef.type === 'Directory';
                    const isWired = (wiredInputsMap.get(nodeId)?.get(inputName)?.length || 0) > 0;
                    if (isFileOrDir && !isWired) {
                        scatterInputs.push(inputName);
                    }
                });
            } else {
                // Downstream node: scatter on inputs wired from scattered upstream
                incomingEdges.forEach(edge => {
                    if (!scatteredSteps.has(edge.source)) return;
                    const mappings = edge.data?.mappings || [];
                    mappings.forEach(m => {
                        if (!scatterInputs.includes(m.targetInput)) {
                            scatterInputs.push(m.targetInput);
                        }
                    });
                });
                // Also check BIDS edges targeting this node (BIDS nodes are scatter sources)
                bidsEdges.filter(e => e.target === nodeId).forEach(edge => {
                    const mappings = edge.data?.mappings || [];
                    mappings.forEach(m => {
                        if (!scatterInputs.includes(m.targetInput)) {
                            scatterInputs.push(m.targetInput);
                        }
                    });
                });
            }

            if (scatterInputs.length > 0) {
                step.scatter = scatterInputs.length === 1 ? scatterInputs[0] : scatterInputs;
                if (scatterInputs.length > 1) {
                    step.scatterMethod = 'dotproduct';
                }
            }
        }

        // Build final step with CWL-conventional property order: run, scatter, in, out, hints
        const finalStep = { run: step.run };
        if (step.scatter) finalStep.scatter = step.scatter;
        if (step.scatterMethod) finalStep.scatterMethod = step.scatterMethod;
        finalStep.in = step.in;
        finalStep.out = step.out;
        if (step.hints) finalStep.hints = step.hints;

        // Conditional execution (when clause)
        if (node.data.whenExpression && node.data.whenExpression.trim()) {
            finalStep.when = node.data.whenExpression.trim();
            conditionalStepIds.add(nodeId);
            needsInlineJavascript = true;
        }

        wf.steps[stepId] = finalStep;
    });

    /* ---------- assemble requirements ---------- */
    const requirements = {};
    if (needsInlineJavascript) requirements.InlineJavascriptRequirement = {};
    if (scatteredSteps.size > 0) requirements.ScatterFeatureRequirement = {};
    if (needsMultipleInputFeature) requirements.MultipleInputFeatureRequirement = {};
    if (needsStepInputExpression) requirements.StepInputExpressionRequirement = {};
    if (Object.keys(requirements).length > 0) wf.requirements = requirements;

    /* ---------- declare ALL outputs from terminal nodes ---------- */
    const terminalNodes = nodes.filter(n => outEdgesOf(n.id).length === 0);

    terminalNodes.forEach(node => {
        const tool = getToolConfigSync(node.data.label);
        // Fallback outputs for undefined tools
        const outputs = tool?.outputs || { output: { type: 'File', label: 'Output' } };
        const stepId = getStepId(node.id);
        const isSingleTerminal = terminalNodes.length === 1;

        // Expose ALL outputs from terminal nodes
        const isScattered = scatteredSteps.has(node.id);

        Object.entries(outputs).forEach(([outputName, outputDef]) => {
            const wfOutputName = isSingleTerminal
                ? outputName
                : `${stepId}_${outputName}`;

            // If scattered, wrap output type in array
            const outputType = isScattered
                ? toArrayType(outputDef.type)
                : toCWLType(outputDef.type);

            const outputEntry = {
                type: outputType,
                outputSource: `${stepId}/${outputName}`
            };

            // Conditional terminal nodes: output may be null when step is skipped
            if (conditionalStepIds.has(node.id)) {
                outputEntry.type = ['null', outputType];
                outputEntry.pickValue = 'first_non_null';
            }

            wf.outputs[wfOutputName] = outputEntry;
        });
    });

    return { wf, jobDefaults };
}



/**
 * Generate a job input template from a CWL workflow object.
 * Mirrors the behavior of `cwltool --make-template`.
 */
export function buildJobTemplate(wf, jobDefaults = {}) {
    const placeholderForType = (cwlType) => {
        if (cwlType == null) return null;

        // Nullable / union: ['null', X] → placeholder for X
        if (Array.isArray(cwlType)) {
            const nonNull = cwlType.find(t => t !== 'null');
            return nonNull ? placeholderForType(nonNull) : null;
        }

        // Array: { type: 'array', items: T } → [placeholder(T)]
        if (typeof cwlType === 'object' && cwlType.type === 'array') {
            return [placeholderForType(cwlType.items)];
        }

        // Primitive types
        switch (cwlType) {
            case 'File':      return { class: 'File', path: 'a/file/path' };
            case 'Directory':  return { class: 'Directory', path: 'a/directory/path' };
            case 'string':     return 'a_string';
            case 'int':
            case 'long':       return 0;
            case 'float':
            case 'double':     return 0.1;
            case 'boolean':    return false;
            default:           return null;
        }
    };

    const template = {};
    for (const [name, def] of Object.entries(wf.inputs)) {
        if (jobDefaults[name] !== undefined) {
            template[name] = jobDefaults[name];
        } else if (def.default !== undefined) {
            template[name] = def.default;
        } else {
            template[name] = placeholderForType(def.type);
        }
    }
    return YAML.dump(template, { noRefs: true });
}