import { getToolIO, checkTypeCompatibility, getBaseType } from './edgeMappingUtils.js';
import { getToolConfigSync } from './toolRegistry.js';

export function computeProblems(nodes, edges, workspaceStatus) {
    const problems = [];
    if (!nodes || nodes.length === 0) return problems;

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const incomingEdges = new Map();
    const outgoingEdges = new Map();
    for (const edge of edges || []) {
        if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
        outgoingEdges.get(edge.source).push(edge);
        if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
        incomingEdges.get(edge.target).push(edge);
    }

    // 1. Missing required File/Directory inputs
    for (const node of nodes) {
        if (node.data?.isDummy || node.data?.isOutputNode) continue;

        const io = getToolIO(node.data);
        if (!io || io.isGeneric || io.isDummy) continue;

        const toolConfig = getToolConfigSync(node.data.label);
        const wiredInputs = new Set();
        for (const edge of incomingEdges.get(node.id) || []) {
            for (const m of edge.data?.mappings || []) {
                wiredInputs.add(m.targetInput);
            }
        }

        for (const input of io.inputs) {
            if (!input.required) continue;
            if (wiredInputs.has(input.name)) continue;

            const baseType = getBaseType(input.type);
            if (baseType !== 'File' && baseType !== 'Directory') continue;

            const configInput = toolConfig?.requiredInputs?.[input.name];
            if (configInput?.hasDefault) continue;

            problems.push({
                id: `missing-${node.id}-${input.name}`,
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label,
                severity: 'error',
                message: `Missing required input: ${input.label || input.name}`,
            });
        }
    }

    // 2 & 3. Type/extension mismatches on edges
    for (const edge of edges || []) {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) continue;

        const sourceIO = getToolIO(sourceNode.data);
        const targetIO = getToolIO(targetNode.data);
        if (!sourceIO || !targetIO) continue;

        for (const m of edge.data?.mappings || []) {
            const output = sourceIO.outputs.find((o) => o.name === m.sourceOutput);
            const input = targetIO.inputs.find((i) => i.name === m.targetInput);
            if (!output || !input) continue;

            const result = checkTypeCompatibility(
                output.type,
                input.type,
                output.extensions || null,
                input.acceptedExtensions || null,
            );

            if (!result.compatible) {
                problems.push({
                    id: `type-${edge.id}-${m.sourceOutput}-${m.targetInput}`,
                    nodeId: targetNode.id,
                    nodeLabel: targetNode.data.displayLabel || targetNode.data.label,
                    severity: 'error',
                    message: `${result.reason}: ${sourceNode.data.label}.${m.sourceOutput} → ${m.targetInput}`,
                });
            } else if (result.isExtensionMismatch || result.isExtensionWarning) {
                problems.push({
                    id: `ext-${edge.id}-${m.sourceOutput}-${m.targetInput}`,
                    nodeId: targetNode.id,
                    nodeLabel: targetNode.data.displayLabel || targetNode.data.label,
                    severity: 'warning',
                    message: `${result.reason}: ${sourceNode.data.label}.${m.sourceOutput} → ${m.targetInput}`,
                });
            }
        }
    }

    // 4. Disconnected nodes
    for (const node of nodes) {
        const isDummy = node.data?.isDummy;
        const isBIDS = node.data?.isBIDS;
        const isOutput = node.data?.isOutputNode;
        if (isDummy && !isBIDS && !isOutput) continue;

        const hasIncoming = (incomingEdges.get(node.id) || []).length > 0;
        const hasOutgoing = (outgoingEdges.get(node.id) || []).length > 0;

        if (isBIDS && !hasOutgoing) {
            problems.push({
                id: `disconnected-${node.id}`,
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label || 'BIDS Input',
                severity: 'warning',
                message: 'BIDS input has no outgoing connections',
            });
        } else if (isOutput && !hasIncoming) {
            problems.push({
                id: `disconnected-${node.id}`,
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label || 'Output',
                severity: 'warning',
                message: 'Output node has no incoming connections',
            });
        } else if (!isDummy && !hasIncoming && !hasOutgoing) {
            problems.push({
                id: `disconnected-${node.id}`,
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label,
                severity: 'warning',
                message: 'Node is disconnected from the workflow',
            });
        }
    }

    // 5. Unsaved workspace
    if (workspaceStatus === 'unsaved') {
        problems.push({
            id: 'workspace-unsaved',
            nodeId: null,
            nodeLabel: 'Workspace',
            severity: 'warning',
            message: 'Workspace has not been saved',
        });
    } else if (workspaceStatus === 'modified') {
        problems.push({
            id: 'workspace-modified',
            nodeId: null,
            nodeLabel: 'Workspace',
            severity: 'warning',
            message: 'Workspace has unsaved changes',
        });
    }

    return problems;
}

const EMPTY_IO = Object.freeze({ inputs: [], outputs: [] });

export function computeWorkflowIO(nodes, edges) {
    if (!nodes || nodes.length === 0) return EMPTY_IO;

    const outgoingEdges = new Map();
    const incomingEdges = new Map();
    for (const edge of edges || []) {
        if (!outgoingEdges.has(edge.source)) outgoingEdges.set(edge.source, []);
        outgoingEdges.get(edge.source).push(edge);
        if (!incomingEdges.has(edge.target)) incomingEdges.set(edge.target, []);
        incomingEdges.get(edge.target).push(edge);
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const inputs = [];
    for (const node of nodes) {
        if (node.data?.isDummy || node.data?.isOutputNode) continue;

        const io = getToolIO(node.data);
        if (!io || io.isGeneric || io.isDummy) continue;

        const wiredInfo = new Map();
        for (const edge of incomingEdges.get(node.id) || []) {
            const srcNode = nodeMap.get(edge.source);
            const srcLabel = srcNode?.data?.displayLabel || srcNode?.data?.label || 'Unknown';
            for (const m of edge.data?.mappings || []) {
                wiredInfo.set(m.targetInput, { sourceNode: srcLabel, sourceOutput: m.sourceOutput });
            }
        }

        const requiredInputs = io.inputs
            .filter((inp) => inp.required)
            .map((inp) => {
                const src = wiredInfo.get(inp.name);
                return {
                    name: inp.name,
                    label: inp.label || inp.name,
                    type: inp.type,
                    wired: !!src,
                    source: src ? `${src.sourceNode}.${src.sourceOutput}` : null,
                };
            });

        if (requiredInputs.length > 0) {
            inputs.push({
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label,
                inputs: requiredInputs,
            });
        }
    }

    const outputs = [];
    for (const node of nodes) {
        const hasOutgoing = (outgoingEdges.get(node.id) || []).length > 0;
        if (hasOutgoing) continue;
        if (node.data?.isDummy && !node.data?.isBIDS) continue;

        const io = getToolIO(node.data);
        if (!io || io.isGeneric) continue;

        for (const out of io.outputs) {
            if (out.type === 'any') continue;
            outputs.push({
                nodeId: node.id,
                nodeLabel: node.data.displayLabel || node.data.label,
                name: out.name,
                label: out.label || out.name,
                type: out.type,
                extensions: out.extensions || [],
            });
        }
    }

    return { inputs, outputs };
}
