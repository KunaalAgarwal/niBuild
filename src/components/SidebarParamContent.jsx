import { useCallback, useEffect, useMemo, useRef } from 'react';
import ToolParamPanel from './ToolParamPanel.jsx';
import CustomWorkflowParamPanel from './CustomWorkflowParamPanel.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useToolParamContext, useCustomWorkflowWiredInputs } from '../hooks/useNodeParamContext.js';

/**
 * Renders the right panel for the active workspace's selected node when the
 * sidebar's "Params" tab is active. Dispatches on node type:
 *   - 'tool'           → ToolParamPanel
 *   - 'customWorkflow' → CustomWorkflowParamPanel
 *
 * Save flow mirrors AuxTabRenderer's: invoke the registered save handler from
 * AuxTabContext (workflowCanvas registers `tool-param-modal` and `param-modal`
 * handlers on mount), then surface a toast. Unlike the aux-tab path, the
 * sidebar does NOT close on save — the user stays on Params, and the panel
 * stays open on the same node. Selection changes naturally re-key the panel
 * by changing `node.id`, which remounts the local state.
 *
 * Expand-to-tab: each panel renders an `⤢` button in its header. Clicking it
 * snapshots the current draft via the panel's `getDraftState` imperative handle,
 * opens an aux tab carrying that draft as `initialState`, and flips the sidebar
 * back to the Tools tab — preventing the sidebar and aux tab from rendering the
 * same panel concurrently (which would otherwise be safe thanks to per-instance
 * id scoping, but is still cleaner UX). The aux tab's `workspaceId` ties it to
 * the originating workspace so cascade-close / focus-return plumbing in
 * AuxTabContext flows naturally.
 *
 * BIDS is intentionally not dispatched here (out of scope). If the user
 * single-clicks a BIDS node, IDELayout will see `paramsDisabled === true`
 * (because the node type isn't 'tool' or 'customWorkflow') and the Params
 * tab will be greyed out — preventing SidebarParamContent from ever rendering
 * for a BIDS selection.
 */
