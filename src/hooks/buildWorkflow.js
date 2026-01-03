import YAML from 'js-yaml';
import { TOOL_MAP } from '../../public/cwl/toolMap.js';

/**
 * Convert the React-Flow graph into a CWL Workflow YAML string.
 * Uses static TOOL_MAP metadata to wire inputs/outputs correctly.
 *
 * - Exposes all required inputs as workflow inputs
 * - Exposes all optional inputs as nullable workflow inputs
 * - Exposes all outputs from terminal nodes
 */
export function buildCWLWorkflow(graph) {
    const { nodes, edges } = graph;

    /* ---------- helper look-ups ---------- */
    const nodeById   = id => nodes.find(n => n.id === id);
    const inEdgesOf  = id => edges.filter(e => e.target === id);
    const outEdgesOf = id => edges.filter(e => e.source === id);

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

    /* ---------- build CWL skeleton ---------- */
    const wf = {
        cwlVersion: 'v1.2',
        class: 'Workflow',
        inputs: {},
        outputs: {},
        steps: {}
    };

    // Track source nodes (no incoming edges)
    const sourceNodeIds = new Set(
        nodes.filter(n => inEdgesOf(n.id).length === 0).map(n => n.id)
    );

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
                    wf.inputs[wfInputName] = { type: toCWLType(type) };
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
                    wf.inputs[wfInputName] = { type: ['null', 'Any'] };
                    step.in[inputName] = wfInputName;
                    return;
                }

                const wfInputName = makeWfInputName(stepId, inputName, isSingleNode);

                // Make optional inputs nullable
                wf.inputs[wfInputName] = { type: toCWLType(type, true) };
                step.in[inputName] = wfInputName;
            });
        }

        wf.steps[stepId] = step;
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
        Object.entries(outputs).forEach(([outputName, outputDef]) => {
            const wfOutputName = isSingleTerminal
                ? outputName
                : `${stepId}_${outputName}`;

            const outputType = toCWLType(outputDef.type);

            wf.outputs[wfOutputName] = {
                type: outputType,
                outputSource: `${stepId}/${outputName}`
            };
        });
    });

    return YAML.dump(wf, { noRefs: true });
}