import { useReducer, useCallback, useRef } from 'react';
import { useDebouncedStorage } from './useDebouncedStorage.js';

const VALID_TYPES = new Set(['cwl', 'yml', 'bids-modal', 'param-modal', 'tool-param-modal']);

// True if a value looks like a tab key we recognize. Used for sanitizing
// persisted tab order and the last-opened key on load.
function isPlausibleKey(k) {
    return typeof k === 'string' && (k === 'manager' || k.startsWith('ws-') || k.startsWith('aux-'));
}

function migrateAuxTab(t) {
    if (!t || typeof t !== 'object') return null;
    if (!VALID_TYPES.has(t.type)) return null;
    if (typeof t.id !== 'string' || !t.id) return null;
    if (typeof t.workspaceId !== 'string' || !t.workspaceId) return null;
    return {
        id: t.id,
        type: t.type,
        workspaceId: t.workspaceId,
        nodeId: typeof t.nodeId === 'string' ? t.nodeId : null,
        // initialState is intentionally not persisted — session-only
        initialState: null,
        // isDirty is intentionally not persisted — the panel re-establishes it
        // from its own state on mount, so a reload always starts clean.
        isDirty: false,
    };
}

function initState() {
    let auxTabs = [];
    let activeTabKey = 'manager';
    let lastOpenedTabKey = '';
    let tabOrder = [];
    // Drop the pre-refactor MRU-history key for users carrying it forward from
    // before lastOpenedTabKey replaced it. Best-effort — failures are silent.
    try {
        localStorage.removeItem('tabHistory');
    } catch {
        /* localStorage unavailable — nothing to clean */
    }
    try {
        const saved = JSON.parse(localStorage.getItem('auxTabs'));
        if (Array.isArray(saved)) {
            auxTabs = saved.map(migrateAuxTab).filter(Boolean);
        }
    } catch {
        /* corrupted localStorage — use default */
    }
    try {
        const raw = localStorage.getItem('activeTabKey');
        if (typeof raw === 'string' && raw) {
            try {
                const parsed = JSON.parse(raw);
                if (typeof parsed === 'string' && parsed) activeTabKey = parsed;
            } catch {
                activeTabKey = raw;
            }
        }
    } catch {
        /* fall through */
    }
    try {
        const raw = localStorage.getItem('lastOpenedTabKey');
        if (typeof raw === 'string' && raw) {
            try {
                const parsed = JSON.parse(raw);
                if (isPlausibleKey(parsed)) lastOpenedTabKey = parsed;
            } catch {
                if (isPlausibleKey(raw)) lastOpenedTabKey = raw;
            }
        }
    } catch {
        /* fall through */
    }
    try {
        const saved = JSON.parse(localStorage.getItem('tabOrder'));
        if (Array.isArray(saved)) {
            // tabOrder excludes 'manager' by invariant — Manager is always pinned leftmost
            // and rendered outside the ordered list. Filter to plausible keys, dedupe.
            tabOrder = Array.from(new Set(saved.filter((k) => isPlausibleKey(k) && k !== 'manager')));
        }
    } catch {
        /* corrupted localStorage — use default */
    }
    return { auxTabs, activeTabKey, lastOpenedTabKey, tabOrder };
}

function findExisting(auxTabs, spec) {
    const targetNodeId = spec.nodeId || null;
    return auxTabs.find(
        (t) => t.workspaceId === spec.workspaceId && t.type === spec.type && (t.nodeId || null) === targetNodeId,
    );
}

