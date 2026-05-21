import { useCallback } from 'react';
import { MarkerType } from 'reactflow';

import { deserializeNode } from '../utils/workflowDiff.js';
import {
    getPipelineDefinition,
    filterPipelineByOptions,
    getDefaultPipelineOptions,
} from '../data/pipelineDefinitions.js';

const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

/**
 * Drop, drag, and "add node at viewport center" handlers for the workflow canvas.
 *
 * Two drop modes:
 *   - Standard drop — primitive tools, BIDS, output, or composite custom-node
 *     nodes. Routed via `buildNodeOverrides` → `createNodeAt`.
 *   - Workflow expansion — when the dragged item is a saved workflow-kind entry
 *     (`node/expand=true`), splats every saved node + edge onto the canvas with
 *     fresh UUIDs, remaps edges, and translates positions so the saved layout's
 *     top-left lands at the cursor.
 *
 * `addNodeAtCenter` is the same creation pipeline driven from the command
 * palette: it computes the current viewport center, then runs `buildNodeOverrides`
 * + `createNodeAt`.
 *
 * @param {object} params
 * @param {object} params.reactFlowInstance         - ReactFlow instance for screen↔flow conversion + viewport.
 * @param {object} params.reactFlowWrapper          - Ref to the wrapper div for client size.
 * @param {Array}  params.customWorkflows           - Live custom-workflows list from context.
 * @param {Function} params.setNodes                - ReactFlow nodes setter.
 * @param {Function} params.setEdges                - ReactFlow edges setter.
 * @param {() => void} params.markForSync           - flag the workspace as dirty.
 * @param {(msg: string) => void} params.showError  - toast error shown when expansion fails.
 * @param {object} params.handlers                  - Per-kind update callbacks attached to new nodes.
 * @param {(id: string) => void} params.triggerBIDSDirectoryPicker - opens BIDS picker after a BIDS drop.
 * @returns {{ onDragOver, onDrop, addNodeAtCenter }}
 */
