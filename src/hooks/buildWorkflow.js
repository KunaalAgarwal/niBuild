import YAML from 'js-yaml';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { computeScatteredNodes, buildArrayTypedInputs } from '../utils/scatterPropagation.js';
import { topoSort } from '../utils/topoSort.js';
import { deserializeNode } from '../utils/workflowDiff.js';

/**
 * Expand custom workflow nodes into their internal nodes/edges.
 * Rewrites external edges so their namespaced mappings (internalNodeId/ioName)
 * point to the correct expanded internal node with plain ioName.
 * Returns a flat graph with no custom workflow nodes.
 */
export function expandCustomWorkflowNodes(graph) {
    const { nodes, edges } = graph;
    const customNodes = nodes.filter((n) => n.data?.isCustomWorkflow);

    if (customNodes.length === 0) return graph;

    const customNodeIds = new Set(customNodes.map((n) => n.id));
    const expandedNodes = [];
    const expandedEdges = [];

    // 1. Expand each custom workflow node into its internal nodes + edges
    for (const customNode of customNodes) {
        const { internalNodes = [], internalEdges = [] } = customNode.data;

        for (const iNode of internalNodes) {
            const deserialized = deserializeNode(iNode);
            deserialized.id = `${customNode.id}__${iNode.id}`;
            expandedNodes.push(deserialized);
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
    const regularNodes = nodes.filter((n) => !customNodeIds.has(n.id));

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

/* ========== Pure utility helpers ========== */

/** Convert a type string to its CWL representation. */
function toCWLType(typeStr, makeNullable = false, enumSymbols = null) {
    if (!typeStr) return makeNullable ? ['null', 'File'] : 'File';
    if (typeStr === 'record') return makeNullable ? ['null', 'Any'] : 'Any';
    if (typeStr === 'enum' && enumSymbols) {
        const enumType = { type: 'enum', symbols: enumSymbols };
        return makeNullable ? ['null', enumType] : enumType;
    }
    if (typeStr.endsWith('[]')) {
        const itemType = typeStr.slice(0, -2);
        const arrayType = { type: 'array', items: itemType };
        return makeNullable ? ['null', arrayType] : arrayType;
    }
    if (typeStr.endsWith('?')) {
        return ['null', typeStr.slice(0, -1)];
    }
    return makeNullable ? ['null', typeStr] : typeStr;
}

/** Wrap a type string in a CWL array type. */
function toArrayType(typeStr) {
    const base = (typeStr || 'File').replace(/\?$/, '').replace(/\[\]$/, '');
    return { type: 'array', items: base };
}

/**
 * Check if a wired source will produce a double-nested array due to scatter.
 * When a scattered step's output is already an array type (e.g. File[]),
 * scatter wraps it in another array → File[][]. Downstream steps expecting
 * File[] need a valueFrom expression to flatten.
 */
function sourceNeedsFlatten(ctx, ws) {
    if (ws.isBIDSInput) return false;
    if (!ctx.scatteredSteps.has(ws.sourceNodeId)) return false;

    const sourceNode = ctx.nodeMap.get(ws.sourceNodeId);
    if (!sourceNode) return false;

    const sourceTool = getToolConfigSync(sourceNode.data.label);
    if (!sourceTool) return false;

    const outputDef = sourceTool.outputs?.[ws.sourceOutput];
    if (!outputDef?.type) return false;

    // Strip nullable marker before checking for array
    const baseType = outputDef.type.replace(/\?$/, '');
    return baseType.endsWith('[]');
}

/**
 * Resolve a wired source, injecting a valueFrom flatten expression when the
 * source is a scattered step with an array-typed output (double nesting).
 * Sets ctx.needsInlineJavascript and ctx.needsStepInputExpression when flattening.
 */
function resolveWithFlatten(ctx, ws) {
    const source = ctx.resolveWiredSource(ws);
    if (sourceNeedsFlatten(ctx, ws)) {
        ctx.needsInlineJavascript = true;
        ctx.needsStepInputExpression = true;
        return { source, valueFrom: '$(self.flat())' };
    }
    return source;
}

/** Check if a value is safely YAML-serializable. */
function isSerializable(val) {
    if (val === null || val === undefined) return false;
    const t = typeof val;
    if (t === 'string' || t === 'number' || t === 'boolean') return true;
    if (t === 'function') return false;
    if (Array.isArray(val)) return val.every(isSerializable);
    if (t === 'object') return Object.values(val).every(isSerializable);
    return false;
}

/** Safely extract user parameters object from node data. */
function getUserParams(nodeData) {
    const p = nodeData.parameters;
    if (p && typeof p === 'object' && !Array.isArray(p)) return p;
    return null;
}

/** Get a validated user parameter value, or undefined if missing/empty/non-serializable. */
function getValidUserParam(nodeData, inputName) {
    const params = getUserParams(nodeData);
    const val = params?.[inputName];
    if (val !== undefined && val !== null && val !== '' && isSerializable(val)) return val;
    return undefined;
}

/** Return a sensible default value for a CWL type. Prefers CWL-defined defaults.
 *  Only called for optional (nullable) params. Returns null when no CWL default
 *  exists — null means "not provided" and prevents CWL from emitting the flag. */
function defaultForType(type, inputDef) {
    if (inputDef?.hasDefault) return inputDef.defaultValue;
    return null;
}

/** Generate a workflow-level input name, skipping the step prefix for single-node workflows. */
function makeWfInputName(stepId, inputName, isSingleNode) {
    return isSingleNode ? inputName : `${stepId}_${inputName}`;
}

/* ========== Extracted sub-functions for buildCWLWorkflowObject ========== */

/**
 * Compute the effective set of scatter input names for a given node.
 * Uses explicit scatterInputs if set; falls back to auto-detect for downstream nodes
 * by scattering on inputs wired from scattered upstream.
 */
function getEffectiveScatterInputs(ctx, nodeId, effectiveTool, incomingEdges) {
    const node = ctx.nodeMap.get(nodeId);
    const explicitScatter = node?.data?.scatterInputs;

    // Explicit configuration takes precedence (filter to valid input names).
    // Empty array (from modal save before edges were connected) falls through to auto-detect.
    if (Array.isArray(explicitScatter) && explicitScatter.length > 0) {
        const allInputNames = new Set([
            ...Object.keys(effectiveTool.requiredInputs || {}),
            ...Object.keys(effectiveTool.optionalInputs || {}),
        ]);
        const result = new Set(explicitScatter.filter((name) => allInputNames.has(name)));
        // Also include auto-detected upstream scatter inputs (they're mandatory
        // and locked in the UI — explicit scatter alone may be stale)
        if (ctx.scatteredSteps.has(nodeId)) {
            const nodeArrayInputs = ctx.arrayTypedInputs?.get(nodeId) || new Set();
            (incomingEdges || []).forEach((edge) => {
                if (!ctx.scatteredSteps.has(edge.source)) return;
                (edge.data?.mappings || []).forEach((m) => {
                    if (!nodeArrayInputs.has(m.targetInput)) {
                        result.add(m.targetInput);
                    }
                });
            });
            ctx.bidsEdges
                .filter((e) => e.target === nodeId)
                .forEach((edge) => {
                    (edge.data?.mappings || []).forEach((m) => {
                        if (m.sourceOutput === 'bids_directory') return;
                        if (!nodeArrayInputs.has(m.targetInput)) {
                            result.add(m.targetInput);
                        }
                    });
                });
        }
        return result;
    }

    // Auto-detect only if node is in the scattered set
    if (!ctx.scatteredSteps.has(nodeId)) return new Set();

    // Auto-detect: scatter on inputs wired from scattered upstream,
    // but NOT on array-typed inputs (those are gather inputs)
    const inputs = [];
    const nodeArrayInputs = ctx.arrayTypedInputs?.get(nodeId) || new Set();
    (incomingEdges || []).forEach((edge) => {
        if (!ctx.scatteredSteps.has(edge.source)) return;
        (edge.data?.mappings || []).forEach((m) => {
            if (!inputs.includes(m.targetInput) && !nodeArrayInputs.has(m.targetInput)) {
                inputs.push(m.targetInput);
            }
        });
    });
    ctx.bidsEdges
        .filter((e) => e.target === nodeId)
        .forEach((edge) => {
            (edge.data?.mappings || []).forEach((m) => {
                if (m.sourceOutput === 'bids_directory') return;
                if (!inputs.includes(m.targetInput) && !nodeArrayInputs.has(m.targetInput)) {
                    inputs.push(m.targetInput);
                }
            });
        });
    return new Set(inputs);
}

/**
 * Populate step.in entries and corresponding workflow-level inputs/jobDefaults
 * for one node's required and optional CWL inputs.
 *
 * Mutates: step.in, ctx.wf.inputs, ctx.jobDefaults, ctx.needs* flags.
 */
function buildStepInputBindings(ctx, step, node, effectiveTool, stepId, isSingleNode) {
    const nodeId = node.id;
    const expressions = node.data.expressions || {};

    /* --- required inputs --- */
    Object.entries(effectiveTool.requiredInputs).forEach(([inputName, inputDef]) => {
        const { type } = inputDef;
        const expr = expressions[inputName];
        const wiredSources = ctx.wiredInputsMap.get(nodeId)?.get(inputName) || [];

        if (expr) {
            // Expression mode: valueFrom transforms the input
            ctx.needsStepInputExpression = true;
            ctx.needsInlineJavascript = true;
            if (wiredSources.length === 0) {
                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                ctx.wf.inputs[wfInputName] = { type: toCWLType(type, false, inputDef.enumSymbols) };
                step.in[inputName] = { source: wfInputName, valueFrom: expr };
            } else if (wiredSources.length === 1) {
                step.in[inputName] = {
                    source: ctx.resolveWiredSource(wiredSources[0]),
                    valueFrom: expr,
                };
            } else {
                const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                step.in[inputName] = {
                    source: wiredSources.map((ws) => ctx.resolveWiredSource(ws)),
                    linkMerge,
                    valueFrom: expr,
                };
                ctx.needsMultipleInputFeature = true;
            }
        } else if (wiredSources.length === 1) {
            step.in[inputName] = resolveWithFlatten(ctx, wiredSources[0]);
        } else if (wiredSources.length > 1) {
            const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
            const entry = {
                source: wiredSources.map((ws) => ctx.resolveWiredSource(ws)),
                linkMerge,
            };
            if (wiredSources.some((ws) => sourceNeedsFlatten(ctx, ws))) {
                entry.valueFrom = '$(self.flat())';
                ctx.needsInlineJavascript = true;
                ctx.needsStepInputExpression = true;
            }
            step.in[inputName] = entry;
            ctx.needsMultipleInputFeature = true;
        } else {
            // Not wired - expose as workflow input
            const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
            const effectiveScatter = ctx.effectiveScatterMap.get(nodeId) || new Set();
            // record types have no direct CWL representation; default to string for workflow inputs
            const inputType = effectiveScatter.has(inputName)
                ? toArrayType(type)
                : toCWLType(type, false, inputDef.enumSymbols) || 'string';
            ctx.wf.inputs[wfInputName] = { type: inputType };
            step.in[inputName] = wfInputName;

            // Pre-fill jobDefaults for scalar required params if user set a value
            if (type !== 'File' && type !== 'Directory') {
                const userValue = getValidUserParam(node.data, inputName);
                if (userValue !== undefined) {
                    ctx.jobDefaults[wfInputName] = userValue;
                }
            }
        }
    });

    /* --- optional inputs --- */
    if (!effectiveTool.optionalInputs) return;

    Object.entries(effectiveTool.optionalInputs).forEach(([inputName, inputDef]) => {
        const { type } = inputDef;
        const optExpr = expressions[inputName];

        // Expression on optional input: emit valueFrom, respecting wired sources
        if (optExpr) {
            ctx.needsStepInputExpression = true;
            ctx.needsInlineJavascript = true;
            const wiredSources = ctx.wiredInputsMap.get(nodeId)?.get(inputName) || [];
            if (wiredSources.length === 1) {
                step.in[inputName] = {
                    source: ctx.resolveWiredSource(wiredSources[0]),
                    valueFrom: optExpr,
                };
            } else if (wiredSources.length > 1) {
                const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
                step.in[inputName] = {
                    source: wiredSources.map((ws) => ctx.resolveWiredSource(ws)),
                    linkMerge,
                    valueFrom: optExpr,
                };
                ctx.needsMultipleInputFeature = true;
            } else {
                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
                const effectiveScatter = ctx.effectiveScatterMap.get(nodeId) || new Set();
                const inputType = effectiveScatter.has(inputName)
                    ? ['null', toArrayType(type)]
                    : toCWLType(type, true, inputDef.enumSymbols);
                ctx.wf.inputs[wfInputName] = { type: inputType };
                step.in[inputName] = { source: wfInputName, valueFrom: optExpr };
            }
            return;
        }

        // Record types: mutually exclusive parameter groups
        if (type === 'record') {
            const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
            const recordEntry = { type: ['null', 'Any'] };
            const selectedVariant = getValidUserParam(node.data, inputName);

            if (selectedVariant && inputDef.recordVariants) {
                const variant = inputDef.recordVariants.find((v) => v.name === selectedVariant);
                if (variant?.fields) {
                    const fieldKey = Object.keys(variant.fields)[0];
                    const fieldType = variant.fields[fieldKey]?.type;
                    if (fieldType === 'boolean') {
                        recordEntry.default = { [selectedVariant]: true };
                    } else if (fieldType === 'File') {
                        recordEntry.default = { [selectedVariant]: { class: 'File', path: 'PLACEHOLDER' } };
                    } else {
                        recordEntry.default = { [selectedVariant]: null };
                    }
                    ctx.jobDefaults[wfInputName] = recordEntry.default;
                }
            }

            ctx.wf.inputs[wfInputName] = recordEntry;
            step.in[inputName] = wfInputName;
            return;
        }

        // Check wired sources for non-expression optional inputs
        const wiredSources = ctx.wiredInputsMap.get(nodeId)?.get(inputName) || [];

        if (wiredSources.length === 1) {
            step.in[inputName] = resolveWithFlatten(ctx, wiredSources[0]);
        } else if (wiredSources.length > 1) {
            const linkMerge = node.data.linkMergeOverrides?.[inputName] || 'merge_flattened';
            const entry = {
                source: wiredSources.map((ws) => ctx.resolveWiredSource(ws)),
                linkMerge,
            };
            if (wiredSources.some((ws) => sourceNeedsFlatten(ctx, ws))) {
                entry.valueFrom = '$(self.flat())';
                ctx.needsInlineJavascript = true;
                ctx.needsStepInputExpression = true;
            }
            step.in[inputName] = entry;
            ctx.needsMultipleInputFeature = true;
        } else {
            // Not wired — expose as nullable workflow input with job default
            const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);
            const effectiveScatter = ctx.effectiveScatterMap.get(nodeId) || new Set();
            const inputType = effectiveScatter.has(inputName)
                ? ['null', toArrayType(type)]
                : toCWLType(type, true, inputDef.enumSymbols);
            const inputEntry = { type: inputType };
            const userValue = getValidUserParam(node.data, inputName);
            let value;
            if (userValue !== undefined) {
                value = userValue;
            } else {
                value = defaultForType(type, inputDef);
                if (inputDef?.hasDefault) ctx.cwlDefaultKeys.add(wfInputName);
            }
            if (value !== null && value !== undefined) {
                ctx.jobDefaults[wfInputName] = value;
            }
            ctx.wf.inputs[wfInputName] = inputEntry;
            step.in[inputName] = wfInputName;
        }
    });
}

/**
 * Compute scatter configuration for a single step.
 * Uses the pre-computed effectiveScatterMap from getEffectiveScatterInputs.
 *
 * @returns {{ scatter, scatterMethod? }} or null if step is not scattered.
 */
function computeStepScatter(ctx, nodeId) {
    const scatterInputs = [...(ctx.effectiveScatterMap.get(nodeId) || [])];
    if (scatterInputs.length === 0) return null;

    const result = {
        scatter: scatterInputs.length === 1 ? scatterInputs[0] : scatterInputs,
    };
    if (scatterInputs.length > 1) {
        const node = ctx.nodeMap.get(nodeId);
        result.scatterMethod = node?.data?.scatterMethod || 'dotproduct';
    }
    return result;
}

/** Compute the CWL output type, accounting for scatter-induced array wrapping. */
function computeOutputCWLType(outputDef, isScattered) {
    const baseOutputType = (outputDef.type || 'File').replace(/\?$/, '');
    if (isScattered && baseOutputType.endsWith('[]')) {
        const itemType = baseOutputType.slice(0, -2);
        return { type: 'array', items: { type: 'array', items: itemType } };
    }
    if (isScattered) return toArrayType(outputDef.type);
    return toCWLType(outputDef.type);
}

/** Wrap an output entry for conditional steps (pickValue + nullable type). */
function wrapConditional(outputEntry, isConditional, ctx) {
    if (!isConditional) return;
    const alreadyNullable = Array.isArray(outputEntry.type) && outputEntry.type[0] === 'null';
    if (!alreadyNullable) outputEntry.type = ['null', outputEntry.type];
    outputEntry.pickValue = 'first_non_null';
    ctx.needsMultipleInputFeature = true;
}

/**
 * Declare workflow-level outputs for all terminal nodes (nodes with no outgoing edges).
 *
 * Mutates: ctx.wf.outputs, ctx.needsMultipleInputFeature.
 */
function declareTerminalOutputs(ctx, terminalNodes, conditionalStepIds) {
    terminalNodes.forEach((node) => {
        const tool = getToolConfigSync(node.data.label);
        const outputs = tool?.outputs || { output: { type: 'File', label: 'Output' } };
        const stepId = ctx.getStepId(node.id);
        const isSingleTerminal = terminalNodes.length === 1;
        const scatterConfig = computeStepScatter(ctx, node.id);
        const isScattered = scatterConfig !== null;

        Object.entries(outputs).forEach(([outputName, outputDef]) => {
            const wfOutputName = isSingleTerminal ? outputName : `${stepId}_${outputName}`;

            const outputEntry = {
                type: computeOutputCWLType(outputDef, isScattered),
                outputSource: `${stepId}/${outputName}`,
            };

            wrapConditional(outputEntry, conditionalStepIds.has(node.id), ctx);
            ctx.wf.outputs[wfOutputName] = outputEntry;
        });
    });
}

/**
 * Declare workflow-level outputs based on user selections from the Output node.
 *
 * The selectedOutputs map uses keys like "canvasNodeId/outputName".
 * Maps canvasNodeId -> stepId using ctx.getStepId.
 *
 * Mutates: ctx.wf.outputs.
 */
function declareSelectedOutputs(ctx, selectedOutputs, conditionalStepIds) {
    // Collect selected outputs grouped by canvas node ID
    const selectedByNode = new Map();
    for (const [key, isSelected] of Object.entries(selectedOutputs)) {
        if (!isSelected) continue;
        const slashIdx = key.indexOf('/');
        if (slashIdx === -1) continue;
        const canvasNodeId = key.substring(0, slashIdx);
        const outputName = key.substring(slashIdx + 1);

        if (!selectedByNode.has(canvasNodeId)) {
            selectedByNode.set(canvasNodeId, []);
        }
        selectedByNode.get(canvasNodeId).push(outputName);
    }

    // Count total selected outputs for naming (single output = no prefix)
    let totalSelectedOutputs = 0;
    for (const outputs of selectedByNode.values()) {
        totalSelectedOutputs += outputs.length;
    }

    for (const [canvasNodeId, outputNames] of selectedByNode) {
        const node = ctx.nodeMap.get(canvasNodeId);
        if (!node) continue; // Node may have been removed or is a dummy

        let stepId;
        try {
            stepId = ctx.getStepId(canvasNodeId);
        } catch {
            continue; // Node not in topo-sort (stale selection)
        }

        const tool = getToolConfigSync(node.data.label);
        const outputs = tool?.outputs || {};
        const scatterConfig = computeStepScatter(ctx, canvasNodeId);
        const isScattered = scatterConfig !== null;

        for (const outputName of outputNames) {
            const outputDef = outputs[outputName];
            if (!outputDef) continue;

            const wfOutputName = totalSelectedOutputs === 1 ? outputName : `${stepId}_${outputName}`;

            const outputEntry = {
                type: computeOutputCWLType(outputDef, isScattered),
                outputSource: `${stepId}/${outputName}`,
            };

            wrapConditional(outputEntry, conditionalStepIds.has(canvasNodeId), ctx);
            ctx.wf.outputs[wfOutputName] = outputEntry;
        }
    }
}

/**
 * Convert the React-Flow graph into a CWL Workflow JS object.
 * Returns the raw object before YAML serialization.
 */
export function buildCWLWorkflowObject(graph) {
    // Pre-process: expand any custom workflow nodes into flat internal nodes
    graph = expandCustomWorkflowNodes(graph);

    // Extract Output node configuration before filtering out dummies.
    // If an Output node exists with selectedOutputs, use those selections
    // instead of the default "all terminal outputs" behavior.
    const outputConfigNode = graph.nodes.find(
        (n) => n.data?.isDummy && (n.data?.isOutputNode || n.data?.label === 'Output') && n.data?.selectedOutputs,
    );
    const outputSelections = outputConfigNode?.data?.selectedOutputs || null;

    // Extract BIDS nodes before filtering (they generate workflow-level inputs)
    const bidsNodes = graph.nodes.filter((n) => n.data?.isBIDS && n.data?.bidsSelections);
    const bidsNodeIds = new Set(bidsNodes.map((n) => n.id));

    // Collect edges FROM BIDS nodes (used for wired-inputs computation)
    const bidsEdges = graph.edges.filter((e) => bidsNodeIds.has(e.source));

    // Filter out ALL dummy nodes (including BIDS) before processing
    const dummyNodeIds = new Set(graph.nodes.filter((n) => n.data?.isDummy).map((n) => n.id));

    // Get non-dummy nodes and filter edges that connect to/from dummy nodes
    const nodes = graph.nodes.filter((n) => !n.data?.isDummy);
    const edges = graph.edges.filter((e) => !dummyNodeIds.has(e.source) && !dummyNodeIds.has(e.target));

    /* ---------- Pre-compute lookup maps for O(1) access ---------- */
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nodeById = (id) => nodeMap.get(id);

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
    const inEdgesOf = (id) => inEdgeMap.get(id) || [];
    const outEdgesOf = (id) => outEdgeMap.get(id) || [];

    /* ---------- topo-sort (Kahn's algorithm) ---------- */
    const order = topoSort(nodes, edges);

    /* ---------- generate readable step IDs ---------- */
    // Assign sequential numbers using the original graph node order (not topo order)
    // so that step IDs (fslmaths_1, fslmaths_2) match the display labels shown on
    // the canvas (fslmaths (1), fslmaths (2)), which also use graph array order.
    const toolCounts = {};
    const nodeIdToStepId = {};

    nodes.forEach((node) => {
        const tool = getToolConfigSync(node.data.label);
        const toolId = tool?.id || node.data.label.toLowerCase().replace(/[^a-z0-9]/g, '_');

        if (!(toolId in toolCounts)) {
            toolCounts[toolId] = 0;
        }
        toolCounts[toolId]++;

        nodeIdToStepId[node.id] = { toolId, count: toolCounts[toolId] };
    });

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
    const scatterNodes = [...nodes, ...bidsNodes];
    const scatterEdges = [...edges, ...bidsEdges];

    const arrayTypedInputs = buildArrayTypedInputs(nodes);

    const { scatteredNodeIds: scatteredSteps } = computeScatteredNodes(scatterNodes, scatterEdges, arrayTypedInputs);

    /* ---------- build CWL skeleton ---------- */
    const wf = {
        cwlVersion: 'v1.2',
        class: 'Workflow',
        inputs: {},
        outputs: {},
        steps: {},
    };

    // Generate workflow-level File[] inputs only for BIDS selections consumed by non-dummy nodes
    const consumedBidsSelections = new Set();
    for (const edge of bidsEdges) {
        if (dummyNodeIds.has(edge.target)) continue;
        for (const m of edge.data?.mappings || []) {
            consumedBidsSelections.add(m.sourceOutput);
        }
    }
    for (const selKey of consumedBidsSelections) {
        wf.inputs[selKey] =
            selKey === 'bids_directory' ? { type: 'Directory' } : { type: { type: 'array', items: 'File' } };
    }

    const conditionalStepIds = new Set();
    const positionOverrides = [];
    const jobDefaults = {};
    const cwlDefaultKeys = new Set();

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

    /* ---------- shared context for extracted helpers ---------- */
    const ctx = {
        wf,
        jobDefaults,
        cwlDefaultKeys,
        wiredInputsMap,
        scatteredSteps,
        nodeMap,
        bidsEdges,
        resolveWiredSource,
        getStepId,
        arrayTypedInputs,
        effectiveScatterMap: new Map(), // populated below
        needsMultipleInputFeature: false,
        needsInlineJavascript: false,
        needsStepInputExpression: false,
    };

    /* ---------- helper: resolve tool config with generic fallback ---------- */
    const getEffectiveTool = (label) => {
        return (
            getToolConfigSync(label) || {
                id: label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
                cwlPath: `cwl/generic/${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}.cwl`,
                requiredInputs: { input: { type: 'File', label: 'Input' } },
                optionalInputs: {},
                outputs: { output: { type: 'File', label: 'Output' } },
            }
        );
    };

    /* ---------- pre-compute effective scatter inputs per node ---------- */
    for (const nodeId of order) {
        const node = nodeById(nodeId);
        const effectiveTool = getEffectiveTool(node.data.label);
        const incoming = inEdgesOf(nodeId);
        ctx.effectiveScatterMap.set(nodeId, getEffectiveScatterInputs(ctx, nodeId, effectiveTool, incoming));
    }

    /* ---------- walk nodes in topo order ---------- */
    order.forEach((nodeId) => {
        const node = nodeById(nodeId);
        const effectiveTool = getEffectiveTool(node.data.label);

        const stepId = getStepId(nodeId);
        const isSingleNode = nodes.length === 1;

        // Step skeleton — use per-node CWL variant if operation order is customized
        const hasCustomOrder =
            effectiveTool.orderSensitive &&
            Array.isArray(node.data.operationOrder) &&
            node.data.operationOrder.length > 0;
        const customCwlPath = hasCustomOrder ? effectiveTool.cwlPath.replace(/\.cwl$/, `_${stepId}.cwl`) : null;
        const step = {
            run: `../${customCwlPath || effectiveTool.cwlPath}`,
            in: {},
            out: Object.keys(effectiveTool.outputs),
        };
        if (hasCustomOrder) {
            positionOverrides.push({
                cwlPath: effectiveTool.cwlPath,
                customCwlPath,
                operationOrder: node.data.operationOrder,
            });
        }

        // Populate step.in and workflow inputs
        buildStepInputBindings(ctx, step, node, effectiveTool, stepId, isSingleNode);

        // Add Docker hints
        const dockerVersion = node.data.dockerVersion || 'latest';
        const dockerImage = effectiveTool.dockerImage;

        if (dockerImage) {
            step.hints = {
                DockerRequirement: {
                    dockerPull: `${dockerImage}:${dockerVersion}`,
                },
            };
        }

        // Compute scatter for this step
        const scatterConfig = computeStepScatter(ctx, nodeId);

        // Build final step with CWL-conventional property order: run, scatter, in, out, hints
        const finalStep = { run: step.run };
        if (scatterConfig) {
            finalStep.scatter = scatterConfig.scatter;
            if (scatterConfig.scatterMethod) finalStep.scatterMethod = scatterConfig.scatterMethod;
        }
        finalStep.in = step.in;
        finalStep.out = step.out;
        if (step.hints) finalStep.hints = step.hints;

        // Conditional execution (when clause)
        if (node.data.whenExpression && node.data.whenExpression.trim()) {
            finalStep.when = node.data.whenExpression.trim();
            conditionalStepIds.add(nodeId);
            ctx.needsInlineJavascript = true;
        }

        wf.steps[stepId] = finalStep;
    });

    /* ---------- declare workflow-level outputs ---------- */
    if (outputSelections) {
        // User configured specific outputs via the Output node
        declareSelectedOutputs(ctx, outputSelections, conditionalStepIds);
    } else {
        // Fallback: all outputs from terminal nodes (original behavior)
        const terminalNodes = nodes.filter((n) => outEdgesOf(n.id).length === 0);
        declareTerminalOutputs(ctx, terminalNodes, conditionalStepIds);
    }

    /* ---------- assemble requirements (after outputs, which may set pickValue/needsMultipleInputFeature) ---------- */
    const requirements = {};
    if (ctx.needsInlineJavascript) requirements.InlineJavascriptRequirement = {};
    const hasAnyScatter = [...ctx.effectiveScatterMap.values()].some((s) => s.size > 0);
    if (hasAnyScatter) requirements.ScatterFeatureRequirement = {};
    if (ctx.needsMultipleInputFeature) requirements.MultipleInputFeatureRequirement = {};
    if (ctx.needsStepInputExpression) requirements.StepInputExpressionRequirement = {};
    if (Object.keys(requirements).length > 0) wf.requirements = requirements;

    return { wf, jobDefaults, cwlDefaultKeys, positionOverrides };
}

/**
 * Generate a job input template from a CWL workflow object.
 * Mirrors the behavior of `cwltool --make-template`.
 */
export function buildJobTemplate(wf, jobDefaults = {}, cwlDefaultKeys = new Set()) {
    const placeholderForType = (cwlType) => {
        if (cwlType == null) return null;

        // Nullable / union: ['null', X] → null (meaning "not provided")
        if (Array.isArray(cwlType)) {
            return null;
        }

        // Array: { type: 'array', items: T } → [placeholder(T)]
        if (typeof cwlType === 'object' && cwlType.type === 'array') {
            return [placeholderForType(cwlType.items)];
        }

        // Enum: { type: 'enum', symbols: [...] } → first symbol
        if (typeof cwlType === 'object' && cwlType.type === 'enum') {
            return cwlType.symbols?.[0] || null;
        }

        // Primitive types
        switch (cwlType) {
            case 'File':
                return null;
            case 'Directory':
                return null;
            case 'string':
                return 'a_string';
            case 'int':
            case 'long':
                return 0;
            case 'float':
            case 'double':
                return 0.1;
            case 'boolean':
                return false;
            default:
                return null;
        }
    };

    // Extract the base CWL type, unwrapping nullables and arrays
    const extractBaseType = (cwlType) => {
        if (cwlType == null) return { base: null, isArray: false };
        if (Array.isArray(cwlType)) {
            const nonNull = cwlType.find((t) => t !== 'null');
            return nonNull ? extractBaseType(nonNull) : { base: null, isArray: false };
        }
        if (typeof cwlType === 'object' && cwlType.type === 'array') {
            const inner = extractBaseType(cwlType.items);
            return { base: inner.base, isArray: true };
        }
        return { base: cwlType, isArray: false };
    };

    // Coerce a value to match its declared CWL type so that js-yaml
    // serialises it correctly (e.g. 1 instead of '1' for int params).
    const coerceToType = (value, cwlType) => {
        if (value === null || value === undefined) return value;
        const { base } = extractBaseType(cwlType);
        switch (base) {
            case 'int':
            case 'long':
                return typeof value === 'number' ? value : parseInt(value, 10);
            case 'float':
            case 'double':
                return typeof value === 'number' ? value : parseFloat(value);
            case 'boolean':
                return typeof value === 'boolean' ? value : value === 'true' || value === true;
            default:
                return value;
        }
    };

    const template = {};
    const defaultKeys = new Set(cwlDefaultKeys);
    const filePlaceholderKeys = new Map();
    for (const [name, def] of Object.entries(wf.inputs)) {
        if (jobDefaults[name] !== undefined) {
            template[name] = coerceToType(jobDefaults[name], def.type);
        } else if (def.default !== undefined) {
            template[name] = def.default;
            defaultKeys.add(name);
        } else {
            const { base, isArray } = extractBaseType(def.type);
            if (base === 'File' || base === 'Directory') {
                template[name] = isArray ? [] : null;
                filePlaceholderKeys.set(name, { base, isArray });
            } else {
                template[name] = placeholderForType(def.type);
            }
        }
    }
    let yaml = YAML.dump(template, { noRefs: true });
    // Annotate lines whose values come from CWL tool defaults
    for (const key of defaultKeys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`^(${escaped}:.*)$`, 'm');
        yaml = yaml.replace(re, `$1  # tool default`);
    }
    // Add structure comments for File/Directory placeholder keys
    for (const [key, { base, isArray }] of filePlaceholderKeys) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pathLabel = base === 'File' ? '<your/file/path>' : '<your/directory/path>';
        if (isArray) {
            const re = new RegExp(`^(${escaped}: \\[\\])$`, 'm');
            yaml = yaml.replace(re, `$1  # [{class: ${base}, path: ${pathLabel}}]`);
        } else {
            const re = new RegExp(`^(${escaped}: null)$`, 'm');
            yaml = yaml.replace(re, `$1  # {class: ${base}, path: ${pathLabel}}`);
        }
    }
    return yaml;
}
