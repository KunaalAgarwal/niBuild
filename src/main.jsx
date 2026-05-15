import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import IDELayout from './components/IDELayout';
import WorkflowMenu from './components/workflowMenu';
import WorkflowManagerPage from './components/WorkflowManagerPage';
import WorkflowCanvas from './components/workflowCanvas';
import CWLPreviewPanel from './components/CWLPreviewPanel';
import AuxTabRenderer from './components/AuxTabRenderer.jsx';
import CommandPalette from './components/CommandPalette';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGenerateWorkflow } from './hooks/generateWorkflow';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { AuxTabProvider, useAuxTabsContext } from './context/AuxTabContext.jsx';
import { CustomWorkflowsProvider, useCustomWorkflowsContext } from './context/CustomWorkflowsContext.jsx';
import { SidebarProvider, useSidebar } from './context/SidebarContext.jsx';
import { TemplateAssetProvider } from './context/TemplateAssetContext.jsx';
import { TOOL_ANNOTATIONS } from './utils/toolAnnotations.js';
import { preloadAllCWL } from './utils/cwlParser.js';
import { invalidateMergeCache } from './utils/toolRegistry.js';
import {
    serializeNodes,
    serializeEdges,
    deserializeNode,
    hasUnsavedChanges,
    computeBoundaryNodes,
} from './utils/workflowDiff.js';
import { computeProblems, computeWorkflowIO } from './utils/workflowValidation.js';

import './styles/tokens.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/background.css';

/**
 * Pick the next active tab when one (or several) are being invalidated.
 *
 * Order:
 *   1. The parent of the *primary* closing key — for aux tabs, that's the
 *      workspace they belong to. Workspaces have no parent today (the
 *      `parentId` scaffold was removed), so closing a workspace falls
 *      through to step 2.
 *   2. `lastOpenedTabKey` — the tab the user was on immediately before the
 *      current one. Skipped if invalid or being closed.
 *   3. Manager.
 *
 * @param closingKeys Set of tab keys being invalidated (the primary first).
 *                    Pass live workspaces/auxTabs (filtered to *after* the
 *                    removal) so validation reflects the post-close state.
 */
function pickNextActiveTab({ closingKeys, workspaces, auxTabs, lastOpenedTabKey }) {
    const isValid = (key) => {
        if (!key || closingKeys.has(key)) return false;
        if (key === 'manager') return true;
        if (key.startsWith('ws-')) return workspaces.some((w) => w.id === key.slice('ws-'.length));
        if (key.startsWith('aux-')) return auxTabs.some((t) => t.id === key.slice('aux-'.length));
        return false;
    };
    const parentOf = (key) => {
        if (key?.startsWith('aux-')) {
            const aux = auxTabs.find((t) => t.id === key.slice('aux-'.length));
            return aux ? `ws-${aux.workspaceId}` : null;
        }
        // Workspaces are flat — no workspace-level parent relationship today.
        return null;
    };
    const primary = [...closingKeys][0];
    const parent = parentOf(primary);
    if (isValid(parent)) return parent;
    if (isValid(lastOpenedTabKey)) return lastOpenedTabKey;
    return 'manager';
}

