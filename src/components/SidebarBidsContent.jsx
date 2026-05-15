import { useCallback, useEffect, useMemo, useRef } from 'react';
import BIDSDataPanel from './BIDSDataPanel.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

/**
 * Renders the right panel for the active workspace's selected node when the
 * sidebar's "BIDS" tab is active. Dispatches on `node.data?.isBIDS`:
 *   - isBIDS  → BIDSDataPanel
 *   - otherwise → null (defense — IDELayout's bidsDisabled should keep us
 *                 un-rendered for non-BIDS selections)
 *
 * Save flow mirrors SidebarParamContent: invoke the registered save handler
 * from AuxTabContext (workflowCanvas registers `bids-modal` handlers on
 * mount), then surface a toast. Unlike the aux-tab path, the sidebar does NOT
 * close on save — the user stays on the BIDS tab, panel stays open on the
 * same node. Selection changes naturally re-key the panel by changing
 * `node.id`, which remounts the local state.
 *
 * Expand-to-tab: the panel renders an "expand" button in its tab-mode header.
 * Clicking it snapshots the current draft via the panel's `getDraftState`
 * imperative handle, opens an aux tab carrying that draft as `initialState`,
 * and flips the sidebar back to the Tools tab — preventing the sidebar and
 * aux tab from rendering the same panel concurrently. The aux tab's
 * `workspaceId` ties it to the originating workspace so cascade-close /
 * focus-return plumbing in AuxTabContext flows naturally.
 */
function SidebarBidsContent({ workspace, onDirtyChange = null }) {
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

    const isBIDS = !!node?.data?.isBIDS;

    // Ref to the BIDS panel — exposes getDraftState() via useImperativeHandle
    // for snapshotting the unsaved draft when expanding to an aux tab.
    const bidsPanelRef = useRef(null);

    const workspaceId = workspace?.id || null;

    // Reset the parent's dirty flag whenever the selected node changes or this
    // host unmounts. The inner panel re-keys on nodeId so its local state
    // resets to clean; the parent's stored dirty flag has to be reset to match.
    useEffect(() => {
        return () => onDirtyChangeRef.current?.(false);
    }, [nodeId]);

    const handleExpandBids = useCallback(() => {
        if (!workspaceId || !nodeId) return;
        const draft = bidsPanelRef.current?.getDraftState?.();
        const id = openAuxTab({
            type: 'bids-modal',
            workspaceId,
            nodeId,
            initialState: draft || null,
        });
        if (id) setActiveTabKey(`aux-${id}`);
        // Flip sidebar back to Tools so the sidebar and aux tab don't render
        // the same panel concurrently.
        setActiveTab('menu');
    }, [workspaceId, nodeId, openAuxTab, setActiveTabKey, setActiveTab]);

    if (!node || !isBIDS) return null; // defense — IDELayout's bidsDisabled should keep us un-rendered

    const nodeLabel = node.data?.displayLabel || node.data?.label || nodeId;

    return (
        <BIDSDataPanel
            // Re-key on nodeId so switching to a different selected node remounts
            // the panel with fresh local state instead of reusing the prior node's
            // unsaved-draft state.
            key={nodeId}
            ref={bidsPanelRef}
            bidsStructure={node.data?.bidsStructure}
            savedSelections={node.data?.bidsSelections}
            onSave={(data) => {
                const ok = invokeSaveHandler('bids-modal', nodeId, data);
                if (ok) {
                    showInfo(`BIDS data saved for "${nodeLabel}"`);
                } else {
                    console.warn('[SidebarBidsContent] No bids-modal save handler registered for', nodeId);
                    showWarning(`Couldn't save BIDS data — "${nodeLabel}" is no longer on the canvas`);
                }
            }}
            onCancel={() => {
                /* No close gesture in sidebar context; tab strip provides the affordance. */
            }}
            onExpand={handleExpandBids}
            onDirtyChange={onDirtyChange}
            mode="tab"
        />
    );
}

export default SidebarBidsContent;
