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
import EdgeMappingModal, { checkTypeCompatibility } from './EdgeMappingModal';
import { TOOL_MAP } from '../../public/cwl/toolMap.js';
import { useNodeLookup } from '../hooks/useNodeLookup.js';

// Define node types.
const nodeTypes = { default: NodeComponent };
// Define edge types.
const edgeTypes = {};

function WorkflowCanvas({ workflowItems, updateCurrentWorkspaceItems, onSetWorkflowData }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Memoized node lookup for O(1) access
  const nodeMap = useNodeLookup(nodes);

  // Ref to track current nodes for closures (fixes stale closure issue)
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

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
        const initialEdges = (workflowItems.edges || []).map((edge, index) => ({
          ...edge,
          // Ensure edge has an ID (fallback for old saved data)
          id: edge.id || `${edge.source}-${edge.target}-${index}`,
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

  // Update a node's parameters and dockerVersion.
  const handleNodeUpdate = (nodeId, updatedData) => {
    setNodes((prevNodes) => {
      const updatedNodes = prevNodes.map((node) =>
          node.id === nodeId
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    parameters: updatedData.params || updatedData,
                    dockerVersion: updatedData.dockerVersion || node.data.dockerVersion || 'latest'
                  }
                }
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

        // Get source/target node info for modal using O(1) lookup
        const sourceNode = nodeMap.get(connection.source);
        const targetNode = nodeMap.get(connection.target);

        if (sourceNode && targetNode) {
          // Check for type compatibility between source outputs and target inputs
          let hasTypeMismatch = false;
          const sourceTool = TOOL_MAP[sourceNode.data.label];
          const targetTool = TOOL_MAP[targetNode.data.label];

          if (sourceTool && targetTool) {
            // Get primary output type from source
            const primaryOutput = sourceTool.primaryOutputs?.[0];
            const outputType = primaryOutput ? sourceTool.outputs[primaryOutput]?.type : null;

            // Find first passthrough input from target
            const passthroughInput = Object.entries(targetTool.requiredInputs || {})
              .find(([_, def]) => def.passthrough);
            const inputType = passthroughInput?.[1]?.type;

            if (outputType && inputType) {
              const { compatible } = checkTypeCompatibility(outputType, inputType);
              if (!compatible) {
                hasTypeMismatch = true;
              }
            }
          }

          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label, isDummy: sourceNode.data.isDummy || false },
            targetNode: { id: targetNode.id, label: targetNode.data.label, isDummy: targetNode.data.isDummy || false },
            hasTypeMismatch
          });
          setShowEdgeModal(true);
        }
      },
      [nodeMap]
  );

  // Handle double-click on edge to edit mapping
  const onEdgeDoubleClick = useCallback(
      (event, edge) => {
        event.stopPropagation();
        // Use O(1) lookup instead of O(n) find
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);

        if (sourceNode && targetNode) {
          setEditingEdge(edge);
          setPendingConnection(null);
          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label, isDummy: sourceNode.data.isDummy || false },
            targetNode: { id: targetNode.id, label: targetNode.data.label, isDummy: targetNode.data.isDummy || false },
            existingMappings: edge.data?.mappings || []
          });
          setShowEdgeModal(true);
        }
      },
      [nodeMap]
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
  // Uses nodesRef to avoid stale closure capturing nodes
  const handleEdgesChange = useCallback((changes) => {
    // Apply the changes first
    onEdgesChange(changes);

    // Check if any edges were deleted and sync to localStorage
    const deletions = changes.filter(c => c.type === 'remove');
    if (deletions.length > 0) {
      setEdges((currentEdges) => {
        updateWorkspaceState(nodesRef.current, currentEdges);
        return currentEdges;
      });
    }
  }, [onEdgesChange]);

  // Handle drag over.
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };

  // On drop, create a new node.
  const handleDrop = (event) => {
    event.preventDefault();
    const name = event.dataTransfer.getData('node/name') || 'Unnamed Node';
    const isDummy = event.dataTransfer.getData('node/isDummy') === 'true';
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
        dockerVersion: 'latest',
        isDummy: isDummy,
        onSaveParameters: isDummy ? null : (newData) => handleNodeUpdate(newNode.id, newData),
      },
      position: flowPosition,
    };

    const updatedNodes = [...nodes, newNode];
    setNodes(updatedNodes);
    updateWorkspaceState(updatedNodes, edges);
  };

  // Delete nodes and corresponding edges.
  // Uses Set for O(1) lookups instead of O(n) array.some()
  const onNodesDelete = useCallback(
      (deletedNodes) => {
        // Pre-compute Set for O(1) lookups (fixes O(n²) -> O(n))
        const deletedIds = new Set(deletedNodes.map(n => n.id));

        // Remove deleted nodes from the nodes state.
        setNodes((prevNodes) => {
          const updatedNodes = prevNodes.filter(
              (node) => !deletedIds.has(node.id)
          );
          // Update edges using the updated nodes.
          setEdges((prevEdges) => {
            const updatedEdges = prevEdges.filter(
                (edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)
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
      id: edge.id,  // Required for ReactFlow to manage edges
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
              fitViewOptions={{ maxZoom: 1, padding: 0.2 }}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onInit={(instance) => setReactFlowInstance(instance)}
          >
            <MiniMap
              nodeColor="#4a90e2"
              maskColor="rgba(0, 0, 0, 0.65)"
              style={{ backgroundColor: '#1a1a1a' }}
            />
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
            hasTypeMismatch={edgeModalData?.hasTypeMismatch || false}
        />
      </div>
  );
}

export default WorkflowCanvas;
