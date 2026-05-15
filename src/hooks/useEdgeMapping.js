import { useState, useCallback } from 'react';
import { MarkerType } from 'reactflow';

const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

/**
 * Edge mapping modal state and handlers for the workflow canvas.
 *
 * Owns the modal-open / pending-connection / editing-edge state and exposes
 * ReactFlow-compatible handlers:
 *   - `onConnect`           — when the user drags a new connection.
 *   - `onEdgeDoubleClick`   — when the user opens an existing edge to re-map.
 *   - `handleEdgeMappingSave` — modal-save callback; creates or updates the edge.
 *   - `handleEdgeModalClose`  — modal-cancel callback.
 *   - `handleEdgesChange`     — wraps ReactFlow's `onEdgesChange` and marks the
 *                               workspace dirty when an edge is removed.
 *
 * @param {Map<string, object>} nodeMap        - useNodeLookup result for O(1) access.
 * @param {Function}            setEdges       - ReactFlow setter for edges.
 * @param {Function}            onEdgesChange  - ReactFlow's underlying onEdgesChange.
 * @param {object}              scatterContext - Scatter propagation context (for sourceIsScattered).
 * @param {() => void}          markForSync    - flag the workspace as dirty.
 * @returns {{ modalState, onConnect, onEdgeDoubleClick, handleEdgeMappingSave,
 *             handleEdgeModalClose, handleEdgesChange }}
 */
export function useEdgeMapping(nodeMap, setEdges, onEdgesChange, scatterContext, markForSync) {
    const [showEdgeModal, setShowEdgeModal] = useState(false);
    const [pendingConnection, setPendingConnection] = useState(null);
    const [editingEdge, setEditingEdge] = useState(null);
    const [edgeModalData, setEdgeModalData] = useState(null);

    const buildEdgeModalNode = useCallback(
        (node) => ({
            id: node.id,
            label: node.data.label,
            isDummy: node.data.isDummy || false,
            isBIDS: node.data.isBIDS || false,
            bidsSelections: node.data.bidsSelections || null,
            isStandardTemplate: node.data.isStandardTemplate || false,
            templateId: node.data.templateId || null,
            template: node.data.template || null,
            isCustomWorkflow: node.data.isCustomWorkflow || false,
            internalNodes: node.data.internalNodes || [],
            internalEdges: node.data.internalEdges || [],
            isScattered: scatterContext.propagatedIds.has(node.id),
        }),
        [scatterContext],
    );

    const onConnect = useCallback(
        (connection) => {
            setPendingConnection(connection);
            setEditingEdge(null);

            const sourceNode = nodeMap.get(connection.source);
            const targetNode = nodeMap.get(connection.target);

            if (sourceNode && targetNode) {
                setEdgeModalData({
                    sourceNode: buildEdgeModalNode(sourceNode),
                    targetNode: buildEdgeModalNode(targetNode),
                    existingMappings: [],
                });
                setShowEdgeModal(true);
            }
        },
        [nodeMap, buildEdgeModalNode],
    );

    const onEdgeDoubleClick = useCallback(
        (event, edge) => {
            event.stopPropagation();
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);

            if (sourceNode && targetNode) {
                setEditingEdge(edge);
                setPendingConnection(null);
                setEdgeModalData({
                    sourceNode: buildEdgeModalNode(sourceNode),
                    targetNode: buildEdgeModalNode(targetNode),
                    existingMappings: edge.data?.mappings || [],
                });
                setShowEdgeModal(true);
            }
        },
        [nodeMap, buildEdgeModalNode],
    );

    const handleEdgeMappingSave = useCallback(
        (mappings) => {
            if (editingEdge) {
                setEdges((eds) =>
                    eds.map((e) => (e.id === editingEdge.id ? { ...e, data: { ...e.data, mappings } } : e)),
                );
            } else if (pendingConnection) {
                const newEdge = {
                    id: `${pendingConnection.source}-${pendingConnection.target}-${crypto.randomUUID()}`,
                    source: pendingConnection.source,
                    target: pendingConnection.target,
                    animated: true,
                    markerEnd: EDGE_ARROW,
                    style: { strokeWidth: 2 },
                    data: { mappings },
                };
                setEdges((eds) => [...eds, newEdge]);
            }

            markForSync();

            setShowEdgeModal(false);
            setPendingConnection(null);
            setEditingEdge(null);
            setEdgeModalData(null);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pendingConnection, editingEdge],
    );

    const handleEdgeModalClose = useCallback(() => {
        setShowEdgeModal(false);
        setPendingConnection(null);
        setEditingEdge(null);
        setEdgeModalData(null);
    }, []);

    const handleEdgesChange = useCallback(
        (changes) => {
            onEdgesChange(changes);
            const deletions = changes.filter((c) => c.type === 'remove');
            if (deletions.length > 0) {
                markForSync();
            }
        },
        [onEdgesChange, markForSync],
    );

    return {
        modalState: { showEdgeModal, edgeModalData },
        onConnect,
        onEdgeDoubleClick,
        handleEdgeMappingSave,
        handleEdgeModalClose,
        handleEdgesChange,
    };
}