export function useCanvasDrop({
    reactFlowInstance,
    reactFlowWrapper,
    customWorkflows,
    setNodes,
    setEdges,
    markForSync,
    showError,
    handlers,
    triggerBIDSDirectoryPicker,
    nodesRef,
}) {
    const onDragOver = useCallback((event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // Shared node creation helper — used by both onDrop and addNodeAtCenter
    const createNodeAt = useCallback(
        (position, name, dataOverrides, afterAdd) => {
            const newNodeId = crypto.randomUUID();
            const newNode = {
                id: newNodeId,
                type: 'default',
                position,
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
        },
        // Reason: setNodes from useNodesState is stable; ESLint can't see that.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [markForSync],
    );

    const buildNodeOverrides = useCallback(
        (name, { isDummy, isBIDS, isOutputNode, isStandardTemplate, customWorkflowId, pipelineId }) => {
            if (pipelineId) {
                const def = getPipelineDefinition(pipelineId);
                if (!def) return null;
                return {
                    overrides: (id) => ({
                        label: def.name,
                        isPipeline: true,
                        pipelineId,
                        pipelineOptions: getDefaultPipelineOptions(def),
                        onExpand: () => handlers.handlePipelineExpand?.(id),
                        onOpenOptions: () => handlers.handlePipelineOpenOptions?.(id),
                    }),
                };
            }
            if (isBIDS) {
                return {
                    overrides: (id) => ({
                        isDummy: true,
                        isBIDS: true,
                        bidsStructure: null,
                        bidsSelections: null,
                        onSaveParameters: null,
                        onSaveIO: (data) => handlers.handleIONodeUpdate(id, data),
                        onUpdateBIDS: (updates) => handlers.handleBIDSNodeUpdate(id, updates),
                    }),
                    afterAdd: (id) => triggerBIDSDirectoryPicker(id),
                };
            }
            if (isStandardTemplate) {
                return {
                    overrides: (id) => ({
                        isDummy: true,
                        isStandardTemplate: true,
                        templateId: null,
                        template: null,
                        resolvedFilename: null,
                        onSaveParameters: null,
                        onSaveIO: (data) => handlers.handleIONodeUpdate(id, data),
                        onUpdateStandardTemplate: (updates) => handlers.handleStandardTemplateUpdate(id, updates),
                    }),
                };
            }
            if (customWorkflowId) {
                const savedWorkflow = customWorkflows.find((w) => w.id === customWorkflowId);
                if (!savedWorkflow) return null;
                return {
                    overrides: (id) => ({
                        label: savedWorkflow.name,
                        isCustomWorkflow: true,
                        customWorkflowId: savedWorkflow.id,
                        internalNodes: structuredClone(savedWorkflow.nodes),
                        internalEdges: structuredClone(savedWorkflow.edges),
                        boundaryNodes: { ...savedWorkflow.boundaryNodes },
                        hasValidationWarnings: savedWorkflow.hasValidationWarnings,
                        parameters: {},
                        onSaveParameters: (newData) => handlers.handleCustomNodeUpdate(id, newData),
                        onUpdateInternalBIDS: (updates) => handlers.handleInternalBIDSUpdate(id, updates),
                    }),
                };
            }
            return {
                overrides: (id) => ({
                    isDummy,
                    isOutputNode: isOutputNode || undefined,
                    selectedOutputs: isOutputNode ? null : undefined,
                    onSaveParameters: isDummy ? null : (newData) => handlers.handleNodeUpdate(id, newData),
                    onSaveIO: isDummy ? (data) => handlers.handleIONodeUpdate(id, data) : null,
                    onSaveOutputConfig: isOutputNode ? (data) => handlers.handleOutputNodeUpdate(id, data) : null,
                }),
            };
        },
        // Reason: handlers + triggerBIDSDirectoryPicker are passed in by the parent and re-created each render; the closures they wrap use stable setNodes/markForSync internally. Re-running this useCallback when handlers churn would cascade into recreating onDrop on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [customWorkflows],
    );

    // Pipeline expansion: replace a collapsed PipelineNode wrapper with its
    // constituent CLI nodes from PIPELINE_DEFINITIONS. Conditional nodes
    // (gated by pipelineOptions) are filtered out before expansion. Edges
    // attached to the wrapper are re-routed to the boundary nodes of the
    // expanded graph. The wrapper itself is removed (destructive replace,
    // mirroring `kind: 'workflow'` saved workflow expansion).
    //
    // Reads current node state via `nodesRef` (parent must keep it synced).
    const expandPipelineNode = useCallback(
        (pipelineNodeId) => {
            const pipelineNode = nodesRef?.current?.find((n) => n.id === pipelineNodeId);
            if (!pipelineNode || !pipelineNode.data?.isPipeline) {
                showError('Pipeline node not found for expansion.');
                return;
            }
            const def = getPipelineDefinition(pipelineNode.data.pipelineId);
            if (!def) {
                showError(`Pipeline definition "${pipelineNode.data.pipelineId}" not registered.`);
                return;
            }

            const { nodes: filteredNodes, edges: filteredEdges } = filterPipelineByOptions(
                def,
                pipelineNode.data.pipelineOptions || {},
            );
            if (filteredNodes.length === 0) {
                showError('No active nodes to expand with the current options.');
                return;
            }

            // Position offset: anchor the expanded graph's top-left at the
            // pipeline wrapper's current position so the user sees expansion
            // happen "from" the wrapper.
            const minX = Math.min(...filteredNodes.map((n) => n.position?.x ?? 0));
            const minY = Math.min(...filteredNodes.map((n) => n.position?.y ?? 0));
            const dropPosition = pipelineNode.position || { x: 0, y: 0 };
            const offset = { x: dropPosition.x - minX, y: dropPosition.y - minY };

            const idMap = new Map(filteredNodes.map((n) => [n.id, crypto.randomUUID()]));

            // Resolve boundary node ids in the expanded graph (used to
            // re-route external edges that were attached to the wrapper).
            // Boundary refs in pipeline definitions are node IDs.
            const firstBoundaryId = idMap.get(def.boundaryNodes?.firstNonDummy) || idMap.get(filteredNodes[0].id);
            const lastBoundaryId =
                idMap.get(def.boundaryNodes?.lastNonDummy) || idMap.get(filteredNodes[filteredNodes.length - 1].id);

            const newNodes = filteredNodes.map((pNode) => {
                const newId = idMap.get(pNode.id);
                const base = deserializeNode(pNode);
                const d = base.data;
                return {
                    id: newId,
                    type: base.type,
                    position: {
                        x: (base.position?.x ?? 0) + offset.x,
                        y: (base.position?.y ?? 0) + offset.y,
                    },
                    data: {
                        ...d,
                        // Preserve gap flag through deserialization (deserializeNode
                        // doesn't know about _gap; copy it through manually).
                        _gap: pNode._gap || false,
                        stage: pNode.stage,
                        onSaveParameters: (newData) => handlers.handleNodeUpdate(newId, newData),
                    },
                };
            });

            const newEdges = filteredEdges
                .map((e, idx) => {
                    const newSource = idMap.get(e.source);
                    const newTarget = idMap.get(e.target);
                    if (!newSource || !newTarget) return null;
                    return {
                        id: e.id ? `${e.id}-exp-${idx}` : `${newSource}-${newTarget}-${idx}`,
                        source: newSource,
                        target: newTarget,
                        data: { mappings: e.data?.mappings || [] },
                        animated: true,
                        markerEnd: EDGE_ARROW,
                        style: { strokeWidth: 2 },
                    };
                })
                .filter(Boolean);

            // Re-route external edges that were attached to the pipeline
            // wrapper: source on wrapper → source on last boundary; target
            // on wrapper → target on first boundary.
            setNodes((prev) => prev.filter((n) => n.id !== pipelineNodeId).concat(newNodes));
            setEdges((prev) => {
                const rerouted = prev.map((e) => {
                    if (e.source === pipelineNodeId && lastBoundaryId) {
                        return { ...e, source: lastBoundaryId };
                    }
                    if (e.target === pipelineNodeId && firstBoundaryId) {
                        return { ...e, target: firstBoundaryId };
                    }
                    return e;
                });
                return [...rerouted, ...newEdges];
            });
            markForSync();
        },
        // Reason: handlers + showError churn each render; closures resolve
        // them at fire time. Matching the pattern used by expandSavedWorkflow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [setNodes, setEdges, markForSync, showError],
    );

    // Workflow expansion drop: takes a saved workflow (kind='workflow') and
    // splats every saved node + edge onto the canvas with fresh UUIDs. Edges
    // are remapped to the new IDs, callbacks reattached per node-kind (the
    // same set the existing rehydration loop on workspace load attaches), and
    // positions are translated so the saved layout's top-left lands at the
    // drop point.
    //
    // The composite-node drop path (custom-node-kind, via
    // `node/customWorkflowId`) is left untouched and still flows through
    // `buildNodeOverrides` above.
    const expandSavedWorkflow = useCallback(
        (savedWorkflowId, dropPosition) => {
            const saved = customWorkflows.find((w) => w.id === savedWorkflowId);
            if (!saved) {
                showError('Workflow to expand was not found.');
                return;
            }
            // Defense-in-depth: the drag protocol in workflowMenu only sets
            // node/expand=true for kind='workflow' entries, but a programmatic
            // drop (CWL import, paste, command palette) could route a
            // custom-node id here. Splatting a custom-node's internals would
            // contradict its "single composite node" semantics.
            if ((saved.kind || 'custom-node') !== 'workflow') {
                showError('Cannot expand: this entry is a custom node, not a workflow.');
                return;
            }
            const savedNodes = saved.nodes || [];
            if (savedNodes.length === 0) return;

            const minX = Math.min(...savedNodes.map((n) => n.position?.x ?? 0));
            const minY = Math.min(...savedNodes.map((n) => n.position?.y ?? 0));
            const offset = { x: dropPosition.x - minX, y: dropPosition.y - minY };

            const idMap = new Map(savedNodes.map((n) => [n.id, crypto.randomUUID()]));

            const newNodes = savedNodes.map((savedNode) => {
                const newId = idMap.get(savedNode.id);
                const base = deserializeNode(savedNode);
                const d = base.data;
                const data = {
                    ...d,
                    onSaveParameters: d.isDummy ? null : (newParams) => handlers.handleNodeUpdate(newId, newParams),
                    ...(d.isBIDS ? { onUpdateBIDS: (updates) => handlers.handleBIDSNodeUpdate(newId, updates) } : {}),
                    ...(d.isStandardTemplate
                        ? {
                              onUpdateStandardTemplate: (updates) =>
                                  handlers.handleStandardTemplateUpdate(newId, updates),
                          }
                        : {}),
                    onSaveIO: d.isDummy ? (data2) => handlers.handleIONodeUpdate(newId, data2) : null,
                    onSaveOutputConfig:
                        d.isDummy && d.label === 'Output'
                            ? (data2) => handlers.handleOutputNodeUpdate(newId, data2)
                            : null,
                };
                return {
                    id: newId,
                    type: base.type,
                    position: {
                        x: (base.position?.x ?? 0) + offset.x,
                        y: (base.position?.y ?? 0) + offset.y,
                    },
                    data,
                };
            });

            const newEdges = (saved.edges || [])
                .map((e, idx) => {
                    const newSource = idMap.get(e.source);
                    const newTarget = idMap.get(e.target);
                    if (!newSource || !newTarget) return null;
                    return {
                        id: e.id ? `${e.id}-exp-${idx}` : `${newSource}-${newTarget}-${idx}`,
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
        },
        // Reason: handlers are read at fire time (per-node closures get latest at expansion time); including the parent-supplied handlers prop would recreate this on every render and cascade into onDrop recreation.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [customWorkflows, setNodes, setEdges, markForSync, showError],
    );

    // On drop, create a new node — or, for workflow-kind drags, expand the
    // saved workflow's nodes+edges in place.
    const onDrop = useCallback(
        (event) => {
            event.preventDefault();
            if (!reactFlowInstance) return;

            const flowPosition = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const savedWorkflowId = event.dataTransfer.getData('node/savedWorkflowId');
            const shouldExpand = event.dataTransfer.getData('node/expand') === 'true';
            if (shouldExpand && savedWorkflowId) {
                expandSavedWorkflow(savedWorkflowId, flowPosition);
                return;
            }

            const name = event.dataTransfer.getData('node/name') || 'Unnamed Node';
            const isDummy = event.dataTransfer.getData('node/isDummy') === 'true';
            const isBIDS = event.dataTransfer.getData('node/isBIDS') === 'true';
            const isOutputNode = event.dataTransfer.getData('node/isOutputNode') === 'true';
            const isStandardTemplate = event.dataTransfer.getData('node/isStandardTemplate') === 'true';
            const customWorkflowId = event.dataTransfer.getData('node/customWorkflowId');
            const pipelineId = event.dataTransfer.getData('node/pipelineId');

            const result = buildNodeOverrides(name, {
                isDummy,
                isBIDS,
                isOutputNode,
                isStandardTemplate,
                customWorkflowId,
                pipelineId,
            });
            if (!result) return;
            createNodeAt(flowPosition, name, result.overrides, result.afterAdd);
        },
        [reactFlowInstance, expandSavedWorkflow, buildNodeOverrides, createNodeAt],
    );

    const addNodeAtCenter = useCallback(
        (name, opts = {}) => {
            if (!reactFlowInstance) return;
            const { x, y, zoom } = reactFlowInstance.getViewport();
            const wrapper = reactFlowWrapper.current;
            if (!wrapper) return;
            const cx = (-x + wrapper.clientWidth / 2) / zoom;
            const cy = (-y + wrapper.clientHeight / 2) / zoom;

            const result = buildNodeOverrides(name, opts);
            if (!result) return;
            createNodeAt({ x: cx, y: cy }, name, result.overrides, result.afterAdd);
        },
        [reactFlowInstance, reactFlowWrapper, createNodeAt, buildNodeOverrides],
    );

    return { onDragOver, onDrop, addNodeAtCenter, expandPipelineNode };
}
