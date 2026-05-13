import { useState, useRef, useCallback, useEffect, isValidElement, cloneElement } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { useToast } from '../context/ToastContext.jsx';
import '../styles/ideLayout.css';

function IDELayout({
    onNewWorkspace,
    onGenerateWorkflow,
    onSaveWorkflow,
    onRevertWorkflow,
    isSavedWorkflow,
    workflowHasChanges,
    workflowDisplayName,
    onOpenCommandPalette,
    isCommandPaletteOpen,
    currentWorkspace,
    totalWorkspaces,
    sidebarContent,
    canvasContent,
    cwlPreviewContent,
    workspaces,
    onWorkspaceSwitch,
    onRemoveWorkspaceAt,
    onRenameWorkspace,
    workspaceStatuses,
    validationProblems = [],
    sidebarRef,
    cwlRef,
    utilityRef,
}) {
    const { logEntries, clearLog } = useToast();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [cwlCollapsed, setCwlCollapsed] = useState(true);
    const [utilityCollapsed, setUtilityCollapsed] = useState(false);
    const [activeUtilityTab, setActiveUtilityTab] = useState('problems');
    const [editingTab, setEditingTab] = useState(null);
    const [editingName, setEditingName] = useState('');
    // Workflow Manager is the default landing tab (VS Code Welcome-tab pattern).
    const [isManagerActive, setIsManagerActive] = useState(true);

    const layoutRef = useRef(null);
    const animTimer = useRef(null);
    const prevSidebar = useRef(false);
    const prevCwl = useRef(true);
    const prevUtility = useRef(false);
    const isInitialRender = useRef(true);
    // Snapshot of side/utility panel collapsed-state taken right before entering manager
    // mode; used to restore panels to their prior state when leaving manager mode.
    const beforeManagerState = useRef(null);

    useEffect(
        () => () => {
            if (animTimer.current) clearTimeout(animTimer.current);
        },
        [],
    );

    // When currentWorkspace changes (user click, sidebar open, new workspace, etc.),
    // exit manager mode. Skip the first render so the initial manager-active state holds.
    useEffect(() => {
        if (isInitialRender.current) {
            isInitialRender.current = false;
            return;
        }
        setIsManagerActive(false);
    }, [currentWorkspace]);

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
            const newEntries = logEntries.slice(prevLogLen.current);
            if (newEntries.some((e) => e.variant === 'danger')) {
                setActiveUtilityTab('log');
                if (utilityCollapsed) {
                    enableAnimation();
                    utilityRef.current?.expand();
                }
            }
        }
        prevLogLen.current = logEntries.length;
    }, [logEntries, utilityCollapsed, utilityRef, enableAnimation]);

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
        if (utilityCollapsed) {
            enableAnimation();
            utilityRef.current?.expand();
        }
        setActiveUtilityTab(tab);
    };

    return (
        <div className={`ide-layout${isManagerActive ? ' ide-manager-mode' : ''}`} ref={layoutRef}>
            <TopBar
                onGenerateWorkflow={onGenerateWorkflow}
                onSaveWorkflow={onSaveWorkflow}
                onRevertWorkflow={onRevertWorkflow}
                isSavedWorkflow={isSavedWorkflow}
                workflowHasChanges={workflowHasChanges}
                workflowDisplayName={workflowDisplayName}
                onOpenCommandPalette={onOpenCommandPalette}
                isCommandPaletteOpen={isCommandPaletteOpen}
            />
            <div className="ide-main-area">
                <PanelGroup orientation="horizontal" id="ide-outer-v4">
                    <Panel
                        id="sidebar"
                        collapsible={true}
                        panelRef={sidebarRef}
                        collapsedSize="40px"
                        minSize="15vh"
                        maxSize="35%"
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
                            ) : isValidElement(sidebarContent) ? (
                                cloneElement(sidebarContent, { onCollapse: handleCollapseSidebar })
                            ) : (
                                sidebarContent
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
                                                <div className="ide-tabs-scroll">
                                                    {/* Permanent Workflow Manager tab — non-closeable, leftmost. */}
                                                    <div
                                                        className={`ide-tab ide-tab-manager${isManagerActive ? ' active' : ''}`}
                                                        onClick={() => setIsManagerActive(true)}
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
                                                    {workspaces.map((ws, i) => {
                                                        const status = workspaceStatuses?.[i];
                                                        const isWorkspaceActive =
                                                            !isManagerActive && i === currentWorkspace;
                                                        return (
                                                            <div
                                                                key={ws.id}
                                                                className={`ide-tab${isWorkspaceActive ? ' active' : ''}${status ? ' ide-tab-dirty' : ''}`}
                                                                onClick={() => {
                                                                    setIsManagerActive(false);
                                                                    onWorkspaceSwitch(i);
                                                                }}
                                                                onDoubleClick={() =>
                                                                    startEditingTab(
                                                                        i,
                                                                        ws.workflowName ||
                                                                            ws.name ||
                                                                            `Workspace ${i + 1}`,
                                                                    )
                                                                }
                                                            >
                                                                {editingTab === i ? (
                                                                    <input
                                                                        className="ide-tab-edit"
                                                                        value={editingName}
                                                                        onChange={(e) => setEditingName(e.target.value)}
                                                                        onBlur={commitTabRename}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') commitTabRename();
                                                                            if (e.key === 'Escape') cancelTabRename();
                                                                        }}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        autoFocus
                                                                    />
                                                                ) : (
                                                                    <>
                                                                        <span className="ide-tab-label">
                                                                            {ws.workflowName ||
                                                                                ws.name ||
                                                                                `Workspace ${i + 1}`}
                                                                        </span>
                                                                        {status && (
                                                                            <span className="ide-tab-badge">
                                                                                {status === 'unsaved' ? 'U' : 'M'}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                )}
                                                                {workspaces.length > 1 && editingTab !== i && (
                                                                    <button
                                                                        className="ide-tab-close"
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
                                                    })}
                                                </div>
                                                <button
                                                    className="ide-tab-add"
                                                    onClick={() => {
                                                        setIsManagerActive(false);
                                                        onNewWorkspace();
                                                    }}
                                                    title="New workspace"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <div className="ide-canvas-wrapper">
                                                {isManagerActive ? (
                                                    <div className="ide-workflow-manager-placeholder">
                                                        <svg
                                                            className="ide-workflow-manager-icon"
                                                            width="48"
                                                            height="48"
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="1.5"
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
                                                        <h2>Workflow Manager</h2>
                                                        <p>
                                                            Coming soon — a place to browse, organize, and import your
                                                            saved workflows. For now, use the sidebar to drag tools onto
                                                            the canvas and build new workflows.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    canvasContent
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
                            <PanelResizeHandle className="ide-resize-handle ide-resize-handle-vertical" />
                            <Panel
                                id="utility-bar"
                                collapsible={true}
                                panelRef={utilityRef}
                                collapsedSize="30px"
                                minSize="8vh"
                                maxSize="40%"
                                defaultSize="25%"
                                onResize={handleUtilityResize}
                            >
                                <div className="ide-panel-content ide-utility-bar">
                                    <div className="ide-utility-tabs">
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'problems' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('problems')}
                                        >
                                            Problems
                                            {validationProblems.length > 0 && (
                                                <span className={`ide-badge-count ${validationProblems.some((p) => p.severity === 'error') ? 'error' : 'warning'}`}>
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
                                            {logEntries.length > 0 && (
                                                <span className={`ide-badge-count ${logEntries.some((e) => e.variant === 'danger') ? 'error' : logEntries.some((e) => e.variant === 'warning') ? 'warning' : 'info'}`}>
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
                                    </div>
                                    <div className="ide-utility-content">
                                        {activeUtilityTab === 'problems' &&
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
                                        {activeUtilityTab === 'io' && (
                                            <span className="ide-placeholder-text">No I/O information available.</span>
                                        )}
                                        {activeUtilityTab === 'log' &&
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
                                        {activeUtilityTab === 'env' && (
                                            <span className="ide-placeholder-text">No environment variables configured.</span>
                                        )}
                                        {activeUtilityTab === 'server' && (
                                            <span className="ide-placeholder-text">No server connected.</span>
                                        )}
                                    </div>
                                </div>
                            </Panel>
                        </PanelGroup>
                    </Panel>
                </PanelGroup>
            </div>
            <StatusBar currentWorkspace={currentWorkspace} totalWorkspaces={totalWorkspaces} />
        </div>
    );
}

export default IDELayout;
