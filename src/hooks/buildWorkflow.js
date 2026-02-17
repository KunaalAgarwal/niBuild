import YAML from 'js-yaml';
import { TOOL_MAP } from '../../public/cwl/toolMap.js';
import { computeScatteredNodes } from '../utils/scatterPropagation.js';

/**
 * Convert the React-Flow graph into a CWL Workflow YAML string.
 * Uses static TOOL_MAP metadata to wire inputs/outputs correctly.
 *
 * - Exposes all required inputs as workflow inputs
 * - Exposes all optional inputs as nullable workflow inputs
 * - Exposes all outputs from terminal nodes
 * - Excludes dummy nodes (visual-only) from CWL generation
 */
/**
 * Convert the React-Flow graph into a CWL Workflow JS object.
 * Returns the raw object before YAML serialization.
 */
export function buildCWLWorkflowObject(graph) {
    // Filter out dummy nodes before processing
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

    while (queue.length) {
        const id = queue.shift();
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
        const tool = TOOL_MAP[node.data.label];
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

    /* ---------- compute scatter propagation ---------- */
    const { scatteredNodeIds: scatteredSteps, sourceNodeIds } = computeScatteredNodes(nodes, edges);

    /* ---------- helper: wrap a type string in CWL array ---------- */
    const toArrayType = (typeStr) => {
        // Strip nullable marker - array can be empty instead
        const base = (typeStr || 'File').replace(/\?$/, '');
        return { type: 'array', items: base };
    };

    /* ---------- build CWL skeleton ---------- */
    const hasScatter = scatteredSteps.size > 0;
    const wf = {
        cwlVersion: 'v1.2',
        class: 'Workflow',
        ...(hasScatter && { requirements: { ScatterFeatureRequirement: {} } }),
        inputs: {},
        outputs: {},
        steps: {}
    };

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

    /* ---------- walk nodes in topo order ---------- */
    order.forEach((nodeId) => {
        const node = nodeById(nodeId);
        const { label } = node.data;
        const tool = TOOL_MAP[label];

        // Generic fallback for undefined tools
        const genericTool = {
            id: label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            cwlPath: `cwl/generic/${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.cwl`,
            primaryOutputs: ['output'],
            requiredInputs: {
                input: { type: 'File', passthrough: true, label: 'Input' }
            },
            optionalInputs: {},
            outputs: { output: { type: 'File', label: 'Output' } }
        };

        const effectiveTool = tool || genericTool;

        const stepId = getStepId(nodeId);
        const incomingEdges = inEdgesOf(nodeId);
        const isSingleNode = nodes.length === 1;

        // Step skeleton with correct relative path
        // Declare ALL outputs so they can be referenced
        const step = {
            run: `../${effectiveTool.cwlPath}`,
            in: {},
            out: Object.keys(effectiveTool.outputs)
        };

        /* ---------- handle required inputs ---------- */
        Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
            const { type, passthrough } = inputDef;

            if (passthrough) {
                if (incomingEdges.length > 0) {
                    const srcEdge = incomingEdges[0];
                    const srcStepId = getStepId(srcEdge.source);

                    // NEW: Use explicit mapping from edge data if available
                    const mapping = srcEdge.data?.mappings?.find(m => m.targetInput === inputName);

                    if (mapping) {
                        // Use explicit mapping
                        step.in[inputName] = `${srcStepId}/${mapping.sourceOutput}`;
                    } else {
                        // Fallback to primary output (for backward compatibility or generic tools)
                        const srcNode = nodeById(srcEdge.source);
                        const srcTool = TOOL_MAP[srcNode.data.label];
                        if (srcTool?.primaryOutputs?.[0]) {
                            step.in[inputName] = `${srcStepId}/${srcTool.primaryOutputs[0]}`;
                        } else {
                            // Generic fallback for undefined tools
                            step.in[inputName] = `${srcStepId}/output`;
                        }
                    }
                } else {
                    // Source node - expose as workflow input
                    const wfInputName = sourceNodeIds.size === 1
                        ? 'input_file'
                        : `${stepId}_input_file`;
                    // If scattered, input becomes an array type
                    const inputType = scatteredSteps.has(nodeId)
                        ? toArrayType(type)
                        : toCWLType(type);
                    wf.inputs[wfInputName] = { type: inputType };
                    step.in[inputName] = wfInputName;
                }
            } else {
                // Non-passthrough required input - expose as workflow input
                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                wf.inputs[wfInputName] = { type: toCWLType(type) };
                step.in[inputName] = wfInputName;
            }
        });

        /* ---------- handle optional inputs ---------- */
        if (effectiveTool.optionalInputs) {
            Object.entries(effectiveTool.optionalInputs).forEach(([inputName, inputDef]) => {
                const { type } = inputDef;

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

                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);

                // Make optional inputs nullable (no default in CWL — values go to jobDefaults)
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
                // Source node: scatter on passthrough inputs
                Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
                    if (inputDef.passthrough) {
                        scatterInputs.push(inputName);
                    }
                });
            } else {
                // Downstream node: scatter on inputs wired from scattered upstream
                incomingEdges.forEach(edge => {
                    if (!scatteredSteps.has(edge.source)) return;
                    const mappings = edge.data?.mappings || [];
                    if (mappings.length > 0) {
                        mappings.forEach(m => {
                            if (!scatterInputs.includes(m.targetInput)) {
                                scatterInputs.push(m.targetInput);
                            }
                        });
                    } else {
                        // Fallback: scatter on passthrough inputs
                        Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
                            if (inputDef.passthrough && !scatterInputs.includes(inputName)) {
                                scatterInputs.push(inputName);
                            }
                        });
                    }
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
        wf.steps[stepId] = finalStep;
    });

    /* ---------- declare ALL outputs from terminal nodes ---------- */
    const terminalNodes = nodes.filter(n => outEdgesOf(n.id).length === 0);

    terminalNodes.forEach(node => {
        const tool = TOOL_MAP[node.data.label];
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

            wf.outputs[wfOutputName] = {
                type: outputType,
                outputSource: `${stepId}/${outputName}`
            };
        });
    });

    return { wf, jobDefaults };
}

/**
 * Convert the React-Flow graph into a CWL Workflow YAML string.
 */
export function buildCWLWorkflow(graph) {
    const { wf } = buildCWLWorkflowObject(graph);
    return YAML.dump(wf, { noRefs: true });
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