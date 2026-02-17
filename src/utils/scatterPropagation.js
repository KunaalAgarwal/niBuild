/**
 * Compute which nodes are scattered (either directly enabled or inherited from upstream).
 * Uses adjacency map for O(V+E) performance.
 *
 * @param {Array} nodes - Array of nodes with { id, data: { scatterEnabled } }
 * @param {Array} edges - Array of edges with { source, target }
 * @returns {{ scatteredNodeIds: Set<string>, sourceNodeIds: Set<string> }}
 */
export function computeScatteredNodes(nodes, edges) {
    // Compute source node IDs (nodes with no incoming edges)
    const targetIds = new Set(edges.map(e => e.target));
    const sourceNodeIds = new Set(
        nodes.filter(n => !targetIds.has(n.id)).map(n => n.id)
    );

    // Build adjacency list (outgoing edges per node) for O(V+E) traversal
    const outgoing = new Map();
    for (const node of nodes) {
        outgoing.set(node.id, []);
    }
    for (const edge of edges) {
        outgoing.get(edge.source)?.push(edge.target);
    }

    // BFS from scatter-enabled source nodes, propagating to all downstream
    const scatteredNodeIds = new Set();
    const queue = [];
    for (const node of nodes) {
        if (node.data?.scatterEnabled && sourceNodeIds.has(node.id)) {
            scatteredNodeIds.add(node.id);
            queue.push(node.id);
        }
    }

    while (queue.length) {
        const nodeId = queue.shift();
        for (const targetId of (outgoing.get(nodeId) || [])) {
            if (!scatteredNodeIds.has(targetId)) {
                scatteredNodeIds.add(targetId);
                queue.push(targetId);
            }
        }
    }

    return { scatteredNodeIds, sourceNodeIds };
}
