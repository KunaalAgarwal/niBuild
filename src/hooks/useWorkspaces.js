import { useReducer, useCallback } from 'react';
import { useDebouncedStorage } from './useDebouncedStorage.js';

// Each workspace tracks one binding *per save kind*. This lets a single
// workspace be the "live" editor for both a workflow entry and a custom-node
// entry at the same time (a common pattern when extracting a reusable
// composite from a fuller pipeline). Each binding is independent: saving as
// a workflow updates only `boundWorkflowId`; saving as a custom node updates
// only `boundCustomNodeId`. The legacy `savedWorkflowId` field — which used
// to hold whichever kind the workspace happened to be bound to — is migrated
// on first load and no longer written by the reducer.
const DEFAULT_WORKSPACE = {
    id: crypto.randomUUID(),
    nodes: [],
    edges: [],
    name: '',
    boundWorkflowId: null,
    boundCustomNodeId: null,
    viewport: null,
    syncVersion: 0,
};

// Lazy load of the saved-entry kind map at init time. We read customWorkflows
// straight from localStorage here (rather than threading the
// `useCustomWorkflows` hook in) so that migrateWorkspace can resolve the kind
// of a legacy `savedWorkflowId` without a circular hook dependency.
function readCustomWorkflowKindMap() {
    try {
        const arr = JSON.parse(localStorage.getItem('customWorkflows'));
        if (!Array.isArray(arr)) return new Map();
        // useCustomWorkflows backfills kind to 'custom-node' for pre-kind
        // entries on first read; replicate that here so unknown-kind legacy
        // entries get treated the same way (matches how the rest of the app
        // sees them once useCustomWorkflows initializes).
        return new Map(arr.filter((w) => w && w.id).map((w) => [w.id, w.kind || 'custom-node']));
    } catch {
        return new Map();
    }
}

function migrateWorkspace(ws, kindById) {
    let boundWorkflowId = ws.boundWorkflowId || null;
    let boundCustomNodeId = ws.boundCustomNodeId || null;

    // Legacy migration: pre-split workspaces only had `savedWorkflowId`,
    // which could point at either kind of entry. Look the id up in the kind
    // map and assign to whichever new field matches. If the id doesn't
    // resolve (orphan binding), drop it silently.
    if (!boundWorkflowId && !boundCustomNodeId && ws.savedWorkflowId) {
        const kind = kindById.get(ws.savedWorkflowId);
        if (kind === 'workflow') boundWorkflowId = ws.savedWorkflowId;
        else if (kind === 'custom-node') boundCustomNodeId = ws.savedWorkflowId;
    }

    return {
        id: ws.id || crypto.randomUUID(),
        nodes: ws.nodes || [],
        edges: ws.edges || [],
        // Legacy: pre-unification workspaces had a separate `workflowName` that
        // was the tab-displayed name and a `name` that drove export filenames.
        // The displayed name wins so users keep their tab labels on first load.
        name: ws.workflowName || ws.name || '',
        boundWorkflowId,
        boundCustomNodeId,
        viewport: ws.viewport || null,
        syncVersion: ws.syncVersion || 0,
    };
}

// Returns `desiredName` if no other workspace shares the same name, otherwise
// appends " (2)", " (3)", … until unique. Empty stays empty (unnamed tabs show
// the index-based fallback "Workspace N" and are exempt from uniqueness).
// `excludeIndex` skips the workspace being renamed so a no-op rename doesn't
// collide with itself; pass -1 when adding a new workspace.
function disambiguateName(workspaces, desiredName, excludeIndex = -1) {
    if (!desiredName) return desiredName;
    const isTaken = (candidate) => workspaces.some((ws, i) => i !== excludeIndex && ws.name === candidate);
    if (!isTaken(desiredName)) return desiredName;
    let n = 2;
    while (isTaken(`${desiredName} (${n})`)) n++;
    return `${desiredName} (${n})`;
}

// Walks workspaces in order and disambiguates any duplicates against earlier
// entries. Called once at init to repair sessions persisted before uniqueness
// enforcement existed.
function dedupeWorkspaceNames(workspaces) {
    const result = [];
    for (const ws of workspaces) {
        if (!ws.name) {
            result.push(ws);
            continue;
        }
        const unique = disambiguateName(result, ws.name, -1);
        result.push(unique === ws.name ? ws : { ...ws, name: unique });
    }
    return result;
}

