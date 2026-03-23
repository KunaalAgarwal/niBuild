/**
 * Workflow serialization and diff utilities.
 * Moved from main.jsx and extended with structured diff computation.
 */
import { computeScatteredNodes, buildArrayTypedInputs } from './scatterPropagation.js';
import { topoSort } from './topoSort.js';

/** Get the Set of IDs for dummy nodes (supports both flat and data-nested shapes). */
export const getDummyIds = (nodes) => new Set(nodes.filter((n) => n.isDummy || n.data?.isDummy).map((n) => n.id));

/**
 * Compute boundary nodes (first/last non-dummy in topological order)
 * for a set of internal nodes and edges.
 */
export function computeBoundaryNodes(nodes, edges) {
    const nonDummyNodes = nodes.filter((n) => !n.isDummy && !n.data?.isDummy);
    if (nonDummyNodes.length === 0) return { firstNonDummy: null, lastNonDummy: null };

    const dummyIds = getDummyIds(nodes);
    const realEdges = edges.filter((e) => !dummyIds.has(e.source) && !dummyIds.has(e.target));

    let order;
    try {
        order = topoSort(nonDummyNodes, realEdges);
    } catch {
        return { firstNonDummy: null, lastNonDummy: null };
    }

    const nodeById = new Map(nonDummyNodes.map((n) => [n.id, n]));
    const firstNode = nodeById.get(order[0]);
    const lastNode = nodeById.get(order[order.length - 1]);

    return {
        firstNonDummy: firstNode?.label || firstNode?.data?.label || null,
        lastNonDummy: lastNode?.label || lastNode?.data?.label || null,
    };
}

/**
 * Serialize workspace nodes for saving as a custom workflow.
 * Strips non-serializable data (callbacks) and normalizes shape.
 */
export function serializeNodes(nodes) {
    return nodes.map((n) => ({
        id: n.id,
        label: n.data?.label || n.label || '',
        isDummy: n.data?.isDummy || n.isDummy || false,
        isBIDS: n.data?.isBIDS || n.isBIDS || false,
        bidsStructure: n.data?.bidsStructure || n.bidsStructure || null,
        bidsSelections: n.data?.bidsSelections || n.bidsSelections || null,
        notes: n.data?.notes || n.notes || '',
        parameters: n.data?.parameters || n.parameters || {},
        dockerVersion: n.data?.dockerVersion || n.dockerVersion || 'latest',
        scatterInputs: n.data?.scatterInputs ?? n.scatterInputs,
        scatterMethod: n.data?.scatterMethod || n.scatterMethod,
        linkMergeOverrides: n.data?.linkMergeOverrides || n.linkMergeOverrides || {},
        whenExpression: n.data?.whenExpression || n.whenExpression || '',
        expressions: n.data?.expressions || n.expressions || {},
        operationOrder: n.data?.operationOrder || n.operationOrder || [],
        position: n.position || { x: 0, y: 0 },
    }));
}

/**
 * Convert a serialized (flat) node back into ReactFlow canvas format.
 * Single source of truth for deserialization — used by main.jsx and buildWorkflow.js.
 */
export function deserializeNode(n) {
    return {
        id: n.id,
        type: 'default',
        data: {
            label: n.label,
            isDummy: n.isDummy || false,
            isBIDS: n.isBIDS || false,
            bidsStructure: n.bidsStructure || null,
            bidsSelections: n.bidsSelections || null,
            notes: n.notes || '',
            parameters: n.parameters || {},
            dockerVersion: n.dockerVersion || 'latest',
            scatterInputs: n.scatterInputs,
            scatterMethod: n.scatterMethod,
            linkMergeOverrides: n.linkMergeOverrides || {},
            whenExpression: n.whenExpression || '',
            expressions: n.expressions || {},
            operationOrder: n.operationOrder || [],
        },
        position: n.position || { x: 0, y: 0 },
    };
}

export function serializeEdges(edges) {
    return edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: { mappings: e.data?.mappings || [] },
    }));
}

/**
 * Compare workspace content against a saved custom workflow (ignoring node positions).
 * Returns true if there are differences (unsaved changes).
 */
