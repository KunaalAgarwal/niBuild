import { useState, useRef, useCallback, useEffect, useMemo, isValidElement, cloneElement } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import SidebarParamContent from './SidebarParamContent.jsx';
import SidebarBidsContent from './SidebarBidsContent.jsx';
import SidebarStagedChangesContent from './SidebarStagedChangesContent.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useSidebar } from '../context/SidebarContext.jsx';
import '../styles/ideLayout.css';

function IDELayout({
    onNewWorkspace,
    onGenerateWorkflow,
    onSaveAsWorkflow,
    onSaveAsCustomNode,
    workflowDisplayName,
    onOpenCommandPalette,
    isCommandPaletteOpen,
    onSearchRefReady,
    paletteQuery,
    onPaletteQueryChange,
    currentWorkspace,
    totalWorkspaces,
    sidebarContent,
    canvasContent,
    cwlPreviewContent,
    workflowManagerContent,
    workspaces,
    onWorkspaceSwitch,
    onRemoveWorkspaceAt,
    onRenameWorkspace,
    workspaceStatuses,
    validationProblems = [],
    workflowIO = { inputs: [], outputs: [] },
    sidebarRef,
    cwlRef,
    utilityRef,
    // New: aux-tab system
    auxTabs = [],
    activeTabKey = 'manager',
    onActivateTab,
    onCloseAuxTab,
    auxTabContent = null,
    // Drag-and-drop tab reordering
    tabOrder = [],
    onReorderTab,
    // Staged-changes plumbing — drives Save→Update label flipping in the
    // TopBar and the Changes tab in the left sidebar. The sidebar tab and
    // Ctrl+K palette are the only entry points to view the diff.
    //
    // The two bindings are independent: a workspace can be bound to both a
    // workflow entry and a custom-node entry at once, and we render a section
    // per binding inside the Changes panel. Each Update/Revert button only
    // acts on its kind.
    isBoundAsWorkflow = false,
    isBoundAsCustomNode = false,
    hasWorkflowChanges = false,
    hasCustomNodeChanges = false,
    hasStagedChanges = false,
    boundWorkflow = null,
    boundCustomNode = null,
    onUpdateWorkflow,
    onUpdateCustomNode,
    onRevertToBinding,
}) {
    const { logEntries, clearLog } = useToast();
    const { activeTab: activeSidebarTab, setActiveTab: setActiveSidebarTab, getSelectedNode } = useSidebar();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [cwlCollapsed, setCwlCollapsed] = useState(true);
    const [utilityCollapsed, setUtilityCollapsed] = useState(false);
    const [activeUtilityTab, setActiveUtilityTab] = useState('problems');

    // Dirty markers for the sidebar's Parameters and BIDS panels. The panel
    // emits dirty=true on its first edit (or on mount if hydrated from a draft)
    // and dirty=false after a successful save. The host components also reset
    // their slot to false on selected-node change or unmount.
    const [sidebarParamsDirty, setSidebarParamsDirty] = useState(false);
    const [sidebarBidsDirty, setSidebarBidsDirty] = useState(false);
    const [editingTab, setEditingTab] = useState(null);
    const [editingName, setEditingName] = useState('');
    // Drag-and-drop tab reordering — local UI state, doesn't persist.
    const [draggedKey, setDraggedKey] = useState(null);
    // dropTarget: { key, position: 'before' | 'after' } | null — describes where the
    // 2px drop indicator should render.
    const [dropTarget, setDropTarget] = useState(null);

    // Derive view modes from activeTabKey (single source of truth).
    const isManagerActive = activeTabKey === 'manager';
    const isAuxActive = typeof activeTabKey === 'string' && activeTabKey.startsWith('aux-');

    const layoutRef = useRef(null);
    const animTimer = useRef(null);
    const prevSidebar = useRef(false);
    const prevCwl = useRef(true);
    const prevUtility = useRef(false);
    // Snapshot of side/utility panel collapsed-state taken right before entering manager
    // mode; used to restore panels to their prior state when leaving manager mode.
    const beforeManagerState = useRef(null);

    useEffect(
        () => () => {
            if (animTimer.current) clearTimeout(animTimer.current);
        },
        [],
    );

    // Per-aux-tab labels with collision-aware prefixing. When two or more
    // node-scoped aux tabs (bids-modal / param-modal / tool-param-modal) across
    // DIFFERENT workspaces share the same base label (the node's display name),
    // every colliding tab is prefixed with `<workflowName>/` to disambiguate.
    // cwl/yml tabs already embed the workspace name in their base label and are
    // pass-through. Computed once per render to avoid O(n²) lookups in the tab
    // strip walk below.
    const auxLabelMap = useMemo(() => {
        const wsById = new Map(workspaces.map((w) => [w.id, w]));
        const info = new Map(); // auxId -> { base, wsLabel, collides }
        const baseCounts = new Map(); // base -> Set<wsId>

        for (const t of auxTabs) {
            const ws = wsById.get(t.workspaceId);
            if (!ws) continue;
            const wsLabel = ws.name || 'workspace';
            let base;
            let collides = false;
            if (t.type === 'cwl') {
                base = `${wsLabel}.cwl`;
            } else if (t.type === 'yml') {
                base = `${wsLabel}.yml`;
            } else {
                // bids-modal | param-modal | tool-param-modal — node-scoped
                const node = (ws.nodes || []).find((n) => n.id === t.nodeId);
                base = node?.data?.displayLabel || node?.data?.label || 'node';
                collides = true;
            }
            info.set(t.id, { base, wsLabel, collides });
            if (collides) {
                if (!baseCounts.has(base)) baseCounts.set(base, new Set());
                baseCounts.get(base).add(t.workspaceId);
            }
        }

        const out = new Map();
        for (const [id, v] of info) {
            const collide = v.collides && (baseCounts.get(v.base)?.size || 0) > 1;
            out.set(id, collide ? `${v.wsLabel}/${v.base}` : v.base);
        }
        return out;
    }, [auxTabs, workspaces]);

    // Per-workspace decoration kind for the tab strip:
    //   'workflow'    → WRKF (blue)
    //   'custom-node' → CUSTOM (tangerine)
    //   null          → no decoration (workspace not bound to any saved entry)
    // A workspace can be bound to both kinds at once; in that case the
    // workflow binding wins for the decoration (workflows are the more
    // complete artifact, so it's the more useful "primary" identifier in the
    // tab strip).
    const workspaceKindMap = useMemo(() => {
        const m = new Map();
        for (const ws of workspaces) {
            if (ws.boundWorkflowId) m.set(ws.id, 'workflow');
            else if (ws.boundCustomNodeId) m.set(ws.id, 'custom-node');
            else m.set(ws.id, null);
        }
        return m;
    }, [workspaces]);

    // The workspace currently "in focus" for the sidebar — the one whose
    // selected node should populate the Params tab. Manager mode has no
    // associated workspace, so the Params tab disables in that case.
    const activeWorkspace = !isManagerActive && currentWorkspace != null ? workspaces[currentWorkspace] : null;

    // Params tab is disabled unless the active workspace has a selected node
    // whose kind is editable in this plan (tool or customWorkflow). BIDS / IO
    // / dummy nodes don't qualify — they're handled by the BIDS tab (BIDS) or
    // not at all (plain IO).
    const paramsDisabled = useMemo(() => {
        if (!activeWorkspace) return true;
        const nodeId = getSelectedNode(activeWorkspace.id);
        if (!nodeId) return true;
        const node = (activeWorkspace.nodes || []).find((n) => n.id === nodeId);
        if (!node) return true;
        const d = node.data || {};
        if (d.isDummy) return true; // IO and BIDS nodes both have isDummy
        return false; // tool or customWorkflow
    }, [activeWorkspace, getSelectedNode]);

    // BIDS tab is enabled only when the selected node is a BIDS node
    // (data.isBIDS === true). Inverse polarity to paramsDisabled — the two are
    // mutually exclusive by node kind today.
    const bidsDisabled = useMemo(() => {
        if (!activeWorkspace) return true;
        const nodeId = getSelectedNode(activeWorkspace.id);
        if (!nodeId) return true;
        const node = (activeWorkspace.nodes || []).find((n) => n.id === nodeId);
        if (!node) return true;
        return !node.data?.isBIDS;
    }, [activeWorkspace, getSelectedNode]);

    // Staged Changes tab is enabled when EITHER binding has unsaved
    // differences. The panel itself stacks one section per binding-with-
    // changes, so even a single dirty binding is enough to make the tab
    // useful. Manager mode disables the tab too — there is no workspace to
    // diff against.
    const stagedDisabled = isManagerActive || !hasStagedChanges;

    // If Params, BIDS, or Staged Changes is currently active but the
    // underlying condition just became ineligible (workspace switched, node
    // deleted, save/revert applied), fall back to Menu so we don't render an
    // empty/broken panel.
    useEffect(() => {
        if (activeSidebarTab === 'params' && paramsDisabled) setActiveSidebarTab('menu');
        if (activeSidebarTab === 'bids' && bidsDisabled) setActiveSidebarTab('menu');
        if (activeSidebarTab === 'staged' && stagedDisabled) setActiveSidebarTab('menu');
    }, [activeSidebarTab, paramsDisabled, bidsDisabled, stagedDisabled, setActiveSidebarTab]);

    const enableAnimation = useCallback(() => {
        layoutRef.current?.classList.add('ide-animating');
        if (animTimer.current) clearTimeout(animTimer.current);
        animTimer.current = setTimeout(() => {
            layoutRef.current?.classList.remove('ide-animating');
        }, 350);
    }, []);

    const prevLogLen = useRef(0);
    useEffect(() => {
        if (logEntries.length > prevLogLen.current) {
            // While the Workflow Manager tab is active, never programmatically
            // expand the utility bar — it must stay locked alongside the side
            // panels. Tab switch is also suppressed since the panel isn't visible.
            if (!isManagerActive) {
                const newEntries = logEntries.slice(prevLogLen.current);
                if (newEntries.some((e) => e.variant === 'danger')) {
                    setActiveUtilityTab('log');
                    if (utilityCollapsed) {
                        enableAnimation();
                        utilityRef.current?.expand();
                    }
                }
            }
        }
        prevLogLen.current = logEntries.length;
    }, [logEntries, utilityCollapsed, utilityRef, enableAnimation, isManagerActive]);

    // While the Workflow Manager tab is active, collapse the side/utility panels and
    // remember their prior state. Restore that prior state when the user switches back
    // to a workspace tab. CSS (.ide-manager-mode) additionally locks them while active.
    useEffect(() => {
        if (isManagerActive) {
            beforeManagerState.current = {
                sidebar: sidebarCollapsed,
                cwl: cwlCollapsed,
                utility: utilityCollapsed,
            };
            enableAnimation();
            sidebarRef.current?.collapse();
            cwlRef.current?.collapse();
            utilityRef.current?.collapse();
        } else if (beforeManagerState.current) {
            const prev = beforeManagerState.current;
            enableAnimation();
            if (!prev.sidebar) sidebarRef.current?.expand();
            if (!prev.cwl) cwlRef.current?.expand();
            if (!prev.utility) utilityRef.current?.expand();
            beforeManagerState.current = null;
        }
        // Reason: panel refs and enableAnimation are stable; this effect intentionally fires only on isManagerActive transitions.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isManagerActive]);

    const handleSidebarResize = useCallback(() => {
        const collapsed = sidebarRef.current?.isCollapsed() ?? false;
        if (collapsed !== prevSidebar.current) {
            enableAnimation();
            prevSidebar.current = collapsed;
        }
        setSidebarCollapsed(collapsed);
    }, [sidebarRef, enableAnimation]);

    const handleCwlResize = useCallback(() => {
        const collapsed = cwlRef.current?.isCollapsed() ?? false;
        if (collapsed !== prevCwl.current) {
            enableAnimation();
            prevCwl.current = collapsed;
        }
        setCwlCollapsed(collapsed);
    }, [cwlRef, enableAnimation]);

    const handleUtilityResize = useCallback(() => {
        const collapsed = utilityRef.current?.isCollapsed() ?? false;
        if (collapsed !== prevUtility.current) {
            enableAnimation();
            prevUtility.current = collapsed;
        }
        setUtilityCollapsed(collapsed);
    }, [utilityRef, enableAnimation]);

    const handleCollapseSidebar = useCallback(() => {
        enableAnimation();
        sidebarRef.current?.collapse();
    }, [enableAnimation, sidebarRef]);

    const handleCollapseCwl = useCallback(() => {
        enableAnimation();
        cwlRef.current?.collapse();
    }, [enableAnimation, cwlRef]);

    const startEditingTab = (i, currentName) => {
        setEditingTab(i);
        setEditingName(currentName);
    };

    const commitTabRename = () => {
        if (editingTab !== null && editingName.trim()) {
            onRenameWorkspace(editingTab, editingName.trim());
        }
        setEditingTab(null);
    };

    const cancelTabRename = () => {
        setEditingTab(null);
    };

    const handleUtilityTabClick = (tab) => {
        // Hard lock while the Workflow Manager is active — defense in depth on
        // top of the CSS pointer-events lock and the disabled Panel/Separator.
        if (isManagerActive) return;
        if (utilityCollapsed) {
            enableAnimation();
            utilityRef.current?.expand();
        }
        setActiveUtilityTab(tab);
    };

    // ---------- Drag-and-drop tab reordering ----------

    const handleDragStart = useCallback((e, key) => {
        // Firefox requires setData() for the drag operation to actually initialize.
        // The data value itself is unused — we read the dragged key from React state.
        e.dataTransfer.setData('text/plain', key);
        e.dataTransfer.effectAllowed = 'move';
        setDraggedKey(key);
    }, []);

    const handleTabDragOver = useCallback(
        (e, key) => {
            if (!draggedKey || key === draggedKey) return;
            e.preventDefault(); // REQUIRED to mark this element as a valid drop target
            e.dataTransfer.dropEffect = 'move';
            const rect = e.currentTarget.getBoundingClientRect();
            const position = e.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
            // Short-circuit identical updates so a 60fps dragover stream doesn't churn renders.
            setDropTarget((prev) =>
                prev && prev.key === key && prev.position === position ? prev : { key, position },
            );
        },
        [draggedKey],
    );

    const handleTabDrop = useCallback(
        (e, key) => {
            e.preventDefault();
            if (!draggedKey || draggedKey === key) {
                setDraggedKey(null);
                setDropTarget(null);
                return;
            }
            const fromIdx = tabOrder.indexOf(draggedKey);
            const overIdx = tabOrder.indexOf(key);
            if (fromIdx < 0 || overIdx < 0) {
                setDraggedKey(null);
                setDropTarget(null);
                return;
            }
            // Re-derive insertion side from drop coordinates rather than trusting
            // dropTarget state, which can be one frame stale.
            const rect = e.currentTarget.getBoundingClientRect();
            const insertBefore = e.clientX < rect.left + rect.width / 2;
            let target = insertBefore ? overIdx : overIdx + 1;
            // After splicing out the dragged key, indices to the right shift left by one.
            if (fromIdx < target) target -= 1;
            if (onReorderTab) onReorderTab(draggedKey, target);
            setDraggedKey(null);
            setDropTarget(null);
        },
        [draggedKey, tabOrder, onReorderTab],
    );

    const handleDragEnd = useCallback(() => {
        // Fires after any drop (or Escape, or drop outside a target) — always reset.
        setDraggedKey(null);
        setDropTarget(null);
    }, []);

    // Auto-scroll the tab bar when dragging near its left/right edges.
    const handleScrollAreaDragOver = useCallback(
        (e) => {
            if (!draggedKey) return;
            const el = e.currentTarget;
            const rect = el.getBoundingClientRect();
            const EDGE = 40;
            const SPEED = 8;
            if (e.clientX - rect.left < EDGE) {
                el.scrollLeft -= SPEED;
            } else if (rect.right - e.clientX < EDGE) {
                el.scrollLeft += SPEED;
            }
        },
        [draggedKey],
    );

    return (
        <div className={`ide-layout${isManagerActive ? ' ide-manager-mode' : ''}`} ref={layoutRef}>
            <TopBar
                onGenerateWorkflow={onGenerateWorkflow}
                onSaveAsWorkflow={onSaveAsWorkflow}
                onSaveAsCustomNode={onSaveAsCustomNode}
                workflowDisplayName={workflowDisplayName}
                onOpenCommandPalette={onOpenCommandPalette}
                isCommandPaletteOpen={isCommandPaletteOpen}
                onSearchRefReady={onSearchRefReady}
                paletteQuery={paletteQuery}
                onPaletteQueryChange={onPaletteQueryChange}
                isManagerActive={isManagerActive}
                isBoundAsWorkflow={isBoundAsWorkflow}
                isBoundAsCustomNode={isBoundAsCustomNode}
                hasWorkflowChanges={hasWorkflowChanges}
                hasCustomNodeChanges={hasCustomNodeChanges}
            />
            <div className="ide-main-area">
                <PanelGroup orientation="horizontal" id="ide-outer-v4">
                    <Panel
                        id="sidebar"
                        collapsible={true}
                        panelRef={sidebarRef}
                        collapsedSize="40px"
                        minSize="15vh"
                        maxSize="50%"
                        defaultSize="20%"
                        onResize={handleSidebarResize}
                    >
                        <div className="ide-panel-content ide-sidebar">
                            {sidebarCollapsed ? (
                                <div
                                    className="ide-collapsed-strip"
                                    onClick={() => {
                                        enableAnimation();
                                        sidebarRef.current?.expand();
                                    }}
                                >
                                    <span className="ide-collapsed-label">Tools</span>
                                </div>
                            ) : (
                                <>
                                    <div className="ide-sidebar-tabs" role="tablist">
                                        {/* Collapse button sits at the LEFT of the strip — flex-shrink: 0
                                            keeps it visible even when the sidebar is narrow and the
                                            tab labels truncate. */}
                                        <button
                                            type="button"
                                            className="ide-sidebar-collapse-btn"
                                            onClick={handleCollapseSidebar}
                                            title="Collapse sidebar"
                                            aria-label="Collapse sidebar"
                                        >
                                            &laquo;
                                        </button>
                                        <span
                                            className={`ide-sidebar-tab${activeSidebarTab === 'menu' ? ' active' : ''}`}
                                            role="tab"
                                            aria-selected={activeSidebarTab === 'menu'}
                                            onClick={() => setActiveSidebarTab('menu')}
                                        >
                                            Tools
                                        </span>
                                        <span
                                            className={`ide-sidebar-tab${activeSidebarTab === 'params' ? ' active' : ''}${paramsDisabled ? ' disabled' : ''}`}
                                            role="tab"
                                            aria-selected={activeSidebarTab === 'params' && !paramsDisabled}
                                            aria-disabled={paramsDisabled || undefined}
                                            onClick={paramsDisabled ? undefined : () => setActiveSidebarTab('params')}
                                            title={
                                                paramsDisabled
                                                    ? 'Select a tool or custom workflow node to edit its parameters'
                                                    : undefined
                                            }
                                        >
                                            Parameters
                                            {sidebarParamsDirty && !paramsDisabled && (
                                                <span
                                                    className="ide-sidebar-tab-dot"
                                                    title="Unsaved changes"
                                                    aria-label="Unsaved changes"
                                                />
                                            )}
                                        </span>
                                        <span
                                            className={`ide-sidebar-tab${activeSidebarTab === 'bids' ? ' active' : ''}${bidsDisabled ? ' disabled' : ''}`}
                                            role="tab"
                                            aria-selected={activeSidebarTab === 'bids' && !bidsDisabled}
                                            aria-disabled={bidsDisabled || undefined}
                                            onClick={bidsDisabled ? undefined : () => setActiveSidebarTab('bids')}
                                            title={
                                                bidsDisabled
                                                    ? 'Select a BIDS node to edit its dataset selection'
                                                    : undefined
                                            }
                                        >
                                            BIDS
                                            {sidebarBidsDirty && !bidsDisabled && (
                                                <span
                                                    className="ide-sidebar-tab-dot"
                                                    title="Unsaved changes"
                                                    aria-label="Unsaved changes"
                                                />
                                            )}
                                        </span>
                                        <span
                                            className={`ide-sidebar-tab ide-sidebar-tab-staged${activeSidebarTab === 'staged' ? ' active' : ''}${stagedDisabled ? ' disabled' : ''}`}
                                            role="tab"
                                            aria-selected={activeSidebarTab === 'staged' && !stagedDisabled}
                                            aria-disabled={stagedDisabled || undefined}
                                            onClick={stagedDisabled ? undefined : () => setActiveSidebarTab('staged')}
                                            title={
                                                stagedDisabled
                                                    ? !isBoundAsWorkflow && !isBoundAsCustomNode
                                                        ? 'Workspace is not bound to a saved workflow or custom node'
                                                        : 'No staged changes'
                                                    : 'View staged changes against the saved version(s)'
                                            }
                                        >
                                            Changes
                                        </span>
                                    </div>
                                    <div className="ide-sidebar-content">
                                        {activeSidebarTab === 'params' && !paramsDisabled ? (
                                            <SidebarParamContent
                                                workspace={activeWorkspace}
                                                onDirtyChange={setSidebarParamsDirty}
                                            />
                                        ) : activeSidebarTab === 'bids' && !bidsDisabled ? (
                                            <SidebarBidsContent
                                                workspace={activeWorkspace}
                                                onDirtyChange={setSidebarBidsDirty}
                                            />
                                        ) : activeSidebarTab === 'staged' && !stagedDisabled ? (
                                            <SidebarStagedChangesContent
                                                workspace={activeWorkspace}
                                                boundWorkflow={hasWorkflowChanges ? boundWorkflow : null}
                                                boundCustomNode={hasCustomNodeChanges ? boundCustomNode : null}
                                                onUpdateWorkflow={onUpdateWorkflow}
                                                onUpdateCustomNode={onUpdateCustomNode}
                                                onRevertToBinding={onRevertToBinding}
                                            />
                                        ) : (
                                            sidebarContent
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </Panel>
                    <PanelResizeHandle className="ide-resize-handle ide-resize-handle-horizontal" />
                    <Panel id="right-area">
                        <PanelGroup orientation="vertical" id="ide-vert-v4">
                            <Panel id="editor-area">
                                <PanelGroup orientation="horizontal" id="ide-horiz-v4">
                                    <Panel id="center">
                                        <div className="ide-center-column">
                                            <div className="ide-tab-bar">
                                                <div className="ide-tabs-scroll" onDragOver={handleScrollAreaDragOver}>
                                                    {/* Permanent Workflow Manager tab — non-closeable, leftmost.
                                                        Intentionally lacks drag handlers: it's pinned and never
                                                        reorderable, and never a drop target. */}
                                                    <div
                                                        className={`ide-tab ide-tab-manager${isManagerActive ? ' active' : ''}`}
                                                        onClick={() => onActivateTab && onActivateTab('manager')}
                                                        title="Workflow Manager"
                                                    >
                                                        <svg
                                                            className="ide-tab-icon"
                                                            width="14"
                                                            height="14"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            aria-hidden="true"
                                                        >
                                                            <line x1="8" y1="6" x2="21" y2="6" />
                                                            <line x1="8" y1="12" x2="21" y2="12" />
                                                            <line x1="8" y1="18" x2="21" y2="18" />
                                                            <line x1="3" y1="6" x2="3.01" y2="6" />
                                                            <line x1="3" y1="12" x2="3.01" y2="12" />
                                                            <line x1="3" y1="18" x2="3.01" y2="18" />
                                                        </svg>
                                                        <span className="ide-tab-label">Workflow Manager</span>
                                                    </div>
                                                    {/* Unified ordered walk: tabOrder interleaves workspace and aux
                                                        tabs in user-set order. Sync effect in main.jsx keeps it in
                                                        step with the live workspaces/auxTabs arrays. */}
                                                    {tabOrder.map((key) => {
                                                        const dragClass =
                                                            key === draggedKey ? ' ide-tab--dragging' : '';
                                                        const dropClass =
                                                            dropTarget?.key === key
                                                                ? dropTarget.position === 'before'
                                                                    ? ' ide-tab--drop-before'
                                                                    : ' ide-tab--drop-after'
                                                                : '';

                                                        if (key.startsWith('ws-')) {
                                                            const wsId = key.slice('ws-'.length);
                                                            // Look up by id, not by tabOrder position — handlers
                                                            // like onRemoveWorkspaceAt(i) need the index into the
                                                            // workspaces array.
                                                            const i = workspaces.findIndex((w) => w.id === wsId);
                                                            if (i < 0) return null;
                                                            const ws = workspaces[i];
                                                            const status = workspaceStatuses?.[i];
                                                            const isWorkspaceActive = activeTabKey === `ws-${ws.id}`;
                                                            // CUSTOM badge when the workspace is bound to a
                                                            // custom-node-kind entry; WRKF for workflow-kind
                                                            // or unbound workspaces.
                                                            const wsKind = workspaceKindMap.get(ws.id);
                                                            const decoKind =
                                                                wsKind === 'custom-node' ? 'custom' : 'wrkf';
                                                            const decoText =
                                                                wsKind === 'custom-node' ? 'CUSTOM' : 'WRKF';
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className={`ide-tab${isWorkspaceActive ? ' active' : ''}${status ? ' ide-tab-dirty' : ''}${dragClass}${dropClass}`}
                                                                    draggable={editingTab !== i}
                                                                    onClick={() => {
                                                                        if (onActivateTab) onActivateTab(`ws-${ws.id}`);
                                                                        else onWorkspaceSwitch(i);
                                                                    }}
                                                                    onDoubleClick={() =>
                                                                        startEditingTab(
                                                                            i,
                                                                            ws.name || `Workspace ${i + 1}`,
                                                                        )
                                                                    }
                                                                    onDragStart={(e) => handleDragStart(e, key)}
                                                                    onDragOver={(e) => handleTabDragOver(e, key)}
                                                                    onDrop={(e) => handleTabDrop(e, key)}
                                                                    onDragEnd={handleDragEnd}
                                                                >
                                                                    <span
                                                                        className={`ide-tab-decoration ide-tab-decoration-${decoKind}`}
                                                                    >
                                                                        {decoText}
                                                                    </span>
                                                                    {editingTab === i ? (
                                                                        <input
                                                                            className="ide-tab-edit"
                                                                            value={editingName}
                                                                            onChange={(e) =>
                                                                                setEditingName(e.target.value)
                                                                            }
                                                                            onBlur={commitTabRename}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter')
                                                                                    commitTabRename();
                                                                                if (e.key === 'Escape')
                                                                                    cancelTabRename();
                                                                            }}
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            autoFocus
                                                                        />
                                                                    ) : (
                                                                        <>
                                                                            <span className="ide-tab-label">
                                                                                {ws.name || `Workspace ${i + 1}`}
                                                                            </span>
                                                                            {status && (
                                                                                <span className="ide-tab-badge">
                                                                                    {status === 'unsaved' ? 'U' : 'M'}
                                                                                </span>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {editingTab !== i && (
                                                                        <button
                                                                            className="ide-tab-close"
                                                                            draggable={false}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onRemoveWorkspaceAt(i);
                                                                            }}
                                                                            title="Close workspace"
                                                                        >
                                                                            &times;
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        }

                                                        if (key.startsWith('aux-')) {
                                                            const auxId = key.slice('aux-'.length);
                                                            const t = auxTabs.find((tt) => tt.id === auxId);
                                                            if (!t) return null;
                                                            const isActive = activeTabKey === `aux-${t.id}`;
                                                            // Label and collision-prefix computed once in auxLabelMap.
                                                            const label = auxLabelMap.get(t.id) || 'node';
                                                            let decoKind = '';
                                                            let decoText = '';
                                                            if (t.type === 'cwl') {
                                                                decoKind = 'cwl';
                                                                decoText = 'CWL';
                                                            } else if (t.type === 'yml') {
                                                                decoKind = 'yml';
                                                                decoText = 'YML';
                                                            } else if (t.type === 'bids-modal') {
                                                                decoKind = 'bids';
                                                                decoText = 'BIDS';
                                                            } else if (t.type === 'param-modal') {
                                                                decoKind = 'params';
                                                                decoText = 'PARAMS';
                                                            } else if (t.type === 'tool-param-modal') {
                                                                decoKind = 'params';
                                                                decoText = 'PARAMS';
                                                            }
                                                            return (
                                                                <div
                                                                    key={key}
                                                                    className={`ide-tab ide-tab-aux ide-tab-${t.type}${isActive ? ' active' : ''}${dragClass}${dropClass}`}
                                                                    draggable
                                                                    onClick={() =>
                                                                        onActivateTab && onActivateTab(`aux-${t.id}`)
                                                                    }
                                                                    title={label}
                                                                    onDragStart={(e) => handleDragStart(e, key)}
                                                                    onDragOver={(e) => handleTabDragOver(e, key)}
                                                                    onDrop={(e) => handleTabDrop(e, key)}
                                                                    onDragEnd={handleDragEnd}
                                                                >
                                                                    <span
                                                                        className={`ide-tab-decoration ide-tab-decoration-${decoKind}`}
                                                                    >
                                                                        {decoText}
                                                                    </span>
                                                                    <span className="ide-tab-label">{label}</span>
                                                                    {t.isDirty && (
                                                                        <span
                                                                            className="ide-tab-dot"
                                                                            title="Unsaved changes"
                                                                            aria-label="Unsaved changes"
                                                                        />
                                                                    )}
                                                                    <button
                                                                        className="ide-tab-close"
                                                                        draggable={false}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (onCloseAuxTab) onCloseAuxTab(t.id);
                                                                        }}
                                                                        title="Close tab"
                                                                    >
                                                                        &times;
                                                                    </button>
                                                                </div>
                                                            );
                                                        }

                                                        return null;
                                                    })}
                                                </div>
                                                <button
                                                    className="ide-tab-add"
                                                    onClick={() => onNewWorkspace()}
                                                    title="New workspace"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <div className="ide-canvas-wrapper">
                                                {/* Canvas: always mounted when not in manager mode; hidden when an aux tab is active. */}
                                                {!isManagerActive && (
                                                    <div
                                                        className="ide-pane ide-pane-canvas"
                                                        style={isAuxActive ? { display: 'none' } : undefined}
                                                    >
                                                        {canvasContent}
                                                    </div>
                                                )}
                                                {isManagerActive && (
                                                    <div className="ide-pane ide-pane-manager">
                                                        {workflowManagerContent}
                                                    </div>
                                                )}
                                                {isAuxActive && (
                                                    <div className="ide-pane ide-pane-aux">{auxTabContent}</div>
                                                )}
                                            </div>
                                        </div>
                                    </Panel>
                                    <PanelResizeHandle className="ide-resize-handle ide-resize-handle-horizontal" />
                                    <Panel
                                        id="cwl-preview"
                                        collapsible={true}
                                        panelRef={cwlRef}
                                        collapsedSize="40px"
                                        minSize="15vh"
                                        maxSize="50%"
                                        onResize={handleCwlResize}
                                    >
                                        <div className="ide-panel-content ide-cwl-preview">
                                            {cwlCollapsed ? (
                                                <div
                                                    className="ide-collapsed-strip"
                                                    onClick={() => {
                                                        enableAnimation();
                                                        cwlRef.current?.expand();
                                                    }}
                                                >
                                                    <span className="ide-collapsed-label">CWL Preview</span>
                                                </div>
                                            ) : isValidElement(cwlPreviewContent) ? (
                                                cloneElement(cwlPreviewContent, { onCollapse: handleCollapseCwl })
                                            ) : (
                                                cwlPreviewContent
                                            )}
                                        </div>
                                    </Panel>
                                </PanelGroup>
                            </Panel>
                            <PanelResizeHandle
                                className="ide-resize-handle ide-resize-handle-vertical"
                                disabled={isManagerActive}
                            />
                            <Panel
                                id="utility-bar"
                                collapsible={true}
                                panelRef={utilityRef}
                                collapsedSize="30px"
                                minSize="8vh"
                                maxSize="75%"
                                defaultSize="25%"
                                onResize={handleUtilityResize}
                                disabled={isManagerActive}
                            >
                                <div className="ide-panel-content ide-utility-bar">
                                    <div className="ide-utility-tabs">
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'problems' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('problems')}
                                        >
                                            Problems
                                            {!isManagerActive && validationProblems.length > 0 && (
                                                <span
                                                    className={`ide-badge-count ${validationProblems.some((p) => p.severity === 'error') ? 'error' : 'warning'}`}
                                                >
                                                    {validationProblems.length}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'io' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('io')}
                                        >
                                            I/O
                                        </span>
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'log' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('log')}
                                        >
                                            Log
                                            {!isManagerActive && logEntries.length > 0 && (
                                                <span
                                                    className={`ide-badge-count ${logEntries.some((e) => e.variant === 'danger') ? 'error' : logEntries.some((e) => e.variant === 'warning') ? 'warning' : 'info'}`}
                                                >
                                                    {logEntries.length}
                                                </span>
                                            )}
                                        </span>
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'env' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('env')}
                                        >
                                            Env
                                        </span>
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'server' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('server')}
                                        >
                                            Server
                                        </span>
                                        {!isManagerActive && (
                                            <button
                                                className="ide-utility-collapse-btn"
                                                onClick={() => {
                                                    enableAnimation();
                                                    utilityCollapsed
                                                        ? utilityRef.current?.expand()
                                                        : utilityRef.current?.collapse();
                                                }}
                                                title={utilityCollapsed ? 'Expand panel' : 'Collapse panel'}
                                            >
                                                {utilityCollapsed ? '▴' : '▾'}
                                            </button>
                                        )}
                                    </div>
                                    <div className="ide-utility-content">
                                        {isManagerActive && (
                                            <span className="ide-placeholder-text">
                                                Open a workflow to view problems, I/O, and logs.
                                            </span>
                                        )}
                                        {!isManagerActive &&
                                            activeUtilityTab === 'problems' &&
                                            (validationProblems.length === 0 ? (
                                                <span className="ide-placeholder-text">No problems detected.</span>
                                            ) : (
                                                <div className="ide-problem-list">
                                                    {validationProblems.map((p) => (
                                                        <div key={p.id} className="ide-problem-item">
                                                            <span className={`ide-problem-icon ${p.severity}`} />
                                                            <span className="ide-problem-node">{p.nodeLabel}</span>
                                                            <span className="ide-problem-message">{p.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        {!isManagerActive &&
                                            activeUtilityTab === 'io' &&
                                            (workflowIO.inputs.length === 0 && workflowIO.outputs.length === 0 ? (
                                                <span className="ide-placeholder-text">No nodes in workflow.</span>
                                            ) : (
                                                <div className="ide-io-panel">
                                                    {workflowIO.inputs.length > 0 && (
                                                        <>
                                                            <div className="ide-io-section-header">Inputs</div>
                                                            {workflowIO.inputs.map((group) => (
                                                                <div key={group.nodeId} className="ide-io-group">
                                                                    <div className="ide-io-group-label">
                                                                        {group.nodeLabel}
                                                                    </div>
                                                                    {group.inputs.map((inp) => (
                                                                        <div
                                                                            key={`${group.nodeId}-${inp.name}`}
                                                                            className="ide-io-item"
                                                                        >
                                                                            <span
                                                                                className={`ide-problem-icon ${inp.wired ? 'success' : 'error'}`}
                                                                            />
                                                                            <span className="ide-io-name">
                                                                                {inp.label}
                                                                            </span>
                                                                            <span className="ide-io-type">
                                                                                {inp.type}
                                                                            </span>
                                                                            {inp.source && (
                                                                                <span className="ide-io-source">
                                                                                    &larr; {inp.source}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                    {workflowIO.outputs.length > 0 && (
                                                        <>
                                                            <div className="ide-io-section-header">Outputs</div>
                                                            {workflowIO.outputs.map((out) => (
                                                                <div
                                                                    key={`${out.nodeId}-${out.name}`}
                                                                    className="ide-io-item"
                                                                >
                                                                    <span className="ide-problem-icon info" />
                                                                    <span className="ide-io-node">{out.nodeLabel}</span>
                                                                    <span className="ide-io-name">{out.label}</span>
                                                                    <span className="ide-io-type">
                                                                        {out.type}
                                                                        {out.extensions.length > 0
                                                                            ? ` (${out.extensions.join(', ')})`
                                                                            : ''}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </>
                                                    )}
                                                </div>
                                            ))}
                                        {!isManagerActive &&
                                            activeUtilityTab === 'log' &&
                                            (logEntries.length === 0 ? (
                                                <span className="ide-placeholder-text">No log entries.</span>
                                            ) : (
                                                <div className="ide-log-list">
                                                    <div className="ide-log-header">
                                                        <button className="ide-log-clear" onClick={clearLog}>
                                                            Clear
                                                        </button>
                                                    </div>
                                                    {[...logEntries].reverse().map((entry) => (
                                                        <div key={entry.id} className="ide-log-item">
                                                            <span
                                                                className={`ide-problem-icon ${entry.variant === 'danger' ? 'error' : entry.variant}`}
                                                            />
                                                            <span className="ide-log-time">
                                                                {new Date(entry.timestamp).toLocaleTimeString([], {
                                                                    hour: '2-digit',
                                                                    minute: '2-digit',
                                                                    second: '2-digit',
                                                                })}
                                                            </span>
                                                            <span className="ide-log-message">{entry.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ))}
                                        {!isManagerActive && activeUtilityTab === 'env' && (
                                            <span className="ide-placeholder-text">
                                                No environment variables configured.
                                            </span>
                                        )}
                                        {!isManagerActive && activeUtilityTab === 'server' && (
                                            <span className="ide-placeholder-text">No server connected.</span>
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </div>
            <StatusBar
                currentWorkspace={currentWorkspace}
                totalWorkspaces={totalWorkspaces}
                isManagerActive={isManagerActive}
            />
        </div>
    );
}

export default IDELayout;
