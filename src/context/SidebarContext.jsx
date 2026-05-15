import { createContext, useCallback, useContext, useMemo, useState } from 'react';

/**
 * Sidebar UI state for the left panel of the IDE.
 *
 * Holds two pieces:
 *   - `activeTab` ('menu' | 'params' | 'bids') — which view the sidebar tab
 *     strip is showing. Global across workspaces (matches the utility bar's
 *     pattern).
 *   - `selectedByWs` — per-workspace selected nodeId. Each workspace tracks
 *     its own selection so switching tabs in IDELayout doesn't clobber the
 *     other workspace's "currently-being-edited" node.
 *
 * The Params and BIDS tabs in the sidebar both read
 * `selectedByWs[activeWorkspaceId]` to decide what panel to render (and
 * whether to enable/disable the tab itself).
 *
 * State is intentionally NOT persisted to localStorage — reload resets to
 * 'menu' + cleared selections. Matches the existing IDELayout convention
 * (see comment at IDELayout.jsx:51).
 */

const SidebarContext = createContext(null);

export function SidebarProvider({ children }) {
    const [activeTab, setActiveTab] = useState('menu');
    const [selectedByWs, setSelectedByWs] = useState({});

    const setSelectedNode = useCallback((wsId, nodeId) => {
        if (!wsId) return;
        setSelectedByWs((prev) => {
            if (prev[wsId] === nodeId) return prev; // no-op when unchanged
            return { ...prev, [wsId]: nodeId };
        });
    }, []);

    const clearSelectedNode = useCallback((wsId) => {
        if (!wsId) return;
        setSelectedByWs((prev) => {
            if (prev[wsId] == null) return prev;
            return { ...prev, [wsId]: null };
        });
    }, []);

    const getSelectedNode = useCallback((wsId) => (wsId ? selectedByWs[wsId] || null : null), [selectedByWs]);

    const value = useMemo(
        () => ({
            activeTab,
            setActiveTab,
            getSelectedNode,
            setSelectedNode,
            clearSelectedNode,
            selectedByWs,
        }),
        [activeTab, getSelectedNode, setSelectedNode, clearSelectedNode, selectedByWs],
    );

    return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
    const ctx = useContext(SidebarContext);
    if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
    return ctx;
}
