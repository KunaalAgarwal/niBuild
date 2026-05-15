import { useEffect } from 'react';

/**
 * Reactive sync for on-canvas custom workflow (composite) nodes.
 *
 * When the saved `customWorkflows` list changes — a saved workflow was edited
 * elsewhere or deleted — this effect mutates the on-canvas composite nodes to
 * match:
 *
 *   - If the saved entry is gone, the composite node is removed and any edges
 *     touching it are cleaned up.
 *   - If the saved entry's name, internal nodes, or validation status changed,
 *     the composite node's mirror copy of that data is refreshed.
 *
 * The shallow-check (node count + ids + labels + name + warnings) avoids the
 * cost of a full deep compare on every customWorkflows tick. The dep array is
 * intentionally just `[customWorkflows]` — `nodes` is read but not in deps to
 * avoid re-running the sweep on every node mutation; the latest snapshot is
 * captured at fire time, which is the correct semantics here.
 *
 * @param {Array}    nodes
 * @param {Array}    customWorkflows
 * @param {Function} setNodes
 * @param {Function} setEdges
 * @param {() => void} markForSync
 */
export function useCustomWorkflowSync(nodes, customWorkflows, setNodes, setEdges, markForSync) {
    useEffect(() => {
        if (!customWorkflows) return;

        let changed = false;
        const removedIds = new Set();
        const updatedNodes = nodes
            .map((node) => {
                if (!node.data?.isCustomWorkflow || !node.data?.customWorkflowId) return node;
                const saved = customWorkflows.find((w) => w.id === node.data.customWorkflowId);
                if (!saved) {
                    changed = true;
                    removedIds.add(node.id);
                    return null;
                }

                const cur = node.data.internalNodes || [];
                const sav = saved.nodes || [];
                const nodesMatch =
                    cur.length === sav.length &&
                    cur.every(
                        (n, i) =>
                            n.id === sav[i]?.id &&
                            (n.label ?? n.data?.label) === (sav[i]?.label ?? sav[i]?.data?.label),
                    );
                if (
                    nodesMatch &&
                    node.data.label === saved.name &&
                    node.data.hasValidationWarnings === saved.hasValidationWarnings
                ) {
                    return node;
                }

                changed = true;
                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: saved.name,
                        internalNodes: structuredClone(saved.nodes),
                        internalEdges: structuredClone(saved.edges),
                        boundaryNodes: { ...saved.boundaryNodes },
                        hasValidationWarnings: saved.hasValidationWarnings,
                    },
                };
            })
            .filter(Boolean);

        if (changed) {
            if (removedIds.size > 0) {
                setEdges((prev) => prev.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target)));
            }
            setNodes(updatedNodes);
            markForSync();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customWorkflows]);
}