function auxTabsReducer(state, action) {
    switch (action.type) {
        case 'OPEN_AUX_TAB': {
            const { spec, id } = action;
            const existing = findExisting(state.auxTabs, spec);
            if (existing) {
                // Refresh initialState if a new draft was provided.
                if (spec.initialState !== undefined && spec.initialState !== null) {
                    const updated = state.auxTabs.map((t) =>
                        t.id === existing.id ? { ...t, initialState: spec.initialState } : t,
                    );
                    return { ...state, auxTabs: updated };
                }
                return state;
            }
            const newTab = {
                id,
                type: spec.type,
                workspaceId: spec.workspaceId,
                nodeId: spec.nodeId || null,
                initialState: spec.initialState || null,
                // A tab opens clean. Dirty flips to true once the panel inside
                // emits an onDirtyChange(true) — typically after the first user
                // edit. If `initialState` is provided (expand-to-tab carried a
                // draft over), the panel will emit dirty=true on mount.
                isDirty: false,
            };
            return { ...state, auxTabs: [...state.auxTabs, newTab] };
        }
        case 'CLOSE_AUX_TAB': {
            const { id } = action;
            const filtered = state.auxTabs.filter((t) => t.id !== id);
            if (filtered.length === state.auxTabs.length) return state;
            const closedKey = `aux-${id}`;
            // Strip closed key from tabOrder and from lastOpenedTabKey if it
            // pointed there. activeTabKey is intentionally left alone — AuxTabContext's
            // wrapped closeAuxTab switches focus to the parent workspace before this
            // action fires; handleRemoveWorkspaceAt does the same for workspace
            // removal; the stale-key validator catches stragglers.
            return {
                ...state,
                auxTabs: filtered,
                tabOrder: state.tabOrder.filter((k) => k !== closedKey),
                lastOpenedTabKey: state.lastOpenedTabKey === closedKey ? '' : state.lastOpenedTabKey,
            };
        }
        case 'CLOSE_FOR_WORKSPACE': {
            const { workspaceId } = action;
            const removedIds = new Set();
            const filtered = state.auxTabs.filter((t) => {
                if (t.workspaceId === workspaceId) {
                    removedIds.add(t.id);
                    return false;
                }
                return true;
            });
            if (removedIds.size === 0) return state;
            const removedKeys = new Set([`ws-${workspaceId}`, ...[...removedIds].map((id) => `aux-${id}`)]);
            return {
                ...state,
                auxTabs: filtered,
                tabOrder: state.tabOrder.filter((k) => !removedKeys.has(k)),
                lastOpenedTabKey: removedKeys.has(state.lastOpenedTabKey) ? '' : state.lastOpenedTabKey,
            };
        }
        case 'SET_ACTIVE_TAB_KEY': {
            const { key } = action;
            if (state.activeTabKey === key) return state;
            // Remember the previously-active tab so the close fallback can
            // return to it. Single slot — no MRU stack. The fallback validates
            // before using, so a stale value (pointing at a closed tab) is
            // tolerated and falls through to 'manager'.
            return { ...state, activeTabKey: key, lastOpenedTabKey: state.activeTabKey };
        }
        case 'CLEAR_INITIAL_STATE': {
            const { id } = action;
            const idx = state.auxTabs.findIndex((t) => t.id === id);
            if (idx < 0) return state;
            if (state.auxTabs[idx].initialState === null) return state;
            const updated = [...state.auxTabs];
            updated[idx] = { ...updated[idx], initialState: null };
            return { ...state, auxTabs: updated };
        }
        case 'SET_TAB_DIRTY': {
            const { id, isDirty } = action;
            const idx = state.auxTabs.findIndex((t) => t.id === id);
            if (idx < 0) return state;
            const cur = !!state.auxTabs[idx].isDirty;
            const next = !!isDirty;
            if (cur === next) return state; // no-op when unchanged — avoids extra renders
            const updated = [...state.auxTabs];
            updated[idx] = { ...updated[idx], isDirty: next };
            return { ...state, auxTabs: updated };
        }
        case 'REORDER_TAB': {
            // Move `key` to `targetIndex` within tabOrder. Manager is never in
            // tabOrder by invariant; defensive guard rejects any attempt.
            const { key, targetIndex } = action;
            if (key === 'manager') return state;
            const fromIndex = state.tabOrder.indexOf(key);
            if (fromIndex < 0) return state;
            const next = state.tabOrder.slice();
            next.splice(fromIndex, 1);
            const clamped = Math.max(0, Math.min(targetIndex, next.length));
            if (clamped === fromIndex) return state;
            next.splice(clamped, 0, key);
            return { ...state, tabOrder: next };
        }
        case 'SYNC_TAB_ORDER': {
            // Reconcile tabOrder against the set of currently-live tab keys.
            // - Existing keys keep their user-set order
            // - Closed keys are dropped
            // - New keys are appended at the end (rightmost)
            const { liveKeys } = action;
            const liveSet = new Set(liveKeys);
            const kept = state.tabOrder.filter((k) => liveSet.has(k));
            const keptSet = new Set(kept);
            const appended = liveKeys.filter((k) => !keptSet.has(k));
            const nextOrder = appended.length === 0 ? kept : [...kept, ...appended];
            // Short-circuit if identical to avoid render loops from the sync effect.
            if (nextOrder.length === state.tabOrder.length && nextOrder.every((k, i) => k === state.tabOrder[i])) {
                return state;
            }
            return { ...state, tabOrder: nextOrder };
        }
        default:
            return state;
    }
}

