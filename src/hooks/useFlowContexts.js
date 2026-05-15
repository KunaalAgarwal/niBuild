import { useMemo, useEffect, useRef } from 'react';

import { computeScatteredNodes, buildArrayTypedInputs } from '../utils/scatterPropagation.js';
import { getToolConfigSync } from '../utils/toolRegistry.js';

const FLATTEN = '$(self.flat())';

/**
 * Derived flow state for the workflow canvas:
 *
 *   - `scatterContext` — { propagatedIds, sourceNodeIds, scatteredUpstreamInputs, gatherNodeIds }
 *     identifies which nodes inherit scatter from upstream (BFS propagation).
 *     BIDS nodes participate (they output File[] arrays); regular dummy nodes don't.
 *   - `wiredContext` — Map<nodeId, Map<inputName, sourceInfo[]>> describing which
 *     inputs on each node are wired from upstream edge mappings.
 *   - `flattenInputs` — Map<nodeId, Set<inputName>> of inputs that need a
 *     `$(self.flat())` expression because their upstream is scattered + array-typed.
 *
 * Side effect: when `flattenInputs` changes, the hook syncs the corresponding
 * flatten expressions into `node.data.expressions` (adding new ones, removing
 * stale ones) and calls `markForSync`. A stable key over `flattenInputs` short-
 * circuits identity-only changes to avoid render loops.
 *
 * @param {Array}                nodes
 * @param {Array}                edges
 * @param {Map<string, object>}  nodeMap     - useNodeLookup result for O(1) access.
 * @param {Function}             setNodes    - ReactFlow setter; used by the flatten sync.
 * @param {() => void}           markForSync - flag the workspace as dirty.
 * @returns {{ scatterContext, wiredContext, flattenInputs }}
 */
export function useFlowContexts(nodes, edges, nodeMap, setNodes, markForSync) {
    // Compute which nodes inherit scatter from upstream (BFS propagation).
    // Used by NodeComponent via ScatterPropagationContext to show badges.
    // BIDS nodes participate in scatter (they output File[] arrays) but regular dummy nodes don't.
    const scatterContext = useMemo(() => {
        const dummyIds = new Set(nodes.filter((n) => n.data?.isDummy && !n.data?.isBIDS).map((n) => n.id));
        const realNodes = nodes.filter((n) => !n.data?.isDummy || n.data?.isBIDS);
        const realEdges = edges.filter((e) => !dummyIds.has(e.source) && !dummyIds.has(e.target));

        const arrayTypedInputs = buildArrayTypedInputs(realNodes);

        const { scatteredNodeIds, sourceNodeIds, scatteredUpstreamInputs, gatherNodeIds } = computeScatteredNodes(
            realNodes,
            realEdges,
            arrayTypedInputs,
        );
        return { propagatedIds: scatteredNodeIds, sourceNodeIds, scatteredUpstreamInputs, gatherNodeIds };
    }, [nodes, edges]);

    // Compute which inputs on each node are wired from upstream edge mappings.
    // Used by NodeComponent via WiredInputsContext to show wired/unwired state.
    // Value: Map<nodeId, Map<inputName, Array<{ sourceNodeId, sourceNodeLabel, sourceOutput }>>>
    const wiredContext = useMemo(() => {
        const wiredMap = new Map();
        edges.forEach((edge) => {
            if (!edge.data?.mappings) return;
            edge.data.mappings.forEach((mapping) => {
                if (!wiredMap.has(edge.target)) wiredMap.set(edge.target, new Map());
                const nodeInputs = wiredMap.get(edge.target);
                const sourceNode = nodeMap.get(edge.source);
                const sourceInfo = {
                    sourceNodeId: edge.source,
                    sourceNodeLabel: sourceNode?.data?.label || 'Unknown',
                    sourceOutput: mapping.sourceOutput,
                };
                if (nodeInputs.has(mapping.targetInput)) {
                    nodeInputs.get(mapping.targetInput).push(sourceInfo);
                } else {
                    nodeInputs.set(mapping.targetInput, [sourceInfo]);
                }
            });
        });
        return wiredMap;
    }, [edges, nodeMap]);

    // Detect inputs that need a flatten expression due to scattered array outputs.
    // When a scattered step produces an array type (e.g. File[]), scatter wraps it
    // in another array (File[][]). Downstream inputs expecting File[] need
    // $(self.flat()) to unwrap. Returns Map<nodeId, Set<inputName>>.
    const flattenInputs = useMemo(() => {
        const result = new Map();
        for (const [nodeId, inputMap] of wiredContext) {
            for (const [inputName, sources] of inputMap) {
                for (const src of sources) {
                    if (!scatterContext.propagatedIds.has(src.sourceNodeId)) continue;
                    const sourceNode = nodeMap.get(src.sourceNodeId);
                    if (!sourceNode || sourceNode.data?.isDummy) continue;
                    const sourceTool = getToolConfigSync(sourceNode.data.label);
                    if (!sourceTool) continue;
                    const outputDef = sourceTool.outputs?.[src.sourceOutput];
                    if (!outputDef?.type) continue;
                    const baseType = outputDef.type.replace(/\?$/, '');
                    if (baseType.endsWith('[]')) {
                        if (!result.has(nodeId)) result.set(nodeId, new Set());
                        result.get(nodeId).add(inputName);
                    }
                }
            }
        }
        return result;
    }, [wiredContext, scatterContext.propagatedIds, nodeMap]);

    // Sync flatten expressions into node.data.expressions so they appear in the UI.
    const prevFlattenKeyRef = useRef('');
    useEffect(() => {
        // Build a stable key to detect actual changes and avoid render loops.
        const parts = [];
        for (const [nodeId, inputs] of flattenInputs) {
            parts.push(nodeId + ':' + [...inputs].sort().join(','));
        }
        const key = parts.sort().join('|');
        if (key === prevFlattenKeyRef.current) return;
        prevFlattenKeyRef.current = key;

        setNodes((prev) => {
            let changed = false;
            const updated = prev.map((node) => {
                const needs = flattenInputs.get(node.id);
                const exprs = node.data.expressions || {};
                let newExprs = null;

                // Add flatten where needed and expression is empty or already flatten
                if (needs) {
                    for (const inputName of needs) {
                        if (!exprs[inputName] || exprs[inputName] === FLATTEN) {
                            if (exprs[inputName] !== FLATTEN) {
                                if (!newExprs) newExprs = { ...exprs };
                                newExprs[inputName] = FLATTEN;
                            }
                        }
                    }
                }

                // Remove stale flatten expressions
                for (const [inputName, expr] of Object.entries(exprs)) {
                    if (expr === FLATTEN && (!needs || !needs.has(inputName))) {
                        if (!newExprs) newExprs = { ...exprs };
                        delete newExprs[inputName];
                    }
                }

                if (newExprs) {
                    changed = true;
                    return { ...node, data: { ...node.data, expressions: newExprs } };
                }
                return node;
            });
            if (changed) {
                markForSync();
                return updated;
            }
            return prev;
        });
    }, [flattenInputs, setNodes, markForSync]);

    return { scatterContext, wiredContext, flattenInputs };
}
