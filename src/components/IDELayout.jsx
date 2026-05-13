import { useState, useRef, useCallback, useEffect, isValidElement, cloneElement } from 'react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
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
    sidebarRef,
    cwlRef,
    utilityRef,
}) {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [cwlCollapsed, setCwlCollapsed] = useState(true);
    const [utilityCollapsed, setUtilityCollapsed] = useState(false);
    const [activeUtilityTab, setActiveUtilityTab] = useState('problems');
    const [editingTab, setEditingTab] = useState(null);
    const [editingName, setEditingName] = useState('');

    const layoutRef = useRef(null);
    const animTimer = useRef(null);
    const prevSidebar = useRef(false);
    const prevCwl = useRef(true);
    const prevUtility = useRef(false);

    useEffect(() => () => { if (animTimer.current) clearTimeout(animTimer.current); }, []);

    const enableAnimation = useCallback(() => {
        layoutRef.current?.classList.add('ide-animating');
        if (animTimer.current) clearTimeout(animTimer.current);
        animTimer.current = setTimeout(() => {
            layoutRef.current?.classList.remove('ide-animating');
        }, 350);
    }, []);

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
        <div className="ide-layout" ref={layoutRef}>
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
                                <div className="ide-collapsed-strip" onClick={() => { enableAnimation(); sidebarRef.current?.expand(); }}>
                                    <span className="ide-collapsed-label">Tools</span>
                                </div>
                            ) : isValidElement(sidebarContent)
                                ? cloneElement(sidebarContent, { onCollapse: handleCollapseSidebar })
                                : sidebarContent}
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
                                                    {workspaces.map((ws, i) => {
                                                        const status = workspaceStatuses?.[i];
                                                        return (
                                                        <div
                                                            key={ws.id}
                                                            className={`ide-tab${i === currentWorkspace ? ' active' : ''}${status ? ' ide-tab-dirty' : ''}`}
                                                            onClick={() => onWorkspaceSwitch(i)}
                                                            onDoubleClick={() => startEditingTab(i, ws.workflowName || ws.name || `Workspace ${i + 1}`)}
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
                                                                        {ws.workflowName || ws.name || `Workspace ${i + 1}`}
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
                                                                    onClick={(e) => { e.stopPropagation(); onRemoveWorkspaceAt(i); }}
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
                                                    onClick={onNewWorkspace}
                                                    title="New workspace"
                                                >
                                                    +
                                                </button>
                                            </div>
                                            <div className="ide-canvas-wrapper">
                                                {canvasContent}
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
                                                <div className="ide-collapsed-strip" onClick={() => { enableAnimation(); cwlRef.current?.expand(); }}>
                                                    <span className="ide-collapsed-label">CWL Preview</span>
                                                </div>
                                            ) : isValidElement(cwlPreviewContent)
                                                ? cloneElement(cwlPreviewContent, { onCollapse: handleCollapseCwl })
                                                : cwlPreviewContent}
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
                                        </span>
                                        <span
                                            className={`ide-utility-tab${activeUtilityTab === 'io' ? ' active' : ''}`}
                                            onClick={() => handleUtilityTabClick('io')}
                                        >
                                            I/O
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
                                                utilityCollapsed ? utilityRef.current?.expand() : utilityRef.current?.collapse();
                                            }}
                                            title={utilityCollapsed ? 'Expand panel' : 'Collapse panel'}
                                        >
                                            {utilityCollapsed ? '▴' : '▾'}
                                        </button>
                                    </div>
                                    <div className="ide-utility-content">
                                        <span className="ide-placeholder-text">
                                            No problems detected.
                                        </span>
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