export function useAuxTabs() {
    const [state, dispatch] = useReducer(auxTabsReducer, undefined, initState);

    // Persist auxTabs (initialState is dropped on load via migrateAuxTab).
    useDebouncedStorage('auxTabs', state.auxTabs, 300);
    useDebouncedStorage('activeTabKey', state.activeTabKey, 300);
    useDebouncedStorage('lastOpenedTabKey', state.lastOpenedTabKey, 300);
    useDebouncedStorage('tabOrder', state.tabOrder, 300);

    // Ref mirror of latest auxTabs so openAuxTab can do dedup synchronously and return the id.
    const auxTabsRef = useRef(state.auxTabs);
    auxTabsRef.current = state.auxTabs;

    // Opens (or refocuses) an aux tab, and activates it. Returns the id
    // (existing or freshly created). The id is decided here, then passed into
    // the reducer for consistency. Activation is part of the contract — "open"
    // means switch to it, matching VS Code's tab behavior. Callers that need to
    // open without focus can still dispatch SET_ACTIVE_TAB_KEY to override.
    const openAuxTab = useCallback((spec) => {
        const existing = findExisting(auxTabsRef.current, spec);
        if (existing) {
            if (spec.initialState !== undefined && spec.initialState !== null) {
                dispatch({ type: 'OPEN_AUX_TAB', spec, id: existing.id });
            }
            dispatch({ type: 'SET_ACTIVE_TAB_KEY', key: `aux-${existing.id}` });
            return existing.id;
        }
        const id = `aux-${crypto.randomUUID()}`;
        dispatch({ type: 'OPEN_AUX_TAB', spec, id });
        dispatch({ type: 'SET_ACTIVE_TAB_KEY', key: `aux-${id}` });
        return id;
    }, []);

    const closeAuxTab = useCallback((id) => dispatch({ type: 'CLOSE_AUX_TAB', id }), []);
    const closeAuxTabsForWorkspace = useCallback(
        (workspaceId) => dispatch({ type: 'CLOSE_FOR_WORKSPACE', workspaceId }),
        [],
    );
    const setActiveTabKey = useCallback((key) => dispatch({ type: 'SET_ACTIVE_TAB_KEY', key }), []);
    const clearInitialState = useCallback((id) => dispatch({ type: 'CLEAR_INITIAL_STATE', id }), []);
    const setTabDirty = useCallback((id, isDirty) => dispatch({ type: 'SET_TAB_DIRTY', id, isDirty }), []);
    const reorderTab = useCallback((key, targetIndex) => dispatch({ type: 'REORDER_TAB', key, targetIndex }), []);
    const syncTabOrder = useCallback((liveKeys) => dispatch({ type: 'SYNC_TAB_ORDER', liveKeys }), []);

    return {
        auxTabs: state.auxTabs,
        activeTabKey: state.activeTabKey,
        lastOpenedTabKey: state.lastOpenedTabKey,
        tabOrder: state.tabOrder,
        openAuxTab,
        closeAuxTab,
        closeAuxTabsForWorkspace,
        setActiveTabKey,
        clearInitialState,
        setTabDirty,
        reorderTab,
        syncTabOrder,
    };
}
