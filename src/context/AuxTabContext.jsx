import { createContext, useContext, useCallback, useRef } from 'react';
import { useAuxTabs } from '../hooks/useAuxTabs.js';

const AuxTabContext = createContext(null);

export function AuxTabProvider({ children }) {
    const auxTabsApi = useAuxTabs();
    const { auxTabs, activeTabKey, closeAuxTab: rawCloseAuxTab, setActiveTabKey } = auxTabsApi;

    // Registry of save handlers keyed by `${type}-${nodeId}`. Modal-trigger components
    // register their save handlers on mount so AuxTabRenderer can route tab saves
    // through the same flow the modal would have used.
    const saveHandlersRef = useRef(new Map());

    const registerSaveHandler = useCallback((type, nodeId, fn) => {
        const key = `${type}-${nodeId}`;
        saveHandlersRef.current.set(key, fn);
        return () => {
            const cur = saveHandlersRef.current.get(key);
            if (cur === fn) saveHandlersRef.current.delete(key);
        };
    }, []);

    const invokeSaveHandler = useCallback((type, nodeId, ...args) => {
        const key = `${type}-${nodeId}`;
        const fn = saveHandlersRef.current.get(key);
        if (typeof fn === 'function') {
            fn(...args);
            return true;
        }
        return false;
    }, []);

    // Wrap closeAuxTab so closing the *active* aux tab atomically returns focus
    // to its parent workspace. Aux tabs always belong to a live workspace (the
    // workspace-removal flow cascades-closes their aux tabs together), so the
    // workspaceId is always a valid target here. Closing a non-active aux tab
    // doesn't touch focus.
    const closeAuxTab = useCallback(
        (id) => {
            const closedKey = `aux-${id}`;
            if (activeTabKey === closedKey) {
                const tab = auxTabs.find((t) => t.id === id);
                if (tab) setActiveTabKey(`ws-${tab.workspaceId}`);
            }
            rawCloseAuxTab(id);
        },
        [auxTabs, activeTabKey, rawCloseAuxTab, setActiveTabKey],
    );

    const value = { ...auxTabsApi, closeAuxTab, registerSaveHandler, invokeSaveHandler };

    return <AuxTabContext.Provider value={value}>{children}</AuxTabContext.Provider>;
}

export function useAuxTabsContext() {
    const ctx = useContext(AuxTabContext);
    if (!ctx) {
        throw new Error('useAuxTabsContext must be used within an AuxTabProvider');
    }
    return ctx;
}
