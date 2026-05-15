import { useRef, useCallback } from 'react';

/**
 * In-memory clipboard for canvas copy/paste.
 *
 * Holds a single `{ nodes, edges }` payload in a ref so reads/writes don't
 * trigger re-renders. Clipboard contents persist across workspace switches by
 * design — cross-workspace paste is a useful gesture.
 *
 * `copy` strips the per-node callback closures (functions can't be cloned and
 * would re-bind to stale ids anyway). The paste site is responsible for fresh
 * UUIDs and re-attaching callbacks against the new ids.
 *
 * Edges are filtered to those whose **both** endpoints are in the selection —
 * an edge with one endpoint cut is meaningless, so we drop it.
 */
export function useCanvasClipboard() {
    const clipboardRef = useRef(null); // { nodes, edges } | null

    const copy = useCallback((selectedIds, allNodes, allEdges) => {
        if (!selectedIds || selectedIds.length === 0) return false;
        const idSet = new Set(selectedIds);

        const nodes = allNodes
            .filter((n) => idSet.has(n.id))
            .map((n) => {
                // Strip non-cloneable callback closures before structuredClone.
                const {
                    onSaveParameters,
                    onSaveIO,
                    onUpdateBIDS,
                    onUpdateInternalBIDS,
                    onUpdateStandardTemplate,
                    onSaveOutputConfig,
                    ...data
                } = n.data || {};
                // Suppress unused-var warnings; this destructure exists to discard the callbacks.
                void onSaveParameters;
                void onSaveIO;
                void onUpdateBIDS;
                void onUpdateInternalBIDS;
                void onUpdateStandardTemplate;
                void onSaveOutputConfig;
                return {
                    id: n.id,
                    type: n.type,
                    position: { ...n.position },
                    data: structuredClone(data),
                };
            });

        const edges = allEdges
            .filter((e) => idSet.has(e.source) && idSet.has(e.target))
            .map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                data: structuredClone(e.data || { mappings: [] }),
            }));

        if (nodes.length === 0) return false;
        clipboardRef.current = { nodes, edges };
        return true;
    }, []);

    const read = useCallback(() => clipboardRef.current, []);

    const hasClipboard = useCallback(() => clipboardRef.current !== null, []);

    return { copy, read, hasClipboard };
}
