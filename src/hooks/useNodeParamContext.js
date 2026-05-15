import { useMemo } from 'react';
import { buildArrayTypedInputs, computeScatteredNodes } from '../utils/scatterPropagation.js';

/**
 * Shared per-node context computations used by both AuxTabRenderer (when a
 * param tab is mounted in the main editor area) and SidebarParamContent (when
 * the same panel is mounted in the left sidebar's Params tab). Extracted to
 * keep the two consumers behaviourally identical — same Maps, Sets, and flags.
 */

/**
 * Per-input wiring + scatter propagation context for a single tool node.
 *
 * @param {Object|null|undefined} workspace  The active workspace (with .nodes / .edges).
 * @param {string|null|undefined} nodeId     The id of the tool node being edited.
 * @returns {{
 *   wiredInputs: Map<string, Array<{sourceNodeId: string, sourceNodeLabel: string, sourceOutput: string}>>,
 *   upstreamScatterInputs: Set<string>,
 *   isGatherNode: boolean,
 *   isScatterInherited: boolean,
 * }}
 */
export function useToolParamContext(workspace, nodeId) {
    return useMemo(() => {
        const empty = {
            wiredInputs: new Map(),
            upstreamScatterInputs: new Set(),
            isGatherNode: false,
            isScatterInherited: false,
        };
        if (!workspace || !nodeId) return empty;
        const wsNodes = workspace.nodes || [];
        const wsEdges = workspace.edges || [];

        // Per-input wiring for this target node only.
        const wired = new Map();
        const nodeById = new Map(wsNodes.map((n) => [n.id, n]));
        for (const edge of wsEdges) {
            if (edge.target !== nodeId) continue;
            const srcNode = nodeById.get(edge.source);
            if (!srcNode) continue;
            for (const m of edge.data?.mappings || []) {
                if (!wired.has(m.targetInput)) wired.set(m.targetInput, []);
                wired.get(m.targetInput).push({
                    sourceNodeId: edge.source,
                    sourceNodeLabel: srcNode.data?.label || srcNode.data?.displayLabel || 'unknown',
                    sourceOutput: m.sourceOutput,
                });
            }
        }

        // Scatter propagation — same algorithm as workflowCanvas. Filter to real (non-dummy) nodes.
        const realNodes = wsNodes.filter((n) => !n.data?.isDummy);
        const realIds = new Set(realNodes.map((n) => n.id));
        const realEdges = wsEdges.filter((e) => realIds.has(e.source) && realIds.has(e.target));
        const arrayTypedInputs = buildArrayTypedInputs(realNodes);
        const { scatteredNodeIds, scatteredUpstreamInputs, gatherNodeIds } = computeScatteredNodes(
            realNodes,
            realEdges,
            arrayTypedInputs,
        );
        return {
            wiredInputs: wired,
            upstreamScatterInputs: scatteredUpstreamInputs.get(nodeId) || new Set(),
            isGatherNode: gatherNodeIds.has(nodeId),
            isScatterInherited: scatteredNodeIds.has(nodeId),
        };
    }, [workspace, nodeId]);
}

/**
 * Internal-edge wiring for a custom workflow node. Walks `node.data.internalEdges`
 * and builds Map<"${targetNodeId}/${inputName}", sources[]> — the shape
 * CustomWorkflowParamPanel expects via its `wiredInputs` prop.
 *
 * @param {Object|null|undefined} node  The custom workflow ReactFlow node.
 * @returns {Map<string, Array<{sourceNodeLabel: string, sourceOutput: string}>>}
 */
export function useCustomWorkflowWiredInputs(node) {
    return useMemo(() => {
        const map = new Map();
        if (!node) return map;
        const internalEdges = node.data?.internalEdges || [];
        const internalNodes = node.data?.internalNodes || [];
        const nodeById = new Map(internalNodes.map((n) => [n.id, n]));
        for (const edge of internalEdges) {
            const srcNode = nodeById.get(edge.source);
            if (!srcNode) continue;
            for (const m of edge.data?.mappings || []) {
                const key = `${edge.target}/${m.targetInput}`;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push({
                    sourceNodeLabel: srcNode.label || srcNode.displayLabel || 'unknown',
                    sourceOutput: m.sourceOutput,
                });
            }
        }
        return map;
    }, [node]);
}
