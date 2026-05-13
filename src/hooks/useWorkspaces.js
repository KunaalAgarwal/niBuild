import { useReducer, useCallback } from 'react';
import { useDebouncedStorage } from './useDebouncedStorage.js';

const DEFAULT_WORKSPACE = {
    id: crypto.randomUUID(),
    nodes: [],
    edges: [],
    name: '',
    workflowName: '',
    savedWorkflowId: null,
    viewport: null,
    syncVersion: 0,
};

function migrateWorkspace(ws) {
    return {
        id: ws.id || crypto.randomUUID(),
        nodes: ws.nodes || [],
        edges: ws.edges || [],
        name: ws.name || '',
        workflowName: ws.workflowName || '',
        savedWorkflowId: ws.savedWorkflowId || null,
        viewport: ws.viewport || null,
        syncVersion: ws.syncVersion || 0,
    };
}

function initState() {
    let workspaces = [DEFAULT_WORKSPACE];
    let currentIndex = 0;
    try {
        const saved = JSON.parse(localStorage.getItem('workspaces'));
        if (Array.isArray(saved) && saved.length > 0) {
            workspaces = saved.map(migrateWorkspace);
        }
    } catch {
        /* corrupted localStorage — use default */
    }
    try {
        const savedIdx = parseInt(localStorage.getItem('currentWorkspace'), 10);
        if (!isNaN(savedIdx) && savedIdx >= 0 && savedIdx < workspaces.length) {
            currentIndex = savedIdx;
        }
    } catch {
        /* fall through */
    }
    return { workspaces, currentIndex };
}

function workspaceReducer(state, action) {
    switch (action.type) {
        case 'ADD_WORKSPACE': {
            const newWs = {
                id: crypto.randomUUID(),
                nodes: [],
                edges: [],
                name: '',
                workflowName: '',
                savedWorkflowId: null,
                viewport: null,
                syncVersion: 0,
            };
            const updated = [...state.workspaces, newWs];
            return { workspaces: updated, currentIndex: updated.length - 1 };
        }
        case 'ADD_WORKSPACE_WITH_DATA': {
            const { data } = action;
            const newWs = {
                id: crypto.randomUUID(),
                nodes: data.nodes || [],
                edges: data.edges || [],
                name: data.name || '',
                workflowName: data.workflowName || '',
                savedWorkflowId: data.savedWorkflowId || null,
                viewport: null,
                syncVersion: 0,
            };
            const updated = [...state.workspaces, newWs];
            return { workspaces: updated, currentIndex: updated.length - 1 };
        }
        case 'CLEAR_CURRENT': {
            const ws = state.workspaces[state.currentIndex];
            const updated = [...state.workspaces];
            updated[state.currentIndex] = {
                id: ws?.id || crypto.randomUUID(),
                nodes: [],
                edges: [],
                name: ws?.name || '',
                workflowName: ws?.workflowName || '',
                savedWorkflowId: ws?.savedWorkflowId || null,
                viewport: null,
                syncVersion: ws?.syncVersion || 0,
            };
            return { ...state, workspaces: updated };
        }
        case 'UPDATE_CURRENT_ITEMS': {
            const { newItems } = action;
            const ws = state.workspaces[state.currentIndex];
            const updated = [...state.workspaces];
            updated[state.currentIndex] = {
                ...newItems,
                id: ws?.id || crypto.randomUUID(),
                name: ws?.name || '',
                workflowName: ws?.workflowName || '',
                savedWorkflowId: ws?.savedWorkflowId || null,
                viewport: newItems.viewport !== undefined ? newItems.viewport : ws?.viewport || null,
                syncVersion: ws?.syncVersion || 0,
            };
            return { ...state, workspaces: updated };
        }
        case 'REMOVE_CURRENT': {
            if (state.workspaces.length === 1) return state;
            const idx = state.currentIndex;
            const updated = state.workspaces.filter((_, i) => i !== idx);
            return {
                workspaces: updated,
                currentIndex: idx >= updated.length ? updated.length - 1 : idx,
            };
        }
        case 'REMOVE_AT': {
            if (state.workspaces.length === 1) return state;
            const rmIdx = action.index;
            const remaining = state.workspaces.filter((_, i) => i !== rmIdx);
            let newIndex = state.currentIndex;
            if (rmIdx < state.currentIndex) newIndex--;
            else if (rmIdx === state.currentIndex) newIndex = Math.min(newIndex, remaining.length - 1);
            return { workspaces: remaining, currentIndex: newIndex };
        }
        case 'RENAME_AT': {
            const updated = [...state.workspaces];
            updated[action.index] = {
                ...updated[action.index],
                name: action.name,
                workflowName: action.name,
            };
            return { ...state, workspaces: updated };
        }
        case 'UPDATE_NAME': {
            const updated = [...state.workspaces];
            updated[state.currentIndex] = { ...updated[state.currentIndex], name: action.name };
            return { ...state, workspaces: updated };
        }
        case 'UPDATE_WORKFLOW_NAME': {
            const updated = [...state.workspaces];
            updated[state.currentIndex] = { ...updated[state.currentIndex], workflowName: action.name };
            return { ...state, workspaces: updated };
        }
        case 'UPDATE_SAVED_ID': {
            const updated = [...state.workspaces];
            updated[state.currentIndex] = { ...updated[state.currentIndex], savedWorkflowId: action.id };
            return { ...state, workspaces: updated };
        }
        case 'REMOVE_WORKFLOW_NODES': {
            const { workflowId } = action;
            let anyChanged = false;
            const updated = state.workspaces.map((ws) => {
                const removedIds = new Set();
                const filteredNodes = ws.nodes.filter((n) => {
                    if (n.data?.isCustomWorkflow && n.data?.customWorkflowId === workflowId) {
                        removedIds.add(n.id);
                        return false;
                    }
                    return true;
                });
                if (removedIds.size === 0) return ws;
                anyChanged = true;
                const filteredEdges = ws.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target));
                return { ...ws, nodes: filteredNodes, edges: filteredEdges };
            });
            return anyChanged ? { ...state, workspaces: updated } : state;
        }
        case 'SAVE_VIEWPORT': {
            const { index, viewport } = action;
            if (index < 0 || index >= state.workspaces.length) return state;
            const updated = [...state.workspaces];
            updated[index] = { ...updated[index], viewport };
            return { ...state, workspaces: updated };
        }
        case 'SET_CURRENT_INDEX': {
            const idx = action.index;
            if (idx < 0 || idx >= state.workspaces.length) return state;
            return { ...state, currentIndex: idx };
        }
        case 'REVERT_CURRENT_ITEMS': {
            const { nodes, edges } = action;
            const ws = state.workspaces[state.currentIndex];
            const updated = [...state.workspaces];
            updated[state.currentIndex] = {
                ...ws,
                nodes,
                edges,
                syncVersion: (ws.syncVersion || 0) + 1,
            };
            return { ...state, workspaces: updated };
        }
        default:
            return state;
    }
}

