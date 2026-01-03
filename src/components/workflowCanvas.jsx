import React, { useRef, useState, useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow';

import 'reactflow/dist/style.css';
import '../styles/workflowCanvas.css';
import '../styles/actionsBar.css';

import NodeComponent from './NodeComponent';
import EdgeMappingModal from './EdgeMappingModal';

// Define node types.
const nodeTypes = { default: NodeComponent };
// Define edge types.
const edgeTypes = {};

function WorkflowCanvas({ workflowItems, updateCurrentWorkspaceItems, onSetWorkflowData }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Edge mapping modal state
  const [showEdgeModal, setShowEdgeModal] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [edgeModalData, setEdgeModalData] = useState(null);

  // --- INITIALIZATION & Synchronization ---
  // This effect watches for changes in the persistent workspace.
  // When the clear workspace button is pressed, workflowItems becomes empty,
  // and this effect clears the canvas accordingly.
  useEffect(() => {
    if (workflowItems && typeof workflowItems.nodes !== 'undefined') {
      // Only update if the count of nodes in the persistent workspace differs from our local state.
      if (workflowItems.nodes.length !== nodes.length) {
        const initialNodes = (workflowItems.nodes || []).map((node) => ({
          ...node,
          data: {
            ...node.data,
            // Reattach the callback so the node remains interactive.
            onSaveParameters: (newParams) => handleNodeUpdate(node.id, newParams)
          }
        }));
        // Restore edges with styling and data (mappings)
        const initialEdges = (workflowItems.edges || []).map((edge) => ({
          ...edge,
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 10,
            height: 10,
          },
          style: { strokeWidth: 2 },
        }));
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    }
  }, [workflowItems, nodes.length]);

  // Helper: Update persistent workspace state.
  const updateWorkspaceState = (updatedNodes, updatedEdges) => {
    if (updateCurrentWorkspaceItems) {
      updateCurrentWorkspaceItems({ nodes: updatedNodes, edges: updatedEdges });
    }
  };

  // Update a node’s parameters.
  const handleNodeUpdate = (nodeId, updatedParameters) => {
    setNodes((prevNodes) => {
      const updatedNodes = prevNodes.map((node) =>
          node.id === nodeId
              ? { ...node, data: { ...node.data, parameters: updatedParameters } }
              : node
      );
      updateWorkspaceState(updatedNodes, edges);
      return updatedNodes;
    });
  };

  // Connect edges - open modal to configure mapping.
  const onConnect = useCallback(
      (connection) => {
        // Store pending connection and open modal
        setPendingConnection(connection);
        setEditingEdge(null);

        // Get source/target node info for modal
        const sourceNode = nodes.find(n => n.id === connection.source);
        const targetNode = nodes.find(n => n.id === connection.target);

        if (sourceNode && targetNode) {
          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label },
            targetNode: { id: targetNode.id, label: targetNode.data.label }
          });
          setShowEdgeModal(true);
        }
      },
      [nodes]
  );

  // Handle double-click on edge to edit mapping
  const onEdgeDoubleClick = useCallback(
      (event, edge) => {
        event.stopPropagation();
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (sourceNode && targetNode) {
          setEditingEdge(edge);
          setPendingConnection(null);
          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label },
            targetNode: { id: targetNode.id, label: targetNode.data.label },
            existingMappings: edge.data?.mappings || []
          });
          setShowEdgeModal(true);
        }
      },
      [nodes]
  );

  // Handle saving edge mappings from modal
  const handleEdgeMappingSave = useCallback(
      (mappings) => {
        if (editingEdge) {
          // Update existing edge
          setEdges((eds) => {
            const updatedEdges = eds.map((e) =>
                e.id === editingEdge.id
                    ? { ...e, data: { ...e.data, mappings } }
                    : e
            );
            updateWorkspaceState(nodes, updatedEdges);
            return updatedEdges;
          });
        } else if (pendingConnection) {
          // Create new edge with mappings
          const newEdge = {
            id: `${pendingConnection.source}-${pendingConnection.target}-${Date.now()}`,
            source: pendingConnection.source,
            target: pendingConnection.target,
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 10,
              height: 10,
            },
            style: { strokeWidth: 2 },
            data: { mappings }
          };
          setEdges((eds) => {
            const newEdges = [...eds, newEdge];
            updateWorkspaceState(nodes, newEdges);
            return newEdges;
          });
        }

        // Reset modal state
        setShowEdgeModal(false);
        setPendingConnection(null);
        setEditingEdge(null);
        setEdgeModalData(null);
      },
      [nodes, pendingConnection, editingEdge]
  );

  // Handle closing edge modal without saving
  const handleEdgeModalClose = useCallback(() => {
    setShowEdgeModal(false);
    setPendingConnection(null);
    setEditingEdge(null);
    setEdgeModalData(null);
  }, []);

  // Wrap onEdgesChange to sync edge deletions to localStorage
  const handleEdgesChange = useCallback((changes) => {
    // Apply the changes first
    onEdgesChange(changes);

    // Check if any edges were deleted and sync to localStorage
    const deletions = changes.filter(c => c.type === 'remove');
    if (deletions.length > 0) {
      setEdges((currentEdges) => {
        updateWorkspaceState(nodes, currentEdges);
        return currentEdges;
      });
    }
  }, [nodes, onEdgesChange]);

  // Handle drag over.
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // On drop, create a new node.
  const handleDrop = (event) => {
    event.preventDefault();
    const name = event.dataTransfer.getData('node/name') || 'Unnamed Node';
    if (!reactFlowInstance) return;

    const flowPosition = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    const newNode = {
      id: `${Date.now()}`, // unique id
      type: 'default',
      data: {
        label: name,
        parameters: '',
        onSaveParameters: (newParams) => handleNodeUpdate(newNode.id, newParams),
      },
      position: flowPosition,
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    updateWorkspaceState(updatedNodes, edges);
  };

  // Delete nodes and corresponding edges.
  const onNodesDelete = useCallback(
      (deletedNodes) => {
        // Remove deleted nodes from the nodes state.
        setNodes((prevNodes) => {
          const updatedNodes = prevNodes.filter(
              (node) => !deletedNodes.some((del) => del.id === node.id)
          );
          // Update edges using the updated nodes.
          setEdges((prevEdges) => {
            const updatedEdges = prevEdges.filter(
                (edge) =>
                    !deletedNodes.some(
                        (node) => edge.source === node.id || edge.target === node.id
                    )
            );
            // Update persistent workspace with both new nodes and edges.
            updateWorkspaceState(updatedNodes, updatedEdges);
            return updatedEdges;
          });
          return updatedNodes;
        });
      },
      [updateCurrentWorkspaceItems]
  );

  // --- Global Key Listener for "Delete" Key ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete') {
        if (reactFlowInstance) {
          const selectedNodes = reactFlowInstance.getNodes().filter((node) => node.selected);
          if (selectedNodes.length > 0) {
            onNodesDelete(selectedNodes);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlowInstance, onNodesDelete]);

  // Provide complete workflow data for exporting.
  const getWorkflowData = () => ({
    nodes: nodes.map((node) => ({
      id: node.id,
      data: node.data,
      position: node.position,
    })),
    edges: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      data: edge.data,  // Include mapping data
    })),
  });

  useEffect(() => {
    if (onSetWorkflowData) {
      onSetWorkflowData(() => getWorkflowData);
    }
  }, [nodes, edges, onSetWorkflowData]);

  return (
      <div className="workflow-canvas">
        <div
            ref={reactFlowWrapper}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="workflow-canvas-container"
        >
          <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={onConnect}
              onNodesDelete={onNodesDelete}
              onEdgeDoubleClick={onEdgeDoubleClick}
              fitView
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={(instance) => setReactFlowInstance(instance)}
          >
            <MiniMap />
            <Background variant="dots" gap={12} size={1} />
            <Controls />
          </ReactFlow>
        </div>

        {/* Edge Mapping Modal */}
        <EdgeMappingModal
            show={showEdgeModal}
            onClose={handleEdgeModalClose}
            onSave={handleEdgeMappingSave}
            sourceNode={edgeModalData?.sourceNode}
            targetNode={edgeModalData?.targetNode}
            existingMappings={edgeModalData?.existingMappings || []}
        />
      </div>
  );
}

export default WorkflowCanvas;
