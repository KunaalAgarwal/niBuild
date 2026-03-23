import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from 'reactflow';

import 'reactflow/dist/style.css';
import '../styles/workflowCanvas.css';
import '../styles/actionsBar.css';

import NodeComponent from './NodeComponent';
import EdgeMappingModal from './EdgeMappingModal';
import BIDSDataModal from './BIDSDataModal';
import { useNodeLookup } from '../hooks/useNodeLookup.js';
import { useBIDSHandler } from '../hooks/useBIDSHandler.js';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import { computeScatteredNodes, buildArrayTypedInputs } from '../utils/scatterPropagation.js';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { layoutGraph } from '../utils/layoutGraph.js';

// Define node types.
const nodeTypes = { default: NodeComponent };

// Shared edge arrow marker config
const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

// Consistent default viewport so every workspace starts with the same canvas size
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

/** Resolve BIDS node data by key, handling both direct and custom-workflow-embedded BIDS nodes. */
function resolveBIDSNodeData(key, bidsModalNodeId, bidsPickerTargetRef, nodeMap) {
    if (!bidsModalNodeId) return null;
    const target = bidsPickerTargetRef.current;
    if (target !== null && typeof target === 'object' && target.cwNodeId) {
        const cwNode = nodeMap.get(target.cwNodeId);
        return cwNode?.data?.internalNodes?.find((n) => n.isBIDS)?.[key] || null;
    }
    return nodeMap.get(bidsModalNodeId)?.data?.[key] || null;
}