export function hasUnsavedChanges(workspace, savedWorkflow) {
    if (!workspace || !savedWorkflow) return false;

    if ((workspace.workflowName || '') !== (savedWorkflow.name || '')) return true;
    if ((workspace.name || '') !== (savedWorkflow.outputName || '')) return true;

    const wsNodes = serializeNodes(workspace.nodes || []).map(({ position, ...rest }) => rest);
    const savedNodes = serializeNodes(savedWorkflow.nodes || []).map(({ position, ...rest }) => rest);

    const wsEdges = serializeEdges(workspace.edges || []);
    const savedEdges = serializeEdges(savedWorkflow.edges || []);

    return (
        JSON.stringify(wsNodes) !== JSON.stringify(savedNodes) || JSON.stringify(wsEdges) !== JSON.stringify(savedEdges)
    );
}

/* ── Diff helpers ─────────────────────────────────────────────── */

const DISPLAY_NAMES = {
    dockerVersion: 'Docker Version',
    scatterInputs: 'Scatter',
    scatterMethod: 'Scatter Method',
    linkMergeOverrides: 'Multiple Input',
    whenExpression: 'Conditional',
    expressions: 'Expressions',
    parameters: 'Parameters',
    notes: 'Notes',
    label: 'Label',
    isDummy: 'I/O Node',
    isBIDS: 'BIDS Node',
    bidsStructure: 'BIDS Structure',
    bidsSelections: 'BIDS Selections',
    operationOrder: 'Operation Order',
};

/** Properties compared per-node, by node type. */
const IO_NODE_PROPS = ['label', 'notes'];
const BIDS_NODE_PROPS = ['label', 'notes', 'bidsSelections'];
const OPERATIONAL_NODE_PROPS = [
    'label',
    'parameters',
    'dockerVersion',
    'whenExpression',
    'expressions',
    'scatterInputs',
    'scatterMethod',
    'linkMergeOverrides',
    'operationOrder',
    'notes',
];

function getCompareProps(node) {
    if (node.isBIDS) return BIDS_NODE_PROPS;
    if (node.isDummy) return IO_NODE_PROPS;
    return OPERATIONAL_NODE_PROPS;
}

/** Properties that are key-value objects and should get sub-property drilling. */
const OBJECT_PROPS = new Set(['parameters', 'expressions', 'linkMergeOverrides', 'bidsSelections']);

function valuesEqual(a, b) {
    if (a === b) return true;
    if (a == null && b == null) return true;
    return JSON.stringify(a) === JSON.stringify(b);
}

function formatValue(v) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

/**
 * Compute sub-property diffs for key-value objects (parameters, expressions, etc.).
 * @param {string} [parentProp] - parent property name, used to format values (e.g. linkMergeOverrides)
 */
function diffObject(saved, current, parentProp) {
    const savedObj = saved && typeof saved === 'object' ? saved : {};
    const currentObj = current && typeof current === 'object' ? current : {};
    const allKeys = new Set([...Object.keys(savedObj), ...Object.keys(currentObj)]);
    const subChanges = [];
    const isLinkMerge = parentProp === 'linkMergeOverrides';

    for (const key of allKeys) {
        const sVal = savedObj[key];
        const cVal = currentObj[key];
        if (!valuesEqual(sVal, cVal)) {
            subChanges.push({
                key,
                saved: isLinkMerge ? (sVal ? formatMergeMethod(sVal) : null) : formatValue(sVal),
                current: isLinkMerge ? (cVal ? formatMergeMethod(cVal) : null) : formatValue(cVal),
                type: sVal === undefined ? 'added' : cVal === undefined ? 'removed' : 'modified',
            });
        }
    }
    return subChanges;
}

/**
 * Compute per-property diffs between two serialized nodes.
 */
function diffNode(savedNode, currentNode) {
    const compareProps = getCompareProps(currentNode);
    const changes = [];
    for (const prop of compareProps) {
        const sVal = savedNode[prop];
        const cVal = currentNode[prop];
        if (!valuesEqual(sVal, cVal)) {
            const change = {
                property: prop,
                displayName: DISPLAY_NAMES[prop] || prop,
                saved: formatValue(sVal),
                current: formatValue(cVal),
            };
            if (OBJECT_PROPS.has(prop)) {
                change.subChanges = diffObject(sVal, cVal, prop);
            }
            changes.push(change);
        }
    }
    return changes;
}

