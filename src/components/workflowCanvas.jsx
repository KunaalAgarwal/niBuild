import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
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
import { useNodeLookup } from '../hooks/useNodeLookup.js';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import { computeScatteredNodes } from '../utils/scatterPropagation.js';
import { getInvalidConnectionReason } from '../utils/adjacencyValidation.js';

// Define node types.
const nodeTypes = { default: NodeComponent };

// Shared edge arrow marker config
const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

function WorkflowCanvas({ workflowItems, updateCurrentWorkspaceItems, onSetWorkflowData, currentWorkspaceIndex }) {
  const reactFlowWrapper = useRef(null);
  const prevWorkspaceRef = useRef(currentWorkspaceIndex);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  // Memoized node lookup for O(1) access
  const nodeMap = useNodeLookup(nodes);
  // Refs to track current nodes/edges for closures (fixes stale closure issue)
  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const edgesRef = useRef(edges);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Compute which nodes inherit scatter from upstream (BFS propagation).
  // Used by NodeComponent via ScatterPropagationContext to show badges.
  const scatterContext = useMemo(() => {
    const dummyIds = new Set(nodes.filter(n => n.data?.isDummy).map(n => n.id));
    const realNodes = nodes.filter(n => !n.data?.isDummy);
    const realEdges = edges.filter(e => !dummyIds.has(e.source) && !dummyIds.has(e.target));
    const { scatteredNodeIds, sourceNodeIds } = computeScatteredNodes(realNodes, realEdges);
    return { propagatedIds: scatteredNodeIds, sourceNodeIds };
  }, [nodes, edges]);

  // Compute which inputs on each node are wired from upstream edge mappings.
  // Used by NodeComponent via WiredInputsContext to show wired/unwired state.
  // Value: Map<nodeId, Map<inputName, Array<{ sourceNodeId, sourceNodeLabel, sourceOutput }>>>
  const wiredContext = useMemo(() => {
    const wiredMap = new Map();
    edges.forEach(edge => {
      if (!edge.data?.mappings) return;
      edge.data.mappings.forEach(mapping => {
        if (!wiredMap.has(edge.target)) wiredMap.set(edge.target, new Map());
        const nodeInputs = wiredMap.get(edge.target);
        const sourceNode = nodeMap.get(edge.source);
        const sourceInfo = {
          sourceNodeId: edge.source,
          sourceNodeLabel: sourceNode?.data?.label || 'Unknown',
          sourceOutput: mapping.sourceOutput
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

  // Edge mapping modal state
  const [showEdgeModal, setShowEdgeModal] = useState(false);
  const [pendingConnection, setPendingConnection] = useState(null);
  const [editingEdge, setEditingEdge] = useState(null);
  const [edgeModalData, setEdgeModalData] = useState(null);

  // --- INITIALIZATION & Synchronization ---
  // This effect watches for changes in the persistent workspace.
  // When the clear workspace button is pressed, workflowItems becomes empty,
  // and this effect clears the canvas accordingly.
  // Also triggers when workspace index changes (switching workspaces).
  useEffect(() => {
    if (workflowItems && typeof workflowItems.nodes !== 'undefined') {
      const workspaceSwitched = prevWorkspaceRef.current !== currentWorkspaceIndex;
      prevWorkspaceRef.current = currentWorkspaceIndex;

      if (workspaceSwitched || workflowItems.nodes.length !== nodes.length) {
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
          markerEnd: EDGE_ARROW,
          style: { strokeWidth: 2 },
        }));
        setNodes(initialNodes);
        setEdges(initialEdges);
      }
    }
  }, [workflowItems, nodes.length, currentWorkspaceIndex]);

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
                    dockerVersion: updatedData.dockerVersion || node.data.dockerVersion || 'latest',
                    scatterEnabled: updatedData.scatterEnabled !== undefined
                        ? updatedData.scatterEnabled
                        : (node.data.scatterEnabled || false),
                    linkMergeOverrides: updatedData.linkMergeOverrides || node.data.linkMergeOverrides || {},
                    whenExpression: updatedData.whenExpression !== undefined
                        ? updatedData.whenExpression
                        : (node.data.whenExpression || ''),
                    expressions: updatedData.expressions || node.data.expressions || {},
                  }
                }
              : node
      );
      updateWorkspaceState(updatedNodes, edgesRef.current);
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
          // Validate connection against consensus adjacency matrix (skip dummy nodes)
          let adjacencyWarning = null;
          if (!sourceNode.data.isDummy && !targetNode.data.isDummy) {
            adjacencyWarning = getInvalidConnectionReason(sourceNode.data.label, targetNode.data.label);
          }

          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label, isDummy: sourceNode.data.isDummy || false },
            targetNode: { id: targetNode.id, label: targetNode.data.label, isDummy: targetNode.data.isDummy || false },
            adjacencyWarning,
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
          let adjacencyWarning = null;
          if (!sourceNode.data.isDummy && !targetNode.data.isDummy) {
            adjacencyWarning = getInvalidConnectionReason(sourceNode.data.label, targetNode.data.label);
          }

          setEditingEdge(edge);
          setPendingConnection(null);
          setEdgeModalData({
            sourceNode: { id: sourceNode.id, label: sourceNode.data.label, isDummy: sourceNode.data.isDummy || false },
            targetNode: { id: targetNode.id, label: targetNode.data.label, isDummy: targetNode.data.isDummy || false },
            existingMappings: edge.data?.mappings || [],
            adjacencyWarning,
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
            updateWorkspaceState(nodesRef.current, updatedEdges);
            return updatedEdges;
          });
        } else if (pendingConnection) {
          // Create new edge with mappings
          const newEdge = {
            id: `${pendingConnection.source}-${pendingConnection.target}-${crypto.randomUUID()}`,
            source: pendingConnection.source,
            target: pendingConnection.target,
            animated: true,
            markerEnd: EDGE_ARROW,
            style: { strokeWidth: 2 },
            data: { mappings }
          };
          setEdges((eds) => {
            const newEdges = [...eds, newEdge];
            updateWorkspaceState(nodesRef.current, newEdges);
            return newEdges;
          });
        }

        // Reset modal state
        setShowEdgeModal(false);
        setPendingConnection(null);
        setEditingEdge(null);
        setEdgeModalData(null);
      },
      [pendingConnection, editingEdge]
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
  const handleDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

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
      id: crypto.randomUUID(),
      type: 'default',
      data: {
        label: name,
        parameters: '',
        dockerVersion: 'latest',
        scatterEnabled: false,
        linkMergeOverrides: {},
        whenExpression: '',
        expressions: {},
        isDummy: isDummy,
        onSaveParameters: isDummy ? null : (newData) => handleNodeUpdate(newNode.id, newData),
      },
      position: flowPosition,
    };

    setNodes((prevNodes) => {
      const updatedNodes = [...prevNodes, newNode];
      updateWorkspaceState(updatedNodes, edgesRef.current);
      return updatedNodes;
    });
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
          <ScatterPropagationContext.Provider value={scatterContext}>
          <WiredInputsContext.Provider value={wiredContext}>
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
                onInit={(instance) => setReactFlowInstance(instance)}
            >
              <MiniMap
                nodeColor="var(--color-primary)"
                maskColor="var(--minimap-mask)"
                style={{ backgroundColor: 'var(--minimap-bg)' }}
              />
              <Background variant="dots" gap={12} size={1} />
              <Controls />
            </ReactFlow>
          </WiredInputsContext.Provider>
          </ScatterPropagationContext.Provider>
        </div>

        {/* Edge Mapping Modal */}
        <EdgeMappingModal
            show={showEdgeModal}
            onClose={handleEdgeModalClose}
            onSave={handleEdgeMappingSave}
            sourceNode={edgeModalData?.sourceNode}
            targetNode={edgeModalData?.targetNode}
            existingMappings={edgeModalData?.existingMappings || []}
            adjacencyWarning={edgeModalData?.adjacencyWarning || null}
        />
      </div>
  );
}

export default WorkflowCanvas;