export function useWorkspaces() {
    const [state, dispatch] = useReducer(workspaceReducer, undefined, initState);

    // Debounced localStorage writes (300ms delay prevents main thread blocking)
    useDebouncedStorage('workspaces', state.workspaces, 300);
    useDebouncedStorage('currentWorkspace', state.currentIndex, 300);

    const addNewWorkspace = useCallback(() => dispatch({ type: 'ADD_WORKSPACE' }), []);
    const addNewWorkspaceWithData = useCallback((data) => dispatch({ type: 'ADD_WORKSPACE_WITH_DATA', data }), []);
    const clearCurrentWorkspace = useCallback(() => dispatch({ type: 'CLEAR_CURRENT' }), []);
    const updateCurrentWorkspaceItems = useCallback(
        (newItems) => dispatch({ type: 'UPDATE_CURRENT_ITEMS', newItems }),
        [],
    );
    const removeCurrentWorkspace = useCallback(() => dispatch({ type: 'REMOVE_CURRENT' }), []);
    const removeWorkspace = useCallback((index) => dispatch({ type: 'REMOVE_AT', index }), []);
    const renameWorkspace = useCallback((index, name) => dispatch({ type: 'RENAME_AT', index, name }), []);
    const updateWorkspaceName = useCallback((newName) => dispatch({ type: 'UPDATE_NAME', name: newName }), []);
    const updateWorkflowName = useCallback((newName) => dispatch({ type: 'UPDATE_WORKFLOW_NAME', name: newName }), []);
    const updateSavedWorkflowId = useCallback((id) => dispatch({ type: 'UPDATE_SAVED_ID', id }), []);
    const removeWorkflowNodesFromAll = useCallback(
        (workflowId) => dispatch({ type: 'REMOVE_WORKFLOW_NODES', workflowId }),
        [],
    );
    const saveViewportForWorkspace = useCallback(
        (index, viewport) => dispatch({ type: 'SAVE_VIEWPORT', index, viewport }),
        [],
    );
    const revertCurrentWorkspaceItems = useCallback(
        (nodes, edges) => dispatch({ type: 'REVERT_CURRENT_ITEMS', nodes, edges }),
        [],
    );
    const setCurrentWorkspace = useCallback((index) => dispatch({ type: 'SET_CURRENT_INDEX', index }), []);

    return {
        workspaces: state.workspaces,
        currentWorkspace: state.currentIndex,
        setCurrentWorkspace,
        addNewWorkspace,
        addNewWorkspaceWithData,
        clearCurrentWorkspace,
        updateCurrentWorkspaceItems,
        removeCurrentWorkspace,
        removeWorkspace,
        renameWorkspace,
        updateWorkspaceName,
        updateWorkflowName,
        updateSavedWorkflowId,
        removeWorkflowNodesFromAll,
        revertCurrentWorkspaceItems,
        saveViewportForWorkspace,
    };
}