function App() {
    const {
        workspaces,
        currentWorkspace,
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
        clearStaleBindings,
        revertCurrentWorkspaceItems,
        saveViewportForWorkspace,
    } = useWorkspaces();

    const currentName = workspaces[currentWorkspace]?.name || '';
    // Per-kind bindings: a workspace can be bound to a workflow entry, a
    // custom-node entry, or both at once. The two are independent — saving as
    // workflow only touches the workflow binding, and vice versa. (Pre-split
    // workspaces with a single `savedWorkflowId` are migrated on load by
    // useWorkspaces; both fields below are always present on the modern shape.)
    const boundWorkflowId = workspaces[currentWorkspace]?.boundWorkflowId || null;
    const boundCustomNodeId = workspaces[currentWorkspace]?.boundCustomNodeId || null;

    const sidebarRef = useRef(null);
    const cwlRef = useRef(null);
    const utilityRef = useRef(null);

    // This state will eventually hold a function returned by WorkflowCanvas
    const [getWorkflowData, setGetWorkflowData] = useState(null);
    const [addNode, setAddNode] = useState(null);
    const [cwlReady, setCwlReady] = useState(false);
    const [showCommandPalette, setShowCommandPalette] = useState(false);
    const [searchAnchorEl, setSearchAnchorEl] = useState(null);
    // Query is held here so the TopBar search input (now the visible textbox
    // when the palette is open) and the palette's filter share the same value.
    // Reset on every open via an effect on showCommandPalette below.
    const [paletteQuery, setPaletteQuery] = useState('');

    // Sidebar tab state — App needs to be able to flip the sidebar to the
    // 'staged' tab when the TopBar Staged Changes button is clicked.
    const { setActiveTab: setSidebarTab } = useSidebar();

    const { generateWorkflow } = useGenerateWorkflow();
    const { showError, showSuccess, showWarning, showInfo } = useToast();
    const {
        saveWorkflow,
        updateWorkflow,
        deleteWorkflow,
        duplicateWorkflow,
        updateWorkflowNotes,
        markWorkflowOpened,
        getNextDefaultName,
        customWorkflows,
    } = useCustomWorkflowsContext();
    const {
        auxTabs,
        activeTabKey,
        lastOpenedTabKey,
        tabOrder,
        setActiveTabKey,
        openAuxTab,
        closeAuxTab,
        closeAuxTabsForWorkspace,
        reorderTab,
        syncTabOrder,
    } = useAuxTabsContext();

    // Preload all CWL files on mount so getToolConfigSync() works synchronously
    useEffect(() => {
        const cwlPaths = Object.values(TOOL_ANNOTATIONS)
            .map((ann) => ann.cwlPath)
            .filter(Boolean);
        preloadAllCWL(cwlPaths)
            .then(() => {
                invalidateMergeCache();
                setCwlReady(true);
            })
            .catch((err) => {
                console.error('[App] CWL preload failed:', err);
                showError('Failed to load tool definitions. Some tools may not work correctly.');
                setCwlReady(true); // still allow rendering so the app isn't stuck
            });
    }, [showError]);

    const handleDeleteWorkflow = useCallback(
        (wfId) => {
            deleteWorkflow(wfId);
            removeWorkflowNodesFromAll(wfId);
        },
        [deleteWorkflow, removeWorkflowNodesFromAll],
    );

    // Shared by both Save-as-Workflow and Save-as-Custom-Node: validate the
    // workspace, serialize, compute boundary nodes, and return the payload (or
    // null on validation failure — errors are toasted from inside).
    const buildSavePayload = useCallback(
        (kind) => {
            const kindLabel = kind === 'workflow' ? 'workflow' : 'custom node';

            if (!getWorkflowData) {
                showError('No workflow data available to save.');
                return null;
            }

            const data = getWorkflowData();
            if (!data || !data.nodes || data.nodes.length === 0) {
                showError(`Cannot save an empty workspace as a ${kindLabel}.`);
                return null;
            }

            // Need at least 1 non-dummy node
            const nonDummyNodes = data.nodes.filter((n) => !n.data?.isDummy);
            if (nonDummyNodes.length === 0) {
                showError(`Cannot save a workspace with only I/O nodes as a ${kindLabel}.`);
                return null;
            }

            // Use the workspace (tab) name, or auto-generate one (per-kind counter)
            const name = currentName.trim() || getNextDefaultName(kind);

            // Serialize nodes and edges (strip callbacks)
            const serializedNodes = serializeNodes(data.nodes);
            const serializedEdges = serializeEdges(data.edges);

            // Compute boundary nodes
            const boundaryNodes = computeBoundaryNodes(serializedNodes, serializedEdges);

            return {
                workflowData: {
                    name,
                    kind,
                    nodes: serializedNodes,
                    edges: serializedEdges,
                    hasValidationWarnings: false,
                    boundaryNodes,
                },
                name,
            };
        },
        [getWorkflowData, currentName, getNextDefaultName, showError],
    );

    // Each save kind reads its own binding directly — no more cross-kind
    // logic. If the matching binding exists we update that entry in place;
    // otherwise we create a new entry and rebind the workspace to it. This
    // makes the two save kinds fully independent: clicking "Save as Custom
    // Node" on a workflow-bound workspace adds a custom-node binding without
    // touching the workflow binding.
    const handleSaveAsWorkflow = useCallback(() => {
        const payload = buildSavePayload('workflow');
        if (!payload) return;
        const { workflowData, name } = payload;

        if (boundWorkflowId) {
            updateWorkflow(boundWorkflowId, workflowData);
            showSuccess(`Updated workflow "${name}"`);
        } else {
            const { result, id } = saveWorkflow(workflowData);
            // Always bind on save — the binding lives per-kind, so this never
            // clobbers a sibling custom-node binding the workspace might
            // already carry.
            updateBinding('workflow', id);
            showSuccess(result === 'updated' ? `Updated workflow "${name}"` : `Saved workflow "${name}"`);
        }

        // If the tab was unnamed, adopt the auto-generated name. Disambiguation
        // may append " (n)" against other tabs; the next save reconciles.
        if (!currentName.trim()) renameWorkspace(currentWorkspace, name);
    }, [
        buildSavePayload,
        boundWorkflowId,
        saveWorkflow,
        updateWorkflow,
        updateBinding,
        currentName,
        currentWorkspace,
        renameWorkspace,
        showSuccess,
    ]);

    const handleSaveAsCustomNode = useCallback(() => {
        const payload = buildSavePayload('custom-node');
        if (!payload) return;
        const { workflowData, name } = payload;

        if (boundCustomNodeId) {
            updateWorkflow(boundCustomNodeId, workflowData);
            showSuccess(`Updated custom node "${name}"`);
        } else {
            const { result, id } = saveWorkflow(workflowData);
            updateBinding('custom-node', id);
            showSuccess(result === 'updated' ? `Updated custom node "${name}"` : `Saved as custom node "${name}"`);
        }

        if (!currentName.trim()) renameWorkspace(currentWorkspace, name);
    }, [
        buildSavePayload,
        boundCustomNodeId,
        saveWorkflow,
        updateWorkflow,
        updateBinding,
        currentName,
        currentWorkspace,
        renameWorkspace,
        showSuccess,
    ]);

    // Creating a workspace also activates its tab. The reducer marks the new
    // workspace as `current`, but `activeTabKey` is independent — without this
    // wrapper the tab strip would stay on whatever was active before.
    const handleNewWorkspace = useCallback(() => {
        const newId = addNewWorkspace();
        setActiveTabKey(`ws-${newId}`);
    }, [addNewWorkspace, setActiveTabKey]);

    // Switch to a workspace: update both the workspace index and the active
    // tab key together so the canvas and tab strip stay in sync. Also surfaces
    // unsaved-change warnings on the way out and a "now editing" hint on the
    // way in for workspaces bound to a saved custom workflow.
    const handleWorkspaceSwitch = useCallback(
        (newIndex) => {
            // Warn if leaving a workspace with unsaved custom workflow changes
            const currentWs = workspaces[currentWorkspace];
            const currentWsName = currentWs?.name?.trim();
            if (currentWsName) {
                const savedWf = customWorkflows.find((w) => w.name === currentWsName);
                if (savedWf && hasUnsavedChanges(currentWs, savedWf)) {
                    showWarning(`Workflow "${currentWsName}" has unsaved changes`);
                }
            }

            // Notify if arriving at a workspace editing a custom workflow
            const targetWs = workspaces[newIndex];
            const targetWsName = targetWs?.name?.trim();
            if (targetWsName) {
                const targetSaved = customWorkflows.find((w) => w.name === targetWsName);
                if (targetSaved) {
                    showInfo(`Editing custom workflow "${targetWsName}"`);
                }
            }

            setCurrentWorkspace(newIndex);
            if (targetWs) setActiveTabKey(`ws-${targetWs.id}`);
        },
        [workspaces, currentWorkspace, customWorkflows, setCurrentWorkspace, setActiveTabKey, showWarning, showInfo],
    );

    // Unified tab-activation handler: dispatches on key prefix.
    const handleActivateTab = useCallback(
        (key) => {
            if (key === 'manager') {
                setActiveTabKey('manager');
                return;
            }
            if (typeof key === 'string' && key.startsWith('ws-')) {
                const wsId = key.slice('ws-'.length);
                const idx = workspaces.findIndex((w) => w.id === wsId);
                if (idx < 0) return;
                handleWorkspaceSwitch(idx); // sets currentWorkspace + activeTabKey + warnings
                return;
            }
            if (typeof key === 'string' && key.startsWith('aux-')) {
                // currentWorkspace is updated via the sync effect below.
                setActiveTabKey(key);
            }
        },
        [workspaces, handleWorkspaceSwitch, setActiveTabKey],
    );

    // Sync `currentWorkspace` (workspace index) to whatever the activeTabKey points at.
    // `handleActivateTab` already calls handleWorkspaceSwitch for direct ws-* clicks, but
    // the fallback paths (pickNextActiveTab in the stale-key validator and
    // handleRemoveWorkspaceAt; AuxTabContext's wrapped closeAuxTab) set activeTabKey
    // directly — this effect catches those so currentWorkspace stays consistent.
    useEffect(() => {
        if (typeof activeTabKey !== 'string') return;
        let targetWsId = null;
        if (activeTabKey.startsWith('aux-')) {
            const auxId = activeTabKey.slice('aux-'.length);
            const aux = auxTabs.find((t) => t.id === auxId);
            if (aux) targetWsId = aux.workspaceId;
        } else if (activeTabKey.startsWith('ws-')) {
            targetWsId = activeTabKey.slice('ws-'.length);
        }
        if (!targetWsId) return;
        const idx = workspaces.findIndex((w) => w.id === targetWsId);
        if (idx >= 0 && idx !== currentWorkspace) {
            setCurrentWorkspace(idx);
        }
    }, [activeTabKey, auxTabs, workspaces, currentWorkspace, setCurrentWorkspace]);

    // Validate activeTabKey against current workspaces/auxTabs (drops stale keys
    // on load, or when the active tab is closed by something that didn't pick a
    // fallback itself). Routes through pickNextActiveTab so the choice matches
    // the rest of the system: parent → lastOpened → manager.
    useEffect(() => {
        if (activeTabKey === 'manager') return;
        let valid = false;
        if (activeTabKey.startsWith('ws-')) {
            const wsId = activeTabKey.slice('ws-'.length);
            valid = workspaces.some((w) => w.id === wsId);
        } else if (activeTabKey.startsWith('aux-')) {
            const auxId = activeTabKey.slice('aux-'.length);
            const aux = auxTabs.find((t) => t.id === auxId);
            valid = !!aux && workspaces.some((w) => w.id === aux.workspaceId);
        }
        if (!valid) {
            const fallback = pickNextActiveTab({
                closingKeys: new Set([activeTabKey]),
                workspaces,
                auxTabs,
                lastOpenedTabKey,
            });
            setActiveTabKey(fallback);
        }
    }, [activeTabKey, workspaces, auxTabs, lastOpenedTabKey, setActiveTabKey]);

    // Keep tabOrder reconciled against the live set of workspace and aux-tab keys.
    // New tabs land at the right end (via SYNC_TAB_ORDER's append behavior); closed
    // tabs are dropped. The reducer no-ops when the result equals the current order,
    // so this effect is safe to run on every workspaces/auxTabs change.
    useEffect(() => {
        const liveKeys = [...workspaces.map((w) => `ws-${w.id}`), ...auxTabs.map((t) => `aux-${t.id}`)];
        syncTabOrder(liveKeys);
    }, [workspaces, auxTabs, syncTabOrder]);

    // Defensive sweep: clear any workspace binding whose target customWorkflow id
    // no longer exists. The in-app deletion path (REMOVE_WORKFLOW_NODES) already
    // clears bindings synchronously, so this is only for cross-tab races
    // (another tab/window deletes a workflow, this tab's customWorkflows array
    // re-syncs from localStorage but no REMOVE_WORKFLOW_NODES action ever fires
    // here) and for any future code path that mutates customWorkflows outside
    // handleDeleteWorkflow. The reducer no-ops when no orphans are present.
    useEffect(() => {
        const liveIds = new Set(customWorkflows.map((w) => w.id));
        clearStaleBindings(liveIds);
    }, [customWorkflows, clearStaleBindings]);

    // Wrap workspace removal: close its aux tabs and, if the workspace (or one
    // of its aux tabs) was active, pick the next active tab before tearing down.
    const handleRemoveWorkspaceAt = useCallback(
        (idx) => {
            const ws = workspaces[idx];
            if (!ws) {
                removeWorkspace(idx);
                return;
            }
            const wsKey = `ws-${ws.id}`;
            const closingAuxKeys = auxTabs.filter((t) => t.workspaceId === ws.id).map((t) => `aux-${t.id}`);
            const removingKeys = new Set([wsKey, ...closingAuxKeys]);
            if (removingKeys.has(activeTabKey)) {
                const remainingWorkspaces = workspaces.filter((w) => w.id !== ws.id);
                const remainingAux = auxTabs.filter((t) => t.workspaceId !== ws.id);
                const fallback = pickNextActiveTab({
                    closingKeys: removingKeys,
                    workspaces: remainingWorkspaces,
                    auxTabs: remainingAux,
                    lastOpenedTabKey,
                });
                setActiveTabKey(fallback);
            }
            closeAuxTabsForWorkspace(ws.id);
            removeWorkspace(idx);
        },
        [
            workspaces,
            auxTabs,
            activeTabKey,
            lastOpenedTabKey,
            setActiveTabKey,
            closeAuxTabsForWorkspace,
            removeWorkspace,
        ],
    );

    const handleEditWorkflow = useCallback(
        (workflow) => {
            // Stamp last-opened time regardless of whether we focus or create.
            markWorkflowOpened(workflow.id);

            // The new workspace binds the opened entry into the *kind-specific*
            // field. A workflow opens into `boundWorkflowId`; a custom node into
            // `boundCustomNodeId`. This matches how saves write the bindings.
            const kind = workflow.kind || 'custom-node';
            const bindField = kind === 'workflow' ? 'boundWorkflowId' : 'boundCustomNodeId';

            // Check if this entry is already open in an existing workspace,
            // checking the kind-matching binding only — a workspace bound to a
            // different kind that happens to share an id is impossible by
            // construction, but checking the right field keeps the lookup
            // narrow and self-documenting.
            const existingIndex = workspaces.findIndex((ws) => ws[bindField] === workflow.id);
            if (existingIndex !== -1) {
                const existingWs = workspaces[existingIndex];
                handleWorkspaceSwitch(existingIndex); // updates currentWorkspace + activeTabKey
                return existingWs.id;
            }

            // Convert serialized nodes back to canvas format
            const nodes = workflow.nodes.map(deserializeNode);
            const edges = workflow.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                data: e.data || { mappings: [] },
            }));

            const newWsId = addNewWorkspaceWithData({
                nodes,
                edges,
                // Legacy `outputName` is the pre-unification export filename;
                // fall through to it only if a current-style `name` is missing.
                name: workflow.name || workflow.outputName || '',
                [bindField]: workflow.id,
            });
            // Same reason — the reducer makes the new workspace `current`, but
            // the active tab key is independent and needs explicit switching.
            setActiveTabKey(`ws-${newWsId}`);
            showInfo(`Editing "${workflow.name}" in new workspace`);
            return newWsId;
        },
        [addNewWorkspaceWithData, showInfo, workspaces, handleWorkspaceSwitch, markWorkflowOpened, setActiveTabKey],
    );

    /**
     * Open a saved workflow and chain a follow-up action in one click.
     *   - 'cwl'   → open the workspace, then surface its CWL aux tab.
     *   - 'yml'   → same, but the job-template YML aux tab.
     *   - 'crate' → generate the .crate.zip directly from the saved workflow's
     *               serialized data (no workspace needed — synthesizes a
     *               getWorkflowData() from deserialized nodes/edges).
     *   - null    → behaves like the bare Open button.
     *
     * Used by the Workflow Manager's per-row "..." menu so users can grab an
     * artifact without first navigating into the editor.
     */
    const handleOpenWorkflowWithAction = useCallback(
        (workflow, action) => {
            if (!workflow) return;

            if (action === 'crate') {
                // Synthesize a getWorkflowData() from the saved workflow itself
                // so generation doesn't depend on the canvas being mounted.
                const nodes = workflow.nodes.map(deserializeNode);
                const edges = workflow.edges.map((e) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    data: e.data || { mappings: [] },
                }));
                const syntheticGetData = () => ({ nodes, edges });
                const exportName = workflow.name || workflow.outputName || '';
                generateWorkflow(syntheticGetData, exportName);
                return;
            }

            // Both 'cwl' and 'yml' need the canvas mounted so CWLPreviewContent
            // can render — open/focus the workspace first, then surface the tab.
            const wsId = handleEditWorkflow(workflow);
            if (!wsId) return;

            if (action === 'cwl' || action === 'yml') {
                const auxId = openAuxTab({ type: action, workspaceId: wsId });
                setActiveTabKey(`aux-${auxId}`);
            }
        },
        [handleEditWorkflow, openAuxTab, setActiveTabKey, generateWorkflow],
    );

    // Resolve the two per-kind bindings to live saved entries (or null). The
    // sidebar Changes tab and the TopBar's update-mode flags both read from
    // these.
    const boundWorkflow = boundWorkflowId ? customWorkflows.find((w) => w.id === boundWorkflowId) : null;
    const boundCustomNode = boundCustomNodeId ? customWorkflows.find((w) => w.id === boundCustomNodeId) : null;

    // Per-kind change detection. Each binding is diffed independently so the
    // two Save/Update buttons can disable based on their own kind's state.
    const hasWorkflowChanges = boundWorkflow ? hasUnsavedChanges(workspaces[currentWorkspace], boundWorkflow) : false;
    const hasCustomNodeChanges = boundCustomNode
        ? hasUnsavedChanges(workspaces[currentWorkspace], boundCustomNode)
        : false;

    // Aggregate flag for "is there anything staged" — used to enable the
    // sidebar tab and the command-palette entry. The TopBar buttons use the
    // per-kind flags above instead so they each disable based on their own
    // binding only.
    const hasStagedChanges = hasWorkflowChanges || hasCustomNodeChanges;
    const isBoundAsWorkflow = !!boundWorkflow;
    const isBoundAsCustomNode = !!boundCustomNode;

    // Surface the staged-changes diff in the left sidebar's `staged` tab.
    // Expand the sidebar first if it's collapsed so the tab is actually
    // visible — otherwise the click feels like a no-op. Only opens when there
    // is something to look at across either binding; the TopBar gates the
    // click on the same condition so this is mostly a defensive check for
    // keyboard/programmatic callers.
    const handleShowStagedChanges = useCallback(() => {
        if (!boundWorkflow && !boundCustomNode) {
            showWarning('Current workspace is not editing a saved workflow or custom node.');
            return;
        }
        if (!hasStagedChanges) {
            const name = boundWorkflow?.name || boundCustomNode?.name || 'this workspace';
            showInfo(`"${name}" has no staged changes.`);
            return;
        }
        // Expand the sidebar if collapsed so the activated tab is visible.
        if (sidebarRef.current?.isCollapsed?.()) {
            sidebarRef.current?.expand?.();
        }
        setSidebarTab('staged');
    }, [boundWorkflow, boundCustomNode, hasStagedChanges, sidebarRef, setSidebarTab, showWarning, showInfo]);

    // Revert is per-kind: the sidebar passes the kind it wants to revert
    // against so the workspace contents snap back to that specific binding's
    // saved state. (The other binding's diff may grow as a result — that's
    // intentional and surfaces in the sidebar as a fresh diff.)
    const handleRevertToBinding = useCallback(
        (kind) => {
            const entry = kind === 'workflow' ? boundWorkflow : boundCustomNode;
            if (!entry) return;

            const nodes = entry.nodes.map(deserializeNode);
            const edges = entry.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                data: e.data || { mappings: [] },
            }));

            revertCurrentWorkspaceItems(nodes, edges);
            renameWorkspace(currentWorkspace, entry.name || entry.outputName || '');
            showSuccess(`Reverted to "${entry.name}" (${kind === 'workflow' ? 'workflow' : 'custom node'}).`);
        },
        [boundWorkflow, boundCustomNode, currentWorkspace, revertCurrentWorkspaceItems, renameWorkspace, showSuccess],
    );

    // Per-workspace status for tab annotations: 'unsaved' | 'modified' | null
    const workspaceStatuses = useMemo(
        () =>
            workspaces.map((ws) => {
                const hasAnyBinding = !!ws.boundWorkflowId || !!ws.boundCustomNodeId;
                if (!hasAnyBinding) {
                    const hasContent = (ws.nodes || []).some((n) => !n.data?.isDummy);
                    return hasContent ? 'unsaved' : null;
                }
                // "Modified" if EITHER binding has diverged from its saved
                // state. Two-kind workspaces only need one binding to show as
                // modified to surface the indicator.
                const wf = ws.boundWorkflowId ? customWorkflows.find((w) => w.id === ws.boundWorkflowId) : null;
                const cn = ws.boundCustomNodeId ? customWorkflows.find((w) => w.id === ws.boundCustomNodeId) : null;
                const modified = (wf && hasUnsavedChanges(ws, wf)) || (cn && hasUnsavedChanges(ws, cn));
                return modified ? 'modified' : null;
            }),
        [workspaces, customWorkflows],
    );

    const currentWs = workspaces[currentWorkspace];
    // `cwlReady` is intentionally in the deps below: computeProblems and
    // computeWorkflowIO read from the tool-registry sync cache (populated by
    // preloadAllCWL), so they need to re-run once the cache is hot. ESLint
    // can't see that data dependency because it's not a syntactic reference.
    const validationProblems = useMemo(
        () => computeProblems(currentWs?.nodes, currentWs?.edges, workspaceStatuses[currentWorkspace]),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentWs?.nodes, currentWs?.edges, workspaceStatuses, currentWorkspace, cwlReady],
    );

    const workflowIO = useMemo(
        () => computeWorkflowIO(currentWs?.nodes, currentWs?.edges),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentWs?.nodes, currentWs?.edges, cwlReady],
    );

    const activeAuxTab = useMemo(() => {
        if (typeof activeTabKey !== 'string' || !activeTabKey.startsWith('aux-')) return null;
        const id = activeTabKey.slice('aux-'.length);
        return auxTabs.find((t) => t.id === id) || null;
    }, [activeTabKey, auxTabs]);

    // Command palette: Ctrl+K global shortcut
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setShowCommandPalette(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Save: Ctrl+S global shortcut. Registered at the top level so it fires
    // from the sidebar, aux tabs, and workflow manager — not only when the
    // canvas pane is mounted.
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handleSaveAsWorkflow();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSaveAsWorkflow]);

    // Clear the palette query whenever the palette opens, so each open starts
    // fresh regardless of where the typing happened (TopBar search input).
    useEffect(() => {
        if (showCommandPalette) setPaletteQuery('');
    }, [showCommandPalette]);

    const handleImportCWL = useCallback(() => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.cwl,.yaml,.yml';
        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            showInfo(`Imported "${file.name}" — CWL import coming soon`);
        };
        input.click();
    }, [showInfo]);

    // Mirrors the TopBar's left-to-right action order: workspace lifecycle,
    // then the two save kinds (Save as Workflow → Save as Custom Node), then
    // Generate, then CWL import. Both save entries are always enabled — the
    // kind-aware binding logic in handleSaveAsWorkflow / handleSaveAsCustomNode
    // (see resolveBinding above) already routes overwrites vs. new saves
    // correctly per kind, so the palette doesn't need its own guard.
    const paletteActions = useMemo(
        () => [
            { id: 'new-workspace', label: 'New Workspace', handler: handleNewWorkspace },
            { id: 'clear-workspace', label: 'Clear Workspace', handler: clearCurrentWorkspace },
            {
                id: 'remove-workspace',
                label: 'Remove Workspace',
                handler: removeCurrentWorkspace,
                disabled: workspaces.length === 0,
            },
            { id: 'save-as-workflow', label: 'Save as Workflow', handler: handleSaveAsWorkflow },
            { id: 'save-as-custom', label: 'Save as Custom Node', handler: handleSaveAsCustomNode },
            {
                id: 'view-staged-changes',
                label: 'View Staged Changes',
                handler: handleShowStagedChanges,
                disabled: !hasStagedChanges,
            },
            {
                id: 'generate-workflow',
                label: 'Generate Workflow',
                handler: () => generateWorkflow(getWorkflowData, currentName),
            },
            { id: 'import-cwl', label: 'Import CWL', handler: handleImportCWL },
        ],
        [
            handleNewWorkspace,
            clearCurrentWorkspace,
            removeCurrentWorkspace,
            workspaces.length,
            handleSaveAsWorkflow,
            handleSaveAsCustomNode,
            handleShowStagedChanges,
            hasStagedChanges,
            generateWorkflow,
            getWorkflowData,
            currentName,
            handleImportCWL,
        ],
    );

    // Workflow-kind entries open in a workspace (mirrors the manager's row-click
    // semantics and updates MRU via markWorkflowOpened inside handleEditWorkflow).
    // Custom-node-kind entries are a reusable building block, so they insert as
    // a composite into the current canvas — mirrors the sidebar's drag behavior.
    const handlePaletteWorkflowSelect = useCallback(
        (workflow) => {
            if ((workflow.kind || 'custom-node') === 'workflow') {
                handleEditWorkflow(workflow);
                return;
            }
            if (!addNode) return;
            addNode(workflow.name, {
                isDummy: false,
                isBIDS: false,
                isOutputNode: false,
                customWorkflowId: workflow.id,
            });
        },
        [handleEditWorkflow, addNode],
    );

    return (
        <>
            <IDELayout
                onNewWorkspace={handleNewWorkspace}
                onGenerateWorkflow={() => generateWorkflow(getWorkflowData, currentName)}
                onSaveAsWorkflow={handleSaveAsWorkflow}
                onSaveAsCustomNode={handleSaveAsCustomNode}
                isBoundAsWorkflow={isBoundAsWorkflow}
                isBoundAsCustomNode={isBoundAsCustomNode}
                hasWorkflowChanges={hasWorkflowChanges}
                hasCustomNodeChanges={hasCustomNodeChanges}
                hasStagedChanges={hasStagedChanges}
                boundWorkflow={boundWorkflow}
                boundCustomNode={boundCustomNode}
                onUpdateWorkflow={handleSaveAsWorkflow}
                onUpdateCustomNode={handleSaveAsCustomNode}
                onRevertToBinding={handleRevertToBinding}
                workflowDisplayName={currentName.trim() || getNextDefaultName()}
                onOpenCommandPalette={() => setShowCommandPalette(true)}
                isCommandPaletteOpen={showCommandPalette}
                onSearchRefReady={setSearchAnchorEl}
                paletteQuery={paletteQuery}
                onPaletteQueryChange={setPaletteQuery}
                currentWorkspace={currentWorkspace}
                totalWorkspaces={workspaces.length}
                workspaces={workspaces}
                onWorkspaceSwitch={handleWorkspaceSwitch}
                onRemoveWorkspaceAt={handleRemoveWorkspaceAt}
                onRenameWorkspace={renameWorkspace}
                workspaceStatuses={workspaceStatuses}
                validationProblems={validationProblems}
                workflowIO={workflowIO}
                sidebarRef={sidebarRef}
                cwlRef={cwlRef}
                utilityRef={utilityRef}
                auxTabs={auxTabs}
                activeTabKey={activeTabKey}
                onActivateTab={handleActivateTab}
                onCloseAuxTab={closeAuxTab}
                tabOrder={tabOrder}
                onReorderTab={reorderTab}
                auxTabContent={
                    activeAuxTab ? (
                        <AuxTabRenderer
                            tab={activeAuxTab}
                            workspace={workspaces.find((w) => w.id === activeAuxTab.workspaceId)}
                            getWorkflowData={getWorkflowData}
                        />
                    ) : null
                }
                sidebarContent={
                    <WorkflowMenu onEditWorkflow={handleEditWorkflow} onDeleteWorkflow={handleDeleteWorkflow} />
                }
                canvasContent={
                    cwlReady ? (
                        <WorkflowCanvas
                            workflowItems={workspaces[currentWorkspace]}
                            updateCurrentWorkspaceItems={updateCurrentWorkspaceItems}
                            onSetWorkflowData={setGetWorkflowData}
                            onSetAddNode={setAddNode}
                            currentWorkspaceIndex={currentWorkspace}
                            workspaceId={workspaces[currentWorkspace]?.id}
                            saveViewportForWorkspace={saveViewportForWorkspace}
                        />
                    ) : (
                        <div className="ide-loading-placeholder">Loading tool definitions…</div>
                    )
                }
                cwlPreviewContent={
                    <CWLPreviewPanel getWorkflowData={getWorkflowData} workspaceId={workspaces[currentWorkspace]?.id} />
                }
                workflowManagerContent={
                    <WorkflowManagerPage
                        onEditWorkflow={handleEditWorkflow}
                        onDeleteWorkflow={handleDeleteWorkflow}
                        onNewWorkflow={handleNewWorkspace}
                        onImportWorkflow={handleImportCWL}
                        onDuplicateWorkflow={duplicateWorkflow}
                        onAccessArtifact={handleOpenWorkflowWithAction}
                        onUpdateNotes={updateWorkflowNotes}
                        workspaces={workspaces}
                        cwlReady={cwlReady}
                    />
                }
            />
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                actions={paletteActions}
                customWorkflows={customWorkflows}
                onSelectWorkflow={handlePaletteWorkflowSelect}
                anchorEl={searchAnchorEl}
                query={paletteQuery}
            />
        </>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ToastProvider>
        <AuxTabProvider>
            <CustomWorkflowsProvider>
                <SidebarProvider>
                    <TemplateAssetProvider>
                        <App />
                    </TemplateAssetProvider>
                </SidebarProvider>
            </CustomWorkflowsProvider>
        </AuxTabProvider>
    </ToastProvider>,
);