function initState() {
    let workspaces = [DEFAULT_WORKSPACE];
    let currentIndex = 0;
    const kindById = readCustomWorkflowKindMap();
    try {
        const saved = JSON.parse(localStorage.getItem('workspaces'));
        if (Array.isArray(saved) && saved.length > 0) {
            workspaces = dedupeWorkspaceNames(saved.map((ws) => migrateWorkspace(ws, kindById)));
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

// Per-kind binding field name. Kept as a small helper so action handlers and
// callers reading the binding stay symmetric.
function bindingFieldForKind(kind) {
    return kind === 'workflow' ? 'boundWorkflowId' : 'boundCustomNodeId';
}

function workspaceReducer(state, action) {
    switch (action.type) {
        case 'ADD_WORKSPACE': {
            const newWs = {
                id: action.id || crypto.randomUUID(),
                nodes: [],
                edges: [],
                name: '',
                boundWorkflowId: null,
                boundCustomNodeId: null,
                viewport: null,
                syncVersion: 0,
            };
            const updated = [...state.workspaces, newWs];
            return { workspaces: updated, currentIndex: updated.length - 1 };
        }
        case 'ADD_WORKSPACE_WITH_DATA': {
            const { data, id } = action;
            const requested = data.name || '';
            const name = requested ? disambiguateName(state.workspaces, requested, -1) : '';
            // The id is generated in the dispatcher (so the caller can return it
            // synchronously) and threaded through the action.
            const newWs = {
                id: id || crypto.randomUUID(),
                nodes: data.nodes || [],
                edges: data.edges || [],
                name,
                boundWorkflowId: data.boundWorkflowId || null,
                boundCustomNodeId: data.boundCustomNodeId || null,
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
                boundWorkflowId: ws?.boundWorkflowId || null,
                boundCustomNodeId: ws?.boundCustomNodeId || null,
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
                boundWorkflowId: ws?.boundWorkflowId || null,
                boundCustomNodeId: ws?.boundCustomNodeId || null,
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
            const uniqueName = disambiguateName(state.workspaces, action.name, action.index);
            const updated = [...state.workspaces];
            updated[action.index] = {
                ...updated[action.index],
                name: uniqueName,
            };
            return { ...state, workspaces: updated };
        }
        case 'UPDATE_BINDING': {
            // Set or clear (id === null) the per-kind binding on the current
            // workspace. The two kinds are independent — saving as a workflow
            // does not touch boundCustomNodeId, and vice versa.
            const { kind, id } = action;
            const field = bindingFieldForKind(kind);
            const updated = [...state.workspaces];
            updated[state.currentIndex] = { ...updated[state.currentIndex], [field]: id };
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
                // Also drop the binding if the workspace pointed at the deleted entry.
                let nextBoundWorkflowId = ws.boundWorkflowId;
                let nextBoundCustomNodeId = ws.boundCustomNodeId;
                if (nextBoundWorkflowId === workflowId) nextBoundWorkflowId = null;
                if (nextBoundCustomNodeId === workflowId) nextBoundCustomNodeId = null;
                const bindingsChanged =
                    nextBoundWorkflowId !== ws.boundWorkflowId || nextBoundCustomNodeId !== ws.boundCustomNodeId;
                if (removedIds.size === 0 && !bindingsChanged) return ws;
                anyChanged = true;
                const filteredEdges = ws.edges.filter((e) => !removedIds.has(e.source) && !removedIds.has(e.target));
                return {
                    ...ws,
                    nodes: filteredNodes,
                    edges: filteredEdges,
                    boundWorkflowId: nextBoundWorkflowId,
                    boundCustomNodeId: nextBoundCustomNodeId,
                };
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

    const addNewWorkspace = useCallback(() => {
        // Generate the id here so the caller can chain follow-up actions
        // (e.g. switching the active tab to the new workspace) synchronously.
        const newId = crypto.randomUUID();
        dispatch({ type: 'ADD_WORKSPACE', id: newId });
        return newId;
    }, []);
    const addNewWorkspaceWithData = useCallback((data) => {
        // Same pattern: id generated outside the reducer so the caller can
        // open the right aux tab / activate the right key immediately.
        const newId = crypto.randomUUID();
        dispatch({ type: 'ADD_WORKSPACE_WITH_DATA', data, id: newId });
        return newId;
    }, []);
    const clearCurrentWorkspace = useCallback(() => dispatch({ type: 'CLEAR_CURRENT' }), []);
    const updateCurrentWorkspaceItems = useCallback(
        (newItems) => dispatch({ type: 'UPDATE_CURRENT_ITEMS', newItems }),
        [],
    );
    const removeCurrentWorkspace = useCallback(() => dispatch({ type: 'REMOVE_CURRENT' }), []);
    const removeWorkspace = useCallback((index) => dispatch({ type: 'REMOVE_AT', index }), []);
    const renameWorkspace = useCallback((index, name) => dispatch({ type: 'RENAME_AT', index, name }), []);
    // Per-kind binding setter. `kind` is 'workflow' | 'custom-node'; `id` is
    // the saved-entry id to bind to, or null to clear the binding for that kind.
    const updateBinding = useCallback((kind, id) => dispatch({ type: 'UPDATE_BINDING', kind, id }), []);
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
        updateBinding,
        removeWorkflowNodesFromAll,
        revertCurrentWorkspaceItems,
        saveViewportForWorkspace,
    };
}