/* ── Multi-input helpers ─────────────────────────────────────── */

const MERGE_METHOD_LABELS = {
    merge_flattened: 'Merge Flattened',
    merge_nested: 'Merge Nested',
};

function formatMergeMethod(method) {
    return MERGE_METHOD_LABELS[method] || method || 'Merge Flattened';
}

/**
 * Build a map of which target node inputs have multiple sources wired to them.
 * Returns Map<targetNodeId, Set<inputName>> for inputs with >1 source.
 */
function buildMultiSourceMap(edges) {
    // Count sources per (targetNode, inputName)
    const counts = new Map(); // nodeId → Map<inputName, count>
    for (const edge of edges) {
        const mappings = edge.data?.mappings || [];
        for (const m of mappings) {
            if (!counts.has(edge.target)) counts.set(edge.target, new Map());
            const nodeMap = counts.get(edge.target);
            nodeMap.set(m.targetInput, (nodeMap.get(m.targetInput) || 0) + 1);
        }
    }
    // Filter to only multi-source inputs
    const result = new Map();
    for (const [nodeId, inputMap] of counts) {
        const multiInputs = new Set();
        for (const [inputName, count] of inputMap) {
            if (count > 1) multiInputs.add(inputName);
        }
        if (multiInputs.size > 0) result.set(nodeId, multiInputs);
    }
    return result;
}

/* ── Scatter propagation helpers ──────────────────────────────── */

/** Check if a flat node is itself a scatter source (not just downstream-propagated). */
function isScatterSource(flatNode) {
    if (!flatNode) return false;
    if (flatNode.scatterInputs?.length > 0) return true;
    if (flatNode.isBIDS && flatNode.bidsSelections) return true;
    return false;
}

/**
 * Wrap flat-shape nodes into the { id, data: {...} } shape that
 * computeScatteredNodes expects, then run propagation.
 */
function computePropagation(flatNodes, flatEdges) {
    // Wrap flat nodes → { id, data: { ... } }
    const wrappedNodes = flatNodes.map((n) => ({
        id: n.id,
        data: {
            label: n.label,
            isDummy: n.isDummy,
            isBIDS: n.isBIDS,
            scatterInputs: n.scatterInputs,
            bidsSelections: n.bidsSelections,
            isCustomWorkflow: n.isCustomWorkflow,
            internalNodes: n.internalNodes,
        },
    }));

    // Filter out non-BIDS dummy nodes and their edges (same as workflowCanvas.jsx)
    const dummyIds = new Set(wrappedNodes.filter((n) => n.data.isDummy && !n.data.isBIDS).map((n) => n.id));
    const realNodes = wrappedNodes.filter((n) => !n.data.isDummy || n.data.isBIDS);
    const realEdges = flatEdges.filter((e) => !dummyIds.has(e.source) && !dummyIds.has(e.target));

    const arrayTypedInputs = buildArrayTypedInputs(flatNodes);
    return computeScatteredNodes(realNodes, realEdges, arrayTypedInputs);
}

/**
 * Compute structured diff between a saved workflow and the current workspace.
 *
 * @param {Object} savedWorkflow - The saved custom workflow { name, outputName, nodes, edges, ... }
 * @param {Object} currentWorkspace - The current workspace { workflowName, name, nodes, edges, ... }
 * @returns {Object} Structured diff object
 */
