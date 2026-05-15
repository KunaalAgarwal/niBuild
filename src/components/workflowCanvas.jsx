import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, MarkerType } from 'reactflow';

import 'reactflow/dist/style.css';
import '../styles/workflowCanvas.css';

import NodeComponent from './NodeComponent';
import EdgeMappingModal from './EdgeMappingModal';
import { useNodeLookup } from '../hooks/useNodeLookup.js';
import { useBIDSHandler } from '../hooks/useBIDSHandler.js';
import { useCanvasShortcuts } from '../hooks/useCanvasShortcuts.js';
import { useCanvasClipboard } from '../hooks/useCanvasClipboard.js';
import { useFlowContexts } from '../hooks/useFlowContexts.js';
import { useEdgeMapping } from '../hooks/useEdgeMapping.js';
import { useCanvasDrop } from '../hooks/useCanvasDrop.js';
import { useCustomWorkflowSync } from '../hooks/useCustomWorkflowSync.js';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import { WorkflowMetaProvider } from '../context/WorkflowMetaContext.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { layoutGraph } from '../utils/layoutGraph.js';

// Define node types.
const nodeTypes = { default: NodeComponent };

// Shared edge arrow marker config
const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

// Consistent default viewport so every workspace starts with the same canvas size
const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

function WorkflowCanvas({
    workflowItems,
    updateCurrentWorkspaceItems,
    onSetWorkflowData,
    onSetAddNode,
    currentWorkspaceIndex,
    workspaceId,
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
        // Reason: reactFlowInstance is read at fire time only; we don't want to re-sync just because ReactFlow rebound the instance ref.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, updateCurrentWorkspaceItems]);

    const { scatterContext, wiredContext } = useFlowContexts(nodes, edges, nodeMap, setNodes, markForSync);

    useCustomWorkflowSync(nodes, customWorkflows, setNodes, setEdges, markForSync);

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
        // Reason: setNodes from useNodesState is stable; ESLint can't see that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes]);

    const [toolsHidden, setToolsHidden] = useState(false);
    const { showError, showWarning, showInfo } = useToast();

    // Aux-tab context: opens tabs (BIDS / params / custom-workflow params) and registers
    // save handlers so saved data from those tabs flows back into the canvas nodes.
    // auxTabs/closeAuxTab are read by onNodesDelete to clean up orphaned tabs.
    const { registerSaveHandler, auxTabs, closeAuxTab } = useAuxTabsContext();
    // Sidebar selection + active-tab — written from ReactFlow's onSelectionChange
    // so the left sidebar's Params tab reflects whichever node is currently
    // selected, and from the BIDS handler so clicking "Data" on a BIDS node
    // flips to the BIDS sidebar tab.
    const { setSelectedNode, setActiveTab: setActiveSidebarTab } = useSidebar();

    // BIDS node state and handlers. Opening the BIDS editor activates the
    // sidebar's BIDS tab (and selects the target node) — pass the sidebar
    // setters + workspaceId so the hook can drive the sidebar directly.
    const {
        bidsFileInputRef,
        handleBIDSNodeUpdate,
        handleInternalBIDSUpdate,
        triggerBIDSDirectoryPicker,
        handleBIDSDirectorySelected,
    } = useBIDSHandler({
        setNodes,
        markForSync,
        showError,
        showWarning,
        showInfo,
        setActiveSidebarTab,
        setSidebarSelectedNode: setSelectedNode,
        workspaceId,
    });

    // Aux-tab save handler registration. Keep latest handlers in refs so the registered
    // closures always invoke up-to-date logic without re-registering on every change.
    const handleBIDSNodeUpdateRef = useRef(handleBIDSNodeUpdate);
    handleBIDSNodeUpdateRef.current = handleBIDSNodeUpdate;

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
                        // Reattach Standard Template callback
                        ...(node.data.isStandardTemplate
                            ? {
                                  onUpdateStandardTemplate: (updates) => handleStandardTemplateUpdate(node.id, updates),
                              }
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
        // Reason: this fires on workspace identity change only — using `nodes.length` as a coarse trigger avoids re-running per node mutation. Update handlers, customWorkflows, setNodes/setEdges, reactFlowInstance, markForSync are all read at fire time and intentionally omitted.
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

    // Keep latest custom-workflow update handler in a ref for the aux-tab registration below.
    const handleCustomNodeUpdateRef = useRef(handleCustomNodeUpdate);
    handleCustomNodeUpdateRef.current = handleCustomNodeUpdate;
    const handleNodeUpdateRef = useRef(handleNodeUpdate);
    handleNodeUpdateRef.current = handleNodeUpdate;

    // Register aux-tab save handlers for every BIDS / custom-workflow node currently on the canvas.
    // We key by node id; the set of IDs (joined-sorted) is the only thing that needs to invalidate the effect.
    const bidsNodeIdsKey = useMemo(
        () =>
            nodes
                .filter((n) => n.data?.isBIDS)
                .map((n) => n.id)
                .sort()
                .join(','),
        [nodes],
    );
    const customWfNodeIdsKey = useMemo(
        () =>
            nodes
                .filter((n) => n.data?.isCustomWorkflow)
                .map((n) => n.id)
                .sort()
                .join(','),
        [nodes],
    );
    const toolNodeIdsKey = useMemo(
        () =>
            nodes
                .filter((n) => !n.data?.isDummy && !n.data?.isBIDS && !n.data?.isCustomWorkflow)
                .map((n) => n.id)
                .sort()
                .join(','),
        [nodes],
    );
    useEffect(() => {
        const ids = bidsNodeIdsKey ? bidsNodeIdsKey.split(',') : [];
        const cleanups = ids.map((nodeId) =>
            registerSaveHandler('bids-modal', nodeId, (bidsSelections) => {
                if (bidsSelections) {
                    handleBIDSNodeUpdateRef.current(nodeId, { bidsSelections });
                }
            }),
        );
        return () => cleanups.forEach((c) => c && c());
    }, [bidsNodeIdsKey, registerSaveHandler]);
    useEffect(() => {
        const ids = customWfNodeIdsKey ? customWfNodeIdsKey.split(',') : [];
        const cleanups = ids.map((nodeId) =>
            registerSaveHandler('param-modal', nodeId, (updatedInternalNodes) => {
                if (updatedInternalNodes) {
                    handleCustomNodeUpdateRef.current(nodeId, { internalNodes: updatedInternalNodes });
                }
            }),
        );
        return () => cleanups.forEach((c) => c && c());
    }, [customWfNodeIdsKey, registerSaveHandler]);
    useEffect(() => {
        const ids = toolNodeIdsKey ? toolNodeIdsKey.split(',') : [];
        const cleanups = ids.map((nodeId) =>
            registerSaveHandler('tool-param-modal', nodeId, (payload) => {
                if (payload) handleNodeUpdateRef.current(nodeId, payload);
            }),
        );
        return () => cleanups.forEach((c) => c && c());
    }, [toolNodeIdsKey, registerSaveHandler]);

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

    const handleStandardTemplateUpdate = (nodeId, u) =>
        updateNodeData(nodeId, (d) => ({
            ...d,
            ...(u.templateId !== undefined ? { templateId: u.templateId } : {}),
            ...(u.template !== undefined ? { template: u.template } : {}),
            ...(u.resolvedFilename !== undefined ? { resolvedFilename: u.resolvedFilename } : {}),
            ...(u.label !== undefined ? { label: u.label } : {}),
            ...(u._pickTemplate !== undefined ? { _pickTemplate: u._pickTemplate } : {}),
        }));

    const {
        modalState: { showEdgeModal, edgeModalData },
        onConnect,
        onEdgeDoubleClick,
        handleEdgeMappingSave,
        handleEdgeModalClose,
        handleEdgesChange,
    } = useEdgeMapping(nodeMap, setEdges, onEdgesChange, scatterContext, markForSync);

    const {
        onDragOver: handleDragOver,
        onDrop: handleDrop,
        addNodeAtCenter,
    } = useCanvasDrop({
        reactFlowInstance,
        reactFlowWrapper,
        customWorkflows,
        setNodes,
        setEdges,
        markForSync,
        showError,
        handlers: {
            handleNodeUpdate,
            handleBIDSNodeUpdate,
            handleCustomNodeUpdate,
            handleInternalBIDSUpdate,
            handleIONodeUpdate,
            handleOutputNodeUpdate,
            handleStandardTemplateUpdate,
        },
        triggerBIDSDirectoryPicker,
    });

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

            // Close any aux tabs bound to a deleted node in THIS workspace. The
            // workspaceId guard avoids collateral damage if node IDs ever collide
            // across workspaces. AuxTabContext's wrapped closeAuxTab returns focus
            // to the parent workspace when the closing tab was active.
            if (workspaceId) {
                for (const t of auxTabs) {
                    if (t.workspaceId === workspaceId && t.nodeId && deletedIds.has(t.nodeId)) {
                        closeAuxTab(t.id);
                    }
                }
            }

            markForSync();
        },
        // Reason: setNodes/setEdges from useNodesState/useEdgesState are stable; ESLint can't see that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [markForSync, auxTabs, closeAuxTab, workspaceId],
    );

    // Track all currently-selected node ids in a ref so copy/paste handlers
    // can read them without re-rendering on every selection change.
    const selectedNodeIdsRef = useRef([]);

    // Mirror ReactFlow's selection state into SidebarContext so the sidebar's
    // Params tab knows which node (if any) is currently focused. Fires on
    // click-to-select, drag-select, deselect (click empty canvas), and
    // programmatic selection changes — covers all the gestures the sidebar
    // needs. Only the first selected node feeds the Params panel; multi-select
    // collapses to a single focus by design.
    const onSelectionChange = useCallback(
        ({ nodes: selectedNodes }) => {
            selectedNodeIdsRef.current = (selectedNodes || []).map((n) => n.id);
            if (!workspaceId) return;
            const sel = selectedNodes && selectedNodes[0] ? selectedNodes[0].id : null;
            setSelectedNode(workspaceId, sel);
        },
        [workspaceId, setSelectedNode],
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
        // Reason: setNodes from useNodesState is stable; ESLint can't see that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, reactFlowInstance, markForSync]);

    // --- Clipboard (Ctrl+C / Ctrl+V) ---
    const clipboard = useCanvasClipboard();

    const handleCopy = useCallback(() => {
        clipboard.copy(selectedNodeIdsRef.current, nodes, edges);
    }, [clipboard, nodes, edges]);

    // Paste: re-UUID every node, remap edges, reattach per-kind callbacks (mirrors
    // the workspace-load rehydration logic above and the expansion logic in
    // useCanvasDrop). Offset is fixed +40,+40 from the clipboard's top-left so
    // successive pastes stair-step visually.
    const handlePaste = useCallback(() => {
        const payload = clipboard.read();
        if (!payload || payload.nodes.length === 0) return;

        const idMap = new Map(payload.nodes.map((n) => [n.id, crypto.randomUUID()]));

        const newNodes = payload.nodes.map((savedNode) => {
            const newId = idMap.get(savedNode.id);
            const d = savedNode.data || {};
            const data = {
                ...structuredClone(d),
                onSaveParameters: d.isDummy
                    ? null
                    : d.isCustomWorkflow
                      ? (newData) => handleCustomNodeUpdate(newId, newData)
                      : (newParams) => handleNodeUpdate(newId, newParams),
                ...(d.isBIDS ? { onUpdateBIDS: (updates) => handleBIDSNodeUpdate(newId, updates) } : {}),
                ...(d.isStandardTemplate
                    ? { onUpdateStandardTemplate: (updates) => handleStandardTemplateUpdate(newId, updates) }
                    : {}),
                ...(d.isCustomWorkflow
                    ? { onUpdateInternalBIDS: (updates) => handleInternalBIDSUpdate(newId, updates) }
                    : {}),
                onSaveIO: d.isDummy ? (data2) => handleIONodeUpdate(newId, data2) : null,
                onSaveOutputConfig:
                    d.isOutputNode || (d.isDummy && d.label === 'Output')
                        ? (data2) => handleOutputNodeUpdate(newId, data2)
                        : null,
            };
            return {
                id: newId,
                type: savedNode.type || 'default',
                position: {
                    x: (savedNode.position?.x ?? 0) + 40,
                    y: (savedNode.position?.y ?? 0) + 40,
                },
                data,
            };
        });

        const newEdges = (payload.edges || [])
            .map((e, idx) => {
                const newSource = idMap.get(e.source);
                const newTarget = idMap.get(e.target);
                if (!newSource || !newTarget) return null;
                return {
                    id: `${newSource}-${newTarget}-${idx}-${crypto.randomUUID().slice(0, 8)}`,
                    source: newSource,
                    target: newTarget,
                    data: { mappings: e.data?.mappings || [] },
                    animated: true,
                    markerEnd: EDGE_ARROW,
                    style: { strokeWidth: 2 },
                };
            })
            .filter(Boolean);

        setNodes((prev) => [...prev, ...newNodes]);
        setEdges((prev) => [...prev, ...newEdges]);
        markForSync();
        // Reason: the per-kind update handlers (handleNodeUpdate, handleBIDSNodeUpdate, etc.) close over stable setNodes; including them would re-create handlePaste on every node mutation. Read at fire time only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clipboard, setNodes, setEdges, markForSync]);

    useCanvasShortcuts({
        onAutoLayout: handleAutoLayout,
        onCopy: handleCopy,
        onPaste: handlePaste,
    });

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
        // Reason: getWorkflowData is re-created each render and captures latest nodes/edges via closure; including it would cause infinite re-registration. We re-expose it on nodes/edges change so the parent sees a fresh closure.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nodes, edges, onSetWorkflowData]);

    useEffect(() => {
        if (onSetAddNode) {
            onSetAddNode(() => addNodeAtCenter);
        }
    }, [addNodeAtCenter, onSetAddNode]);

    return (
        <WorkflowMetaProvider workspaceId={workspaceId}>
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
                                onSelectionChange={onSelectionChange}
                                onEdgeDoubleClick={onEdgeDoubleClick}
                                nodeTypes={nodeTypes}
                                multiSelectionKeyCode="Shift"
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
                                    nodeColor="var(--color-accent)"
                                    maskColor="var(--minimap-mask)"
                                    style={{ backgroundColor: 'var(--minimap-bg)' }}
                                />
                                <Background variant="dots" gap={12} size={1} />
                                {!toolsHidden && <Controls />}
                                <div className={`canvas-bottom-bar${toolsHidden ? ' tools-hidden' : ''}`}>
                                    <button
                                        className="canvas-bottom-btn"
                                        onClick={() => setToolsHidden((prev) => !prev)}
                                    >
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
                                    <button
                                        className="canvas-bottom-btn collapsible"
                                        onClick={() => {
                                            setNodes([]);
                                            setEdges([]);
                                            markForSync();
                                        }}
                                        disabled={nodes.length === 0}
                                        title="Clear all nodes and edges"
                                    >
                                        Clear All
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
            </div>
        </WorkflowMetaProvider>
    );
}

export default WorkflowCanvas;