function SidebarParamContent({ workspace, onDirtyChange = null }) {
    const { getSelectedNode, setActiveTab } = useSidebar();
    const { invokeSaveHandler, openAuxTab, setActiveTabKey } = useAuxTabsContext();
    const { showInfo, showWarning } = useToast();

    // Ref-mirror onDirtyChange so the reset effect doesn't need it as a dep.
    const onDirtyChangeRef = useRef(onDirtyChange);
    onDirtyChangeRef.current = onDirtyChange;

    const nodeId = workspace ? getSelectedNode(workspace.id) : null;
    const node = useMemo(
        () => (nodeId ? (workspace?.nodes || []).find((n) => n.id === nodeId) : null),
        [workspace, nodeId],
    );

    // Node-kind dispatching mirrors NodeComponent.jsx:32-63 — all canvas nodes
    // are ReactFlow type 'default'; semantic kind lives in node.data flags.
    const isDummy = !!node?.data?.isDummy;
    const isCustomWorkflow = !!node?.data?.isCustomWorkflow;
    const isTool = !!node && !isDummy && !isCustomWorkflow;

    // Hooks must be called unconditionally; pass null/null when not applicable so
    // the hook short-circuits to its empty-shape default.
    const toolCtx = useToolParamContext(isTool ? workspace : null, isTool ? nodeId : null);
    const customWired = useCustomWorkflowWiredInputs(isCustomWorkflow ? node : null);

    // Refs are unconditionally created so the rules-of-hooks contract is honored
    // regardless of which panel branch renders below. Each panel exposes
    // `getDraftState` via `useImperativeHandle`; we use that to snapshot the
    // unsaved draft and hand it to the aux tab as `initialState`.
    const toolPanelRef = useRef(null);
    const customPanelRef = useRef(null);

    const workspaceId = workspace?.id || null;

    // Reset the parent's dirty flag whenever the selected node changes or this
    // host unmounts. The inner panel re-keys on nodeId so its local state
    // resets to clean; the parent's stored dirty flag has to be reset to match.
    useEffect(() => {
        return () => onDirtyChangeRef.current?.(false);
    }, [nodeId]);

    const handleExpandTool = useCallback(() => {
        if (!workspaceId || !nodeId) return;
        const draft = toolPanelRef.current?.getDraftState?.();
        const id = openAuxTab({
            type: 'tool-param-modal',
            workspaceId,
            nodeId,
            initialState: draft || null,
        });
        if (id) setActiveTabKey(`aux-${id}`);
        // Flip sidebar back to Tools so the sidebar and aux tab don't render the
        // same panel concurrently.
        setActiveTab('menu');
    }, [workspaceId, nodeId, openAuxTab, setActiveTabKey, setActiveTab]);

    const handleExpandCustom = useCallback(() => {
        if (!workspaceId || !nodeId) return;
        const draft = customPanelRef.current?.getDraftState?.();
        const id = openAuxTab({
            type: 'param-modal',
            workspaceId,
            nodeId,
            initialState: draft || null,
        });
        if (id) setActiveTabKey(`aux-${id}`);
        setActiveTab('menu');
    }, [workspaceId, nodeId, openAuxTab, setActiveTabKey, setActiveTab]);

    if (!node) return null; // defense — IDELayout's paramsDisabled should keep us un-rendered

    const workflowName = workspace?.name || 'Workspace';
    const nodeLabel = node.data?.displayLabel || node.data?.label || nodeId;

    if (isTool) {
        const enrichedNodeData = {
            ...(node.data || {}),
            isGatherNode: toolCtx.isGatherNode,
            isScatterInherited: toolCtx.isScatterInherited,
        };
        return (
            <ToolParamPanel
                // Re-key on nodeId so switching to a different selected node remounts
                // the panel with fresh local state instead of reusing the prior node's
                // unsaved-draft state.
                key={nodeId}
                ref={toolPanelRef}
                nodeData={enrichedNodeData}
                nodeId={nodeId}
                workflowName={workflowName}
                upstreamScatterInputs={toolCtx.upstreamScatterInputs}
                wiredInputs={toolCtx.wiredInputs}
                onSave={(payload) => {
                    const ok = invokeSaveHandler('tool-param-modal', nodeId, payload);
                    if (ok) {
                        showInfo(`Parameters saved for "${nodeLabel}"`);
                    } else {
                        console.warn('[SidebarParamContent] No tool-param-modal save handler registered for', nodeId);
                        showWarning(`Couldn't save parameters — "${nodeLabel}" is no longer on the canvas`);
                    }
                }}
                onExpand={handleExpandTool}
                onDirtyChange={onDirtyChange}
                mode="tab"
            />
        );
    }

    if (isCustomWorkflow) {
        return (
            <CustomWorkflowParamPanel
                key={nodeId}
                ref={customPanelRef}
                workflowName={node.data?.label || ''}
                internalNodes={node.data?.internalNodes || []}
                internalEdges={node.data?.internalEdges || []}
                wiredInputs={customWired}
                onSave={(updatedInternalNodes) => {
                    const ok = invokeSaveHandler('param-modal', nodeId, updatedInternalNodes);
                    if (ok) {
                        showInfo(`Workflow parameters saved for "${nodeLabel}"`);
                    } else {
                        console.warn('[SidebarParamContent] No param-modal save handler registered for', nodeId);
                        showWarning(`Couldn't save workflow parameters — "${nodeLabel}" is no longer on the canvas`);
                    }
                }}
                onCancel={() => {
                    /* No close gesture in sidebar context; tab strip provides the affordance. */
                }}
                onExpand={handleExpandCustom}
                onDirtyChange={onDirtyChange}
                mode="tab"
            />
        );
    }

    return null;
}

export default SidebarParamContent;