export function computeWorkflowDiff(savedWorkflow, currentWorkspace) {
    const result = {
        metadata: [],
        nodes: { added: [], removed: [], modified: [] },
        edges: { added: [], removed: [], modified: [] },
        hasDifferences: false,
    };

    // ── Metadata ────────────────────────────────────────────────
    const savedName = savedWorkflow.name || '';
    const currentName = currentWorkspace.workflowName || '';
    if (savedName !== currentName) {
        result.metadata.push({ field: 'Workflow Name', saved: savedName, current: currentName });
    }

    const savedOutput = savedWorkflow.outputName || '';
    const currentOutput = currentWorkspace.name || '';
    if (savedOutput !== currentOutput) {
        result.metadata.push({ field: 'Output Name', saved: savedOutput, current: currentOutput });
    }

    // ── Nodes ───────────────────────────────────────────────────
    const wsNodes = serializeNodes(currentWorkspace.nodes || []);
    const savedNodes = savedWorkflow.nodes || [];

    // Strip position for comparison
    const wsNodesClean = wsNodes.map(({ position, ...rest }) => rest);
    const savedNodesClean = savedNodes.map(({ position, ...rest }) => rest);

    const savedNodeMap = new Map(savedNodesClean.map((n) => [n.id, n]));
    const currentNodeMap = new Map(wsNodesClean.map((n) => [n.id, n]));

    // Build label lookup for edge display (combine both sets)
    const nodeLabelMap = new Map();
    for (const n of savedNodesClean) nodeLabelMap.set(n.id, n.label);
    for (const n of wsNodesClean) nodeLabelMap.set(n.id, n.label);

    for (const [id, node] of currentNodeMap) {
        if (!savedNodeMap.has(id)) {
            result.nodes.added.push(node);
        } else {
            const changes = diffNode(savedNodeMap.get(id), node);
            if (changes.length > 0) {
                result.nodes.modified.push({
                    id,
                    label: node.label,
                    savedLabel: savedNodeMap.get(id).label,
                    isDummy: node.isDummy,
                    isBIDS: node.isBIDS,
                    changes,
                });
            }
        }
    }

    for (const [id, node] of savedNodeMap) {
        if (!currentNodeMap.has(id)) {
            result.nodes.removed.push(node);
        }
    }

    // ── Edges ───────────────────────────────────────────────────
    const wsEdges = serializeEdges(currentWorkspace.edges || []);
    const savedEdges = serializeEdges(savedWorkflow.edges || []);

    const savedEdgeMap = new Map(savedEdges.map((e) => [e.id, e]));
    const currentEdgeMap = new Map(wsEdges.map((e) => [e.id, e]));

    for (const [id, edge] of currentEdgeMap) {
        const enriched = {
            ...edge,
            sourceLabel: nodeLabelMap.get(edge.source) || edge.source,
            targetLabel: nodeLabelMap.get(edge.target) || edge.target,
        };
        if (!savedEdgeMap.has(id)) {
            result.edges.added.push(enriched);
        } else {
            const savedEdge = savedEdgeMap.get(id);
            const changes = [];
            if (edge.source !== savedEdge.source) {
                changes.push({ property: 'source', saved: savedEdge.source, current: edge.source });
            }
            if (edge.target !== savedEdge.target) {
                changes.push({ property: 'target', saved: savedEdge.target, current: edge.target });
            }
            if (!valuesEqual(edge.data?.mappings, savedEdge.data?.mappings)) {
                changes.push({
                    property: 'mappings',
                    saved: savedEdge.data?.mappings || [],
                    current: edge.data?.mappings || [],
                });
            }
            if (changes.length > 0) {
                result.edges.modified.push({ ...enriched, changes });
            }
        }
    }

    for (const [id, edge] of savedEdgeMap) {
        if (!currentEdgeMap.has(id)) {
            result.edges.removed.push({
                ...edge,
                sourceLabel: nodeLabelMap.get(edge.source) || edge.source,
                targetLabel: nodeLabelMap.get(edge.target) || edge.target,
            });
        }
    }

    // ── Helper to find or create a modified node entry ─────────
    const addedIds = new Set(result.nodes.added.map((n) => n.id));
    const removedIds = new Set(result.nodes.removed.map((n) => n.id));
    const modifiedById = new Map(result.nodes.modified.map((n) => [n.id, n]));

    function getOrCreateModified(nodeId) {
        if (modifiedById.has(nodeId)) return modifiedById.get(nodeId);
        const currentNode = currentNodeMap.get(nodeId);
        const savedNode = savedNodeMap.get(nodeId);
        const entry = {
            id: nodeId,
            label: currentNode?.label || savedNode?.label || nodeLabelMap.get(nodeId) || nodeId,
            savedLabel: savedNode?.label || currentNode?.label || nodeId,
            isDummy: currentNode?.isDummy || savedNode?.isDummy || false,
            isBIDS: currentNode?.isBIDS || savedNode?.isBIDS || false,
            changes: [],
        };
        modifiedById.set(nodeId, entry);
        result.nodes.modified.push(entry);
        return entry;
    }

    // ── Scatter Propagation (folded into node diffs) ──────────
    const savedProp = computePropagation(savedNodesClean, savedEdges);
    const currentProp = computePropagation(wsNodesClean, wsEdges);

    for (const id of currentProp.scatteredNodeIds) {
        if (!savedProp.scatteredNodeIds.has(id) && !addedIds.has(id) && !removedIds.has(id)) {
            if (isScatterSource(currentNodeMap.get(id))) continue;
            getOrCreateModified(id).changes.push({
                property: 'scatterPropagation',
                displayName: 'Scatter',
                saved: null,
                current: 'Propagated from upstream',
            });
        }
    }
    for (const id of savedProp.scatteredNodeIds) {
        if (!currentProp.scatteredNodeIds.has(id) && !addedIds.has(id) && !removedIds.has(id)) {
            if (isScatterSource(savedNodeMap.get(id))) continue;
            getOrCreateModified(id).changes.push({
                property: 'scatterPropagation',
                displayName: 'Scatter',
                saved: 'Propagated from upstream',
                current: null,
            });
        }
    }
    for (const id of currentProp.gatherNodeIds) {
        if (!savedProp.gatherNodeIds.has(id) && !addedIds.has(id) && !removedIds.has(id)) {
            getOrCreateModified(id).changes.push({
                property: 'gatherStatus',
                displayName: 'Gather',
                saved: null,
                current: 'Gathers scattered inputs',
            });
        }
    }
    for (const id of savedProp.gatherNodeIds) {
        if (!currentProp.gatherNodeIds.has(id) && !addedIds.has(id) && !removedIds.has(id)) {
            getOrCreateModified(id).changes.push({
                property: 'gatherStatus',
                displayName: 'Gather',
                saved: 'Gathers scattered inputs',
                current: null,
            });
        }
    }

    // ── Multi-Input Changes (folded into node diffs) ──────────
    const savedMultiSource = buildMultiSourceMap(savedEdges);
    const currentMultiSource = buildMultiSourceMap(wsEdges);
    const allMultiSourceNodeIds = new Set([...savedMultiSource.keys(), ...currentMultiSource.keys()]);

    for (const nodeId of allMultiSourceNodeIds) {
        if (addedIds.has(nodeId) || removedIds.has(nodeId)) continue;

        const savedInputs = savedMultiSource.get(nodeId) || new Set();
        const currentInputs = currentMultiSource.get(nodeId) || new Set();
        const allInputNames = new Set([...savedInputs, ...currentInputs]);

        const savedNode = savedNodeMap.get(nodeId);
        const currentNode = currentNodeMap.get(nodeId);
        const nodeOverrides = currentNode?.linkMergeOverrides || {};
        const savedOverrides = savedNode?.linkMergeOverrides || {};

        const subChanges = [];
        for (const inputName of allInputNames) {
            const wasMerged = savedInputs.has(inputName);
            const isMerged = currentInputs.has(inputName);

            if (isMerged && !wasMerged) {
                subChanges.push({
                    key: inputName,
                    saved: null,
                    current: formatMergeMethod(nodeOverrides[inputName]),
                    type: 'added',
                });
            } else if (!isMerged && wasMerged) {
                subChanges.push({
                    key: inputName,
                    saved: formatMergeMethod(savedOverrides[inputName]),
                    current: null,
                    type: 'removed',
                });
            } else if (isMerged && wasMerged) {
                const savedMethod = savedOverrides[inputName] || 'merge_flattened';
                const currentMethod = nodeOverrides[inputName] || 'merge_flattened';
                if (savedMethod !== currentMethod) {
                    subChanges.push({
                        key: inputName,
                        saved: formatMergeMethod(savedMethod),
                        current: formatMergeMethod(currentMethod),
                        type: 'modified',
                    });
                }
            }
        }

        if (subChanges.length > 0) {
            getOrCreateModified(nodeId).changes.push({
                property: 'multiInput',
                displayName: 'Multiple Input',
                subChanges,
            });
        }
    }

    // ── Summary ─────────────────────────────────────────────────
    result.hasDifferences =
        result.metadata.length > 0 ||
        result.nodes.added.length > 0 ||
        result.nodes.removed.length > 0 ||
        result.nodes.modified.length > 0 ||
        result.edges.added.length > 0 ||
        result.edges.removed.length > 0 ||
        result.edges.modified.length > 0;

    return result;
}