function WorkflowCanvas({
    workflowItems,
    updateCurrentWorkspaceItems,
    onSetWorkflowData,
    currentWorkspaceIndex,
    saveViewportForWorkspace,
}) {
    const { customWorkflows } = useCustomWorkflowsContext();
    const reactFlowWrapper = useRef(null);
    const prevWorkspaceRef = useRef(currentWorkspaceIndex);
    const prevWorkspaceIdRef = useRef(workflowItems?.id);
    const prevSyncVersionRef = useRef(workflowItems?.syncVersion || 0);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [reactFlowInstance, setReactFlowInstance] = useState(null);

    // Memoized node lookup for O(1) access
    const nodeMap = useNodeLookup(nodes);
    // Deferred workspace sync: flag-based to avoid setState-during-render.
    // Only syncs when explicitly marked (user actions), not on drag/selection changes.
    const needsSyncRef = useRef(false);
    const markForSync = useCallback(() => {
        needsSyncRef.current = true;
    }, []);

    useEffect(() => {
        if (needsSyncRef.current) {
            needsSyncRef.current = false;
            if (updateCurrentWorkspaceItems) {
                const viewport = reactFlowInstance?.getViewport() || null;
                updateCurrentWorkspaceItems({ nodes, edges, viewport });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, updateCurrentWorkspaceItems]);

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

        const FLATTEN = '$(self.flat())';
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

    // Sync on-canvas custom workflow nodes when saved workflows change.
    // Also removes orphaned nodes whose workflow was deleted.
    useEffect(() => {
        if (!customWorkflows) return;

        let changed = false;
        const removedIds = new Set();
        const updatedNodes = nodes
            .map((node) => {
                if (!node.data?.isCustomWorkflow || !node.data?.customWorkflowId) return node;
                const saved = customWorkflows.find((w) => w.id === node.data.customWorkflowId);
                if (!saved) {
                    // Workflow was deleted — mark node for removal
                    changed = true;
                    removedIds.add(node.id);
                    return null;
                }

                // Shallow check: compare node count, IDs, and labels to detect changes
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

    // Compute display labels for duplicate node names (e.g., "flirt (1)", "flirt (2)").
    // Runs as an effect to avoid infinite re-render loops from mutating nodes in useMemo.
    const prevLabelKeyRef = useRef('');
    useEffect(() => {
        // Build a key from node ids + labels to detect meaningful changes
        const labelKey = nodes.map((n) => `${n.id}:${n.data?.label}`).join('|');
        if (labelKey === prevLabelKeyRef.current) return;
        prevLabelKeyRef.current = labelKey;

        // Count occurrences of each label
        const labelCounts = {};
        for (const n of nodes) {
            const label = n.data?.label || '';
            labelCounts[label] = (labelCounts[label] || 0) + 1;
        }

        // Assign display labels only for duplicates
        const labelSeq = {};
        let anyChange = false;
        const updated = nodes.map((n) => {
            const label = n.data?.label || '';
            let displayLabel;
            if (labelCounts[label] > 1) {
                labelSeq[label] = (labelSeq[label] || 0) + 1;
                displayLabel = `${label} (${labelSeq[label]})`;
            } else {
                displayLabel = label;
            }
            if (n.data?.displayLabel !== displayLabel) {
                anyChange = true;
                return { ...n, data: { ...n.data, displayLabel } };
            }
            return n;
        });

        if (anyChange) {
            setNodes(updated);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes]);

    // Edge mapping modal state
    const [showEdgeModal, setShowEdgeModal] = useState(false);
    const [pendingConnection, setPendingConnection] = useState(null);
    const [editingEdge, setEditingEdge] = useState(null);
    const [edgeModalData, setEdgeModalData] = useState(null);

    const [toolsHidden, setToolsHidden] = useState(false);
    const { showError, showWarning, showInfo } = useToast();

    // BIDS node state and handlers
    const {
        showBIDSModal,
        bidsModalNodeId,
        bidsFileInputRef,
        bidsPickerTargetRef,
        handleBIDSNodeUpdate,
        handleInternalBIDSUpdate,
        triggerBIDSDirectoryPicker,
        handleBIDSDirectorySelected,
        handleBIDSModalClose,
    } = useBIDSHandler({ setNodes, markForSync, showError, showWarning, showInfo });

    // --- INITIALIZATION & Synchronization ---
    // This effect watches for changes in the persistent workspace.
    // When the clear workspace button is pressed, workflowItems becomes empty,
    // and this effect clears the canvas accordingly.
    // Also triggers when workspace index changes (switching workspaces).
    useEffect(() => {
        if (workflowItems && typeof workflowItems.nodes !== 'undefined') {
            const indexChanged = prevWorkspaceRef.current !== currentWorkspaceIndex;
            const idChanged = prevWorkspaceIdRef.current !== workflowItems.id;
            const workspaceSwitched = indexChanged || idChanged;
            // Save outgoing workspace's viewport before switching
            if (workspaceSwitched && reactFlowInstance && saveViewportForWorkspace) {
                saveViewportForWorkspace(prevWorkspaceRef.current, reactFlowInstance.getViewport());
            }
            prevWorkspaceRef.current = currentWorkspaceIndex;
            prevWorkspaceIdRef.current = workflowItems.id;
            const syncVersionChanged = (workflowItems.syncVersion || 0) !== prevSyncVersionRef.current;
            prevSyncVersionRef.current = workflowItems.syncVersion || 0;

            // Sync canvas when workspace switches, content was externally reset (e.g. clear), or reverted
            const nodeIdsChanged = workflowItems.nodes.map((n) => n.id).join(',') !== nodes.map((n) => n.id).join(',');
            if (workspaceSwitched || nodeIdsChanged || syncVersionChanged) {
                let anyCustomSynced = false;
                const initialNodes = (workflowItems.nodes || []).map((node) => {
                    const restoredData = {
                        ...node.data,
                        // Reattach callbacks so nodes remain interactive.
                        onSaveParameters: node.data.isDummy
                            ? null
                            : node.data.isCustomWorkflow
                              ? (newData) => handleCustomNodeUpdate(node.id, newData)
                              : (newParams) => handleNodeUpdate(node.id, newParams),
                        // Reattach BIDS callback
                        ...(node.data.isBIDS
                            ? { onUpdateBIDS: (updates) => handleBIDSNodeUpdate(node.id, updates) }
                            : {}),
                        // Reattach internal BIDS callback for custom workflow nodes
                        ...(node.data.isCustomWorkflow
                            ? { onUpdateInternalBIDS: (updates) => handleInternalBIDSUpdate(node.id, updates) }
                            : {}),
                        // Reattach I/O edit callback for dummy nodes
                        onSaveIO: node.data.isDummy ? (data) => handleIONodeUpdate(node.id, data) : null,
                        // Reattach output config callback for Output nodes (fallback to label for legacy nodes)
                        onSaveOutputConfig:
                            node.data.isOutputNode || (node.data.isDummy && node.data.label === 'Output')
                                ? (data) => handleOutputNodeUpdate(node.id, data)
                                : null,
                    };

                    // Sync custom workflow nodes with latest saved workflow data
                    if (restoredData.isCustomWorkflow && restoredData.customWorkflowId && customWorkflows) {
                        const saved = customWorkflows.find((w) => w.id === restoredData.customWorkflowId);
                        if (saved) {
                            const currentInternal = JSON.stringify(restoredData.internalNodes);
                            const savedInternal = JSON.stringify(saved.nodes);
                            if (
                                currentInternal !== savedInternal ||
                                restoredData.label !== saved.name ||
                                restoredData.hasValidationWarnings !== saved.hasValidationWarnings
                            ) {
                                anyCustomSynced = true;
                                Object.assign(restoredData, {
                                    label: saved.name,
                                    internalNodes: structuredClone(saved.nodes),
                                    internalEdges: structuredClone(saved.edges),
                                    boundaryNodes: { ...saved.boundaryNodes },
                                    hasValidationWarnings: saved.hasValidationWarnings,
                                });
                            }
                        }
                    }

                    return { ...node, data: restoredData };
                });
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

                // Auto-center on all nodes when switching workspaces
                if (workspaceSwitched && reactFlowInstance) {
                    // Small delay so React commits new nodes and ReactFlow measures DOM before fitView
                    setTimeout(() => {
                        reactFlowInstance.fitView({ padding: 0.2 });
                    }, 50);
                }

                // Persist synced custom workflow data back to workspace state
                if (anyCustomSynced) {
                    markForSync();
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workflowItems, nodes.length, currentWorkspaceIndex]);

    // Auto-center when canvas container resizes (e.g. panel open/close), debounced to prevent thrashing
    useEffect(() => {
        const el = reactFlowWrapper.current;
        if (!el || !reactFlowInstance) return;

        let timeoutId;
        const observer = new ResizeObserver(() => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                reactFlowInstance.fitView();
            }, 150);
        });

        observer.observe(el);
        return () => {
            clearTimeout(timeoutId);
            observer.disconnect();
        };
    }, [reactFlowInstance]);

    // Generic node data updater — applies a transform function to a single node's data.
    const updateNodeData = (nodeId, transform) => {
        setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: transform(n.data) } : n)));
        markForSync();
    };

    const handleNodeUpdate = (nodeId, u) =>
        updateNodeData(nodeId, (d) => ({
            ...d,
            parameters: u.params || u,
            dockerVersion: u.dockerVersion || d.dockerVersion || 'latest',
            scatterInputs: u.scatterInputs || d.scatterInputs || [],
            scatterMethod: u.scatterMethod !== undefined ? u.scatterMethod : d.scatterMethod,
            linkMergeOverrides: u.linkMergeOverrides || d.linkMergeOverrides || {},
            whenExpression: u.whenExpression !== undefined ? u.whenExpression : d.whenExpression || '',
            expressions: u.expressions || d.expressions || {},
            operationOrder: u.operationOrder || d.operationOrder || [],
            notes: u.notes ?? d.notes ?? '',
        }));

    const handleCustomNodeUpdate = (nodeId, u) =>
        updateNodeData(nodeId, (d) => ({
            ...d,
            internalNodes: u.internalNodes || d.internalNodes,
            notes: u.notes ?? d.notes ?? '',
        }));

    const handleIONodeUpdate = (nodeId, u) =>
        updateNodeData(nodeId, (d) => ({
            ...d,
            label: u.label ?? d.label,
            notes: u.notes ?? d.notes ?? '',
        }));

    const handleOutputNodeUpdate = (nodeId, u) =>
        updateNodeData(nodeId, (d) => ({
            ...d,
            selectedOutputs: u.selectedOutputs,
        }));

    // Build a flat node-info object for the EdgeMappingModal from a ReactFlow node.
    const buildEdgeModalNode = useCallback(
        (node) => ({
            id: node.id,
            label: node.data.label,
            isDummy: node.data.isDummy || false,
            isBIDS: node.data.isBIDS || false,
            bidsSelections: node.data.bidsSelections || null,
            isCustomWorkflow: node.data.isCustomWorkflow || false,
            internalNodes: node.data.internalNodes || [],
            internalEdges: node.data.internalEdges || [],
            isScattered: scatterContext.propagatedIds.has(node.id),
        }),
        [scatterContext],
    );

    // Connect edges - open modal to configure mapping.
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
                    adjacencyWarning: null, // disabled — cross-modality false positives; type/extension validation is sufficient
                });
                setShowEdgeModal(true);
            }
        },
        [nodeMap, buildEdgeModalNode],
    );

    // Handle double-click on edge to edit mapping
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
                    adjacencyWarning: null, // disabled — cross-modality false positives; type/extension validation is sufficient
                });
                setShowEdgeModal(true);
            }
        },
        [nodeMap, buildEdgeModalNode],
    );

    // Handle saving edge mappings from modal
    const handleEdgeMappingSave = useCallback(
        (mappings) => {
            if (editingEdge) {
                // Update existing edge
                setEdges((eds) =>
                    eds.map((e) => (e.id === editingEdge.id ? { ...e, data: { ...e.data, mappings } } : e)),
                );
            } else if (pendingConnection) {
                // Create new edge with mappings
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

            // Reset modal state
            setShowEdgeModal(false);
            setPendingConnection(null);
            setEditingEdge(null);
            setEdgeModalData(null);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [pendingConnection, editingEdge],
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
    const handleEdgesChange = useCallback(
        (changes) => {
            onEdgesChange(changes);

            // Sync edge deletions to localStorage
            const deletions = changes.filter((c) => c.type === 'remove');
            if (deletions.length > 0) {
                markForSync();
            }
        },
        [onEdgesChange, markForSync],
    );

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
        const isBIDS = event.dataTransfer.getData('node/isBIDS') === 'true';
        const isOutputNode = event.dataTransfer.getData('node/isOutputNode') === 'true';
        const customWorkflowId = event.dataTransfer.getData('node/customWorkflowId');
        if (!reactFlowInstance) return;

        const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        // Helper: create a node with common defaults, apply type-specific overrides
        const createNode = (dataOverrides, afterAdd) => {
            const newNodeId = crypto.randomUUID();
            const newNode = {
                id: newNodeId,
                type: 'default',
                position: flowPosition,
                data: {
                    label: name,
                    isDummy: false,
                    parameters: '',
                    dockerVersion: 'latest',
                    linkMergeOverrides: {},
                    whenExpression: '',
                    expressions: {},
                    notes: '',
                    ...dataOverrides(newNodeId),
                },
            };
            setNodes((prevNodes) => [...prevNodes, newNode]);
            markForSync();
            if (afterAdd) afterAdd(newNodeId);
        };

        if (isBIDS) {
            createNode(
                (id) => ({
                    isDummy: true,
                    isBIDS: true,
                    bidsStructure: null,
                    bidsSelections: null,
                    onSaveParameters: null,
                    onSaveIO: (data) => handleIONodeUpdate(id, data),
                    onUpdateBIDS: (updates) => handleBIDSNodeUpdate(id, updates),
                }),
                (id) => triggerBIDSDirectoryPicker(id),
            );
        } else if (customWorkflowId) {
            const savedWorkflow = customWorkflows.find((w) => w.id === customWorkflowId);
            if (!savedWorkflow) return;
            createNode((id) => ({
                label: savedWorkflow.name,
                isCustomWorkflow: true,
                customWorkflowId: savedWorkflow.id,
                internalNodes: structuredClone(savedWorkflow.nodes),
                internalEdges: structuredClone(savedWorkflow.edges),
                boundaryNodes: { ...savedWorkflow.boundaryNodes },
                hasValidationWarnings: savedWorkflow.hasValidationWarnings,
                parameters: {},
                onSaveParameters: (newData) => handleCustomNodeUpdate(id, newData),
                onUpdateInternalBIDS: (updates) => handleInternalBIDSUpdate(id, updates),
            }));
        } else {
            createNode((id) => ({
                isDummy: isDummy,
                isOutputNode: isOutputNode || undefined,
                selectedOutputs: isOutputNode ? null : undefined,
                onSaveParameters: isDummy ? null : (newData) => handleNodeUpdate(id, newData),
                onSaveIO: isDummy ? (data) => handleIONodeUpdate(id, data) : null,
                onSaveOutputConfig: isOutputNode ? (data) => handleOutputNodeUpdate(id, data) : null,
            }));
        }
    };

    // Delete nodes and corresponding edges.
    // Uses Set for O(1) lookups instead of O(n) array.some()
    const onNodesDelete = useCallback(
        (deletedNodes) => {
            // Pre-compute Set for O(1) lookups (fixes O(n²) -> O(n))
            const deletedIds = new Set(deletedNodes.map((n) => n.id));

            setNodes((prevNodes) => prevNodes.filter((node) => !deletedIds.has(node.id)));
            setEdges((prevEdges) =>
                prevEdges.filter((edge) => !deletedIds.has(edge.source) && !deletedIds.has(edge.target)),
            );
            markForSync();
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [markForSync],
    );

    // --- Auto-layout: arrange nodes as a layered DAG ---
    const handleAutoLayout = useCallback(() => {
        if (nodes.length < 2) return;
        const layoutedNodes = layoutGraph(nodes, edges);
        setNodes(layoutedNodes);
        markForSync();
        requestAnimationFrame(() => {
            reactFlowInstance?.fitView({ padding: 0.05, duration: 300 });
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, reactFlowInstance, markForSync]);

    // --- Global Key Listener for Auto-Layout Shortcut ---
    // Note: Delete key is handled natively by ReactFlow via onNodesDelete.
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'L') {
                e.preventDefault();
                handleAutoLayout();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleAutoLayout]);

    // Provide complete workflow data for exporting.
    const getWorkflowData = () => ({
        nodes: nodes.map((node) => ({
            id: node.id,
            data: node.data,
            position: node.position,
        })),
        edges: edges.map((edge) => ({
            id: edge.id, // Required for ReactFlow to manage edges
            source: edge.source,
            target: edge.target,
            data: edge.data, // Include mapping data
        })),
    });

    useEffect(() => {
        if (onSetWorkflowData) {
            onSetWorkflowData(() => getWorkflowData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                            nodeTypes={nodeTypes}
                            onInit={(instance) => {
                                setReactFlowInstance(instance);
                                // Initial fitView on first load (before any workspace viewport is restored)
                                const savedViewport = workflowItems?.viewport;
                                if (savedViewport) {
                                    instance.setViewport(savedViewport);
                                } else {
                                    instance.setViewport(DEFAULT_VIEWPORT);
                                }
                            }}
                        >
                            <MiniMap
                                nodeColor="var(--color-primary)"
                                maskColor="var(--minimap-mask)"
                                style={{ backgroundColor: 'var(--minimap-bg)' }}
                            />
                            <Background variant="dots" gap={12} size={1} />
                            {!toolsHidden && <Controls />}
                            <div className={`canvas-bottom-bar${toolsHidden ? ' tools-hidden' : ''}`}>
                                <button className="canvas-bottom-btn" onClick={() => setToolsHidden((prev) => !prev)}>
                                    {toolsHidden ? 'Show tools' : 'Hide tools'}
                                </button>
                                <button
                                    className="canvas-bottom-btn collapsible"
                                    onClick={handleAutoLayout}
                                    disabled={nodes.length < 2}
                                    title="Auto Layout (Ctrl+Shift+L)"
                                >
                                    Auto Layout
                                </button>
                                <button
                                    className="canvas-bottom-btn collapsible"
                                    onClick={() => {
                                        setEdges([]);
                                        markForSync();
                                    }}
                                    disabled={edges.length === 0}
                                    title="Remove all edges"
                                >
                                    Clear Edges
                                </button>
                            </div>
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
                sourceIsScattered={edgeModalData?.sourceNode?.isScattered || false}
            />

            {/* Hidden directory picker for BIDS nodes */}
            <input
                ref={bidsFileInputRef}
                type="file"
                webkitdirectory=""
                style={{ display: 'none' }}
                onChange={handleBIDSDirectorySelected}
            />

            {/* BIDS Data Modal */}
            <BIDSDataModal
                show={showBIDSModal}
                onClose={handleBIDSModalClose}
                bidsStructure={resolveBIDSNodeData('bidsStructure', bidsModalNodeId, bidsPickerTargetRef, nodeMap)}
                bidsSelections={resolveBIDSNodeData('bidsSelections', bidsModalNodeId, bidsPickerTargetRef, nodeMap)}
            />
        </div>
    );
}

export default WorkflowCanvas;
