import { useRef } from 'react';
import { parseBIDSDirectory } from '../utils/bidsParser.js';

/**
 * Custom hook encapsulating all BIDS node state and handlers.
 * Manages the BIDS directory picker and node updates for both regular BIDS nodes
 * and internal BIDS nodes within custom workflows.
 *
 * Opening the BIDS editor activates the left sidebar's BIDS tab (and selects
 * the target node) — callers pass `setActiveSidebarTab` and `setSidebarSelectedNode`
 * + `workspaceId` so the hook can drive the sidebar directly. The aux-tab path
 * remains available via the "expand" button inside the sidebar panel.
 */
export function useBIDSHandler({
    setNodes,
    markForSync,
    showError,
    showWarning,
    showInfo,
    setActiveSidebarTab,
    setSidebarSelectedNode,
    workspaceId,
}) {
    const bidsFileInputRef = useRef(null);
    const bidsPickerTargetRef = useRef(null);

    // For a regular BIDS node, the sidebar selection is the BIDS node id. For
    // an internal BIDS node inside a custom workflow, the selection is the
    // wrapping custom-workflow node id — workflowCanvas registers the save
    // handler under that id (see registerSaveHandler('bids-modal', nodeId, ...)).
    const openBIDSTab = (nodeIdForTab) => {
        if (!workspaceId || !nodeIdForTab) return;
        if (typeof setSidebarSelectedNode === 'function') {
            setSidebarSelectedNode(workspaceId, nodeIdForTab);
        }
        if (typeof setActiveSidebarTab === 'function') {
            setActiveSidebarTab('bids');
        }
    };

    const handleBIDSNodeUpdate = (nodeId, updates) => {
        // Handle signal actions from NodeComponent
        if (updates._openModal || updates._openTab) {
            bidsPickerTargetRef.current = nodeId;
            openBIDSTab(nodeId);
            return;
        }
        if (updates._pickDirectory) {
            bidsPickerTargetRef.current = nodeId;
            bidsFileInputRef.current?.click();
            return;
        }
        // Normal data update
        setNodes((prevNodes) =>
            prevNodes.map((node) => (node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node)),
        );
        markForSync();
    };

    // Update an internal BIDS node within a custom workflow node
    const updateInternalBIDSNode = (cwNodeId, updates) => {
        setNodes((prevNodes) =>
            prevNodes.map((node) => {
                if (node.id !== cwNodeId) return node;
                const updatedInternalNodes = (node.data.internalNodes || []).map((n) =>
                    n.isBIDS ? { ...n, ...updates } : n,
                );
                return {
                    ...node,
                    data: { ...node.data, internalNodes: updatedInternalNodes },
                };
            }),
        );
        markForSync();
    };

    // Handle BIDS actions for internal BIDS nodes within custom workflows
    const handleInternalBIDSUpdate = (cwNodeId, updates) => {
        if (updates._openModal || updates._openTab) {
            bidsPickerTargetRef.current = { cwNodeId };
            openBIDSTab(cwNodeId);
            return;
        }
        if (updates._pickDirectory) {
            bidsPickerTargetRef.current = { cwNodeId };
            bidsFileInputRef.current?.click();
            return;
        }
    };

    const triggerBIDSDirectoryPicker = (nodeId) => {
        bidsPickerTargetRef.current = nodeId;
        bidsFileInputRef.current?.click();
    };

    const handleBIDSDirectorySelected = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const target = bidsPickerTargetRef.current;
        if (!target) return;

        const result = await parseBIDSDirectory(files);

        if (result.errors.length > 0) {
            result.errors.forEach((e) => showError(e, 6000));
            event.target.value = '';
            return;
        }

        if (result.warnings.length > 0) {
            result.warnings.forEach((w) => showWarning(w, 5000));
        }

        if (result.info.length > 0) {
            showInfo(result.info.join(' '));
        }

        // Store structure and open the BIDS tab — route to internal or regular BIDS node.
        if (target !== null && typeof target === 'object' && target.cwNodeId) {
            updateInternalBIDSNode(target.cwNodeId, { bidsStructure: result.bidsStructure });
            openBIDSTab(target.cwNodeId);
        } else {
            handleBIDSNodeUpdate(target, { bidsStructure: result.bidsStructure });
            openBIDSTab(target);
        }

        // Reset file input so same directory can be re-selected
        event.target.value = '';
    };

    return {
        bidsFileInputRef,
        bidsPickerTargetRef,
        handleBIDSNodeUpdate,
        handleInternalBIDSUpdate,
        triggerBIDSDirectoryPicker,
        handleBIDSDirectorySelected,
    };
}
