import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import IDELayout from './components/IDELayout';
import WorkflowMenu from './components/workflowMenu';
import WorkflowCanvas from './components/workflowCanvas';
import CWLPreviewPanel from './components/CWLPreviewPanel';
import WorkflowComparisonModal from './components/WorkflowComparisonModal';
import CommandPalette from './components/CommandPalette';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGenerateWorkflow } from './hooks/generateWorkflow';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { CustomWorkflowsProvider, useCustomWorkflowsContext } from './context/CustomWorkflowsContext.jsx';
import { TOOL_ANNOTATIONS } from './utils/toolAnnotations.js';
import { preloadAllCWL } from './utils/cwlParser.js';
import { invalidateMergeCache } from './utils/toolRegistry.js';
import {
    serializeNodes,
    serializeEdges,
    deserializeNode,
    hasUnsavedChanges,
    computeWorkflowDiff,
    computeBoundaryNodes,
} from './utils/workflowDiff.js';
import { computeProblems } from './utils/workflowValidation.js';

import './styles/tokens.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/background.css';

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
        updateWorkspaceName,
        updateWorkflowName,
        updateSavedWorkflowId,
        removeWorkflowNodesFromAll,
        revertCurrentWorkspaceItems,
        saveViewportForWorkspace,
    } = useWorkspaces();

    const currentOutputName = workspaces[currentWorkspace]?.name || '';
    const currentWorkflowName = workspaces[currentWorkspace]?.workflowName || '';
    const savedWorkflowId = workspaces[currentWorkspace]?.savedWorkflowId || null;

    const sidebarRef = useRef(null);
    const cwlRef = useRef(null);
    const utilityRef = useRef(null);

    // This state will eventually hold a function returned by WorkflowCanvas
    const [getWorkflowData, setGetWorkflowData] = useState(null);
    const [addNode, setAddNode] = useState(null);
    const [cwlReady, setCwlReady] = useState(false);
    const [showComparisonModal, setShowComparisonModal] = useState(false);
    const [comparisonDiffData, setComparisonDiffData] = useState(null);
    const [showCommandPalette, setShowCommandPalette] = useState(false);

    const { generateWorkflow } = useGenerateWorkflow();
    const { showError, showSuccess, showWarning, showInfo } = useToast();
    const { saveWorkflow, updateWorkflow, deleteWorkflow, getNextDefaultName, customWorkflows } =
        useCustomWorkflowsContext();

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
    }, []);

    const handleDeleteWorkflow = useCallback(
        (wfId) => {
            deleteWorkflow(wfId);
            removeWorkflowNodesFromAll(wfId);
        },
        [deleteWorkflow, removeWorkflowNodesFromAll],
    );

    const handleSaveAsCustomNode = useCallback(() => {
        if (!getWorkflowData) {
            showError('No workflow data available to save.');
            return;
        }

        const data = getWorkflowData();
        if (!data || !data.nodes || data.nodes.length === 0) {
            showError('Cannot save an empty workspace as a custom node.');
            return;
        }

        // Need at least 1 non-dummy node
        const nonDummyNodes = data.nodes.filter((n) => !n.data?.isDummy);
        if (nonDummyNodes.length === 0) {
            showError('Cannot save a workspace with only I/O nodes as a custom node.');
            return;
        }

        // Use the workflow name from the input, or auto-generate one
        const name = currentWorkflowName.trim() || getNextDefaultName();

        // Serialize nodes and edges (strip callbacks)
        const serializedNodes = serializeNodes(data.nodes);
        const serializedEdges = serializeEdges(data.edges);

        // Compute boundary nodes
        const boundaryNodes = computeBoundaryNodes(serializedNodes, serializedEdges);

        const workflowData = {
            name,
            outputName: currentOutputName,
            nodes: serializedNodes,
            edges: serializedEdges,
            hasValidationWarnings: false,
            boundaryNodes,
        };

        if (savedWorkflowId) {
            // Workspace is bound — update existing workflow by ID
            updateWorkflow(savedWorkflowId, workflowData);
            showSuccess(`Updated custom node "${name}"`);
        } else {
            // New save — create and bind
            const { result, id } = saveWorkflow(workflowData);
            updateSavedWorkflowId(id);
            if (result === 'updated') {
                showSuccess(`Updated custom node "${name}"`);
            } else {
                showSuccess(`Saved as custom node "${name}"`);
            }
        }

        // If the workflow name input was empty, auto-fill it with the generated name
        if (!currentWorkflowName.trim()) {
            updateWorkflowName(name);
        }
    }, [
        getWorkflowData,
        currentWorkflowName,
        currentOutputName,
        savedWorkflowId,
        saveWorkflow,
        updateWorkflow,
        updateSavedWorkflowId,
        getNextDefaultName,
        showError,
        showSuccess,
        updateWorkflowName,
    ]);

    const handleWorkflowNameChange = useCallback(
        (newName) => {
            updateWorkflowName(newName);
        },
        [updateWorkflowName],
    );

    const handleWorkspaceSwitch = useCallback(
        (newIndex) => {
            // Warn if leaving a workspace with unsaved custom workflow changes
            const currentWs = workspaces[currentWorkspace];
            const currentWfName = currentWs?.workflowName?.trim();
            if (currentWfName) {
                const savedWf = customWorkflows.find((w) => w.name === currentWfName);
                if (savedWf && hasUnsavedChanges(currentWs, savedWf)) {
                    showWarning(`Workflow "${currentWfName}" has unsaved changes`);
                }
            }

            // Notify if arriving at a workspace editing a custom workflow
            const targetWs = workspaces[newIndex];
            const targetWfName = targetWs?.workflowName?.trim();
            if (targetWfName) {
                const targetSaved = customWorkflows.find((w) => w.name === targetWfName);
                if (targetSaved) {
                    showInfo(`Editing custom workflow "${targetWfName}"`);
                }
            }

            setCurrentWorkspace(newIndex);
        },
        [workspaces, currentWorkspace, customWorkflows, setCurrentWorkspace, showWarning, showInfo],
    );

    const handleEditWorkflow = useCallback(
        (workflow) => {
            // Check if this workflow is already open in an existing workspace
            const existingIndex = workspaces.findIndex((ws) => ws.savedWorkflowId === workflow.id);
            if (existingIndex !== -1) {
                handleWorkspaceSwitch(existingIndex);
                return;
            }

            // Convert serialized nodes back to canvas format
            const nodes = workflow.nodes.map(deserializeNode);
            const edges = workflow.edges.map((e) => ({
                id: e.id,
                source: e.source,
                target: e.target,
                data: e.data || { mappings: [] },
            }));

            addNewWorkspaceWithData({
                nodes,
                edges,
                name: workflow.outputName || '',
                workflowName: workflow.name,
                savedWorkflowId: workflow.id,
            });
            showInfo(`Editing "${workflow.name}" in new workspace`);
        },
        [addNewWorkspaceWithData, showInfo, workspaces, handleWorkspaceSwitch],
    );

    const handleOpenComparison = useCallback(() => {
        if (!savedWorkflowId) {
            showWarning('Current workspace is not editing a saved workflow.');
            return;
        }
        const workflow = customWorkflows.find((w) => w.id === savedWorkflowId);
        if (!workflow) {
            showError('Saved workflow not found.');
            return;
        }
        const currentWs = workspaces[currentWorkspace];
        if (!hasUnsavedChanges(currentWs, workflow)) {
            showInfo(`"${workflow.name}" has no unsaved changes.`);
            return;
        }
        const diffData = computeWorkflowDiff(workflow, currentWs);
        setComparisonDiffData(diffData);
        setShowComparisonModal(true);
    }, [savedWorkflowId, customWorkflows, workspaces, currentWorkspace, showWarning, showError, showInfo]);

    const handleRevertWorkflow = useCallback(() => {
        if (!savedWorkflowId) return;

        const workflow = customWorkflows.find((w) => w.id === savedWorkflowId);
        if (!workflow) return;

        const nodes = workflow.nodes.map(deserializeNode);
        const edges = workflow.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            data: e.data || { mappings: [] },
        }));

        revertCurrentWorkspaceItems(nodes, edges);
        updateWorkflowName(workflow.name);
        updateWorkspaceName(workflow.outputName || '');
        showSuccess(`Reverted "${workflow.name}" to last saved state.`);
    }, [
        savedWorkflowId,
        customWorkflows,
        revertCurrentWorkspaceItems,
        updateWorkflowName,
        updateWorkspaceName,
        showSuccess,
    ]);

    // Detect unsaved changes against the saved custom workflow
    const savedWorkflow = savedWorkflowId ? customWorkflows.find((w) => w.id === savedWorkflowId) : null;
    const workflowHasChanges = savedWorkflow ? hasUnsavedChanges(workspaces[currentWorkspace], savedWorkflow) : false;

    // Per-workspace status for tab annotations: 'unsaved' | 'modified' | null
    const workspaceStatuses = useMemo(() =>
        workspaces.map((ws) => {
            if (!ws.savedWorkflowId) {
                const hasContent = (ws.nodes || []).some((n) => !n.data?.isDummy);
                return hasContent ? 'unsaved' : null;
            }
            const saved = customWorkflows.find((w) => w.id === ws.savedWorkflowId);
            return saved && hasUnsavedChanges(ws, saved) ? 'modified' : null;
        }),
    [workspaces, customWorkflows]);

    const currentWs = workspaces[currentWorkspace];
    const validationProblems = useMemo(
        () => computeProblems(currentWs?.nodes, currentWs?.edges, workspaceStatuses[currentWorkspace]),
        [currentWs?.nodes, currentWs?.edges, workspaceStatuses, currentWorkspace],
    );

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

    const paletteActions = useMemo(
        () => [
            { id: 'new-workspace', label: 'New Workspace', handler: addNewWorkspace },
            { id: 'clear-workspace', label: 'Clear Workspace', handler: clearCurrentWorkspace },
            {
                id: 'remove-workspace',
                label: 'Remove Workspace',
                handler: removeCurrentWorkspace,
                disabled: workspaces.length <= 1,
            },
            {
                id: 'save-workflow',
                label: 'Save Workflow',
                handler: handleSaveAsCustomNode,
                disabled: !!savedWorkflowId,
            },
            {
                id: 'generate-workflow',
                label: 'Generate Workflow',
                handler: () => generateWorkflow(getWorkflowData, currentOutputName),
            },
            { id: 'import-cwl', label: 'Import CWL', handler: handleImportCWL },
        ],
        [
            addNewWorkspace,
            clearCurrentWorkspace,
            removeCurrentWorkspace,
            workspaces.length,
            handleSaveAsCustomNode,
            savedWorkflowId,
            generateWorkflow,
            getWorkflowData,
            currentOutputName,
            handleImportCWL,
        ],
    );

    const handlePaletteToolSelect = useCallback(
        (item) => {
            if (!addNode) return;
            addNode(item.name, {
                isDummy: item.isDummy || false,
                isBIDS: item.isBIDS || false,
                isOutputNode: item.isOutputNode || false,
                customWorkflowId: null,
            });
        },
        [addNode],
    );

    const handlePaletteWorkflowSelect = useCallback(
        (workflow) => {
            if (!addNode) return;
            addNode(workflow.name, {
                isDummy: false,
                isBIDS: false,
                isOutputNode: false,
                customWorkflowId: workflow.id,
            });
        },
        [addNode],
    );

    return (
        <>
            <IDELayout
                onNewWorkspace={addNewWorkspace}
                onGenerateWorkflow={() => generateWorkflow(getWorkflowData, currentOutputName)}
                onSaveWorkflow={handleSaveAsCustomNode}
                onRevertWorkflow={handleOpenComparison}
                isSavedWorkflow={!!savedWorkflowId}
                workflowHasChanges={workflowHasChanges}
                workflowDisplayName={currentWorkflowName.trim() || getNextDefaultName()}
                onOpenCommandPalette={() => setShowCommandPalette(true)}
                isCommandPaletteOpen={showCommandPalette}
                currentWorkspace={currentWorkspace}
                totalWorkspaces={workspaces.length}
                workspaces={workspaces}
                onWorkspaceSwitch={handleWorkspaceSwitch}
                onRemoveWorkspaceAt={removeWorkspace}
                onRenameWorkspace={renameWorkspace}
                workspaceStatuses={workspaceStatuses}
                validationProblems={validationProblems}
                sidebarRef={sidebarRef}
                cwlRef={cwlRef}
                utilityRef={utilityRef}
                sidebarContent={
                    <WorkflowMenu
                        onEditWorkflow={handleEditWorkflow}
                        onDeleteWorkflow={handleDeleteWorkflow}
                    />
                }
                canvasContent={
                    cwlReady ? (
                        <WorkflowCanvas
                            workflowItems={workspaces[currentWorkspace]}
                            updateCurrentWorkspaceItems={updateCurrentWorkspaceItems}
                            onSetWorkflowData={setGetWorkflowData}
                            onSetAddNode={setAddNode}
                            currentWorkspaceIndex={currentWorkspace}
                            saveViewportForWorkspace={saveViewportForWorkspace}
                        />
                    ) : (
                        <div className="ide-loading-placeholder">Loading tool definitions…</div>
                    )
                }
                cwlPreviewContent={
                    <CWLPreviewPanel getWorkflowData={getWorkflowData} />
                }
            />
            <CommandPalette
                isOpen={showCommandPalette}
                onClose={() => setShowCommandPalette(false)}
                actions={paletteActions}
                customWorkflows={customWorkflows}
                onSelectTool={handlePaletteToolSelect}
                onSelectWorkflow={handlePaletteWorkflowSelect}
            />
            <WorkflowComparisonModal
                show={showComparisonModal}
                onHide={() => setShowComparisonModal(false)}
                diffData={comparisonDiffData}
                onSave={() => {
                    handleSaveAsCustomNode();
                    setShowComparisonModal(false);
                }}
                onRevert={() => {
                    handleRevertWorkflow();
                    setShowComparisonModal(false);
                }}
                savedName={savedWorkflow?.name || ''}
            />
        </>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ToastProvider>
        <CustomWorkflowsProvider>
            <App />
        </CustomWorkflowsProvider>
    </ToastProvider>,
);
