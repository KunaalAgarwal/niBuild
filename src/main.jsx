import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import ActionsBar from './components/actionsBar';
import HeaderBar from './components/headerBar';
import WorkflowMenu from './components/workflowMenu';
import ToggleWorkflowBar from './components/toggleWorkflowBar';
import WorkflowCanvas from './components/workflowCanvas';
import OutputNameInput from './components/outputNameInput';
import WorkflowNameInput from './components/workflowNameInput';
import Footer from './components/footer';
import CWLPreviewPanel from './components/CWLPreviewPanel';
import WorkflowComparisonModal from './components/WorkflowComparisonModal';
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

    // This state will eventually hold a function returned by WorkflowCanvas
    const [getWorkflowData, setGetWorkflowData] = useState(null);
    const [cwlReady, setCwlReady] = useState(false);
    const [showComparisonModal, setShowComparisonModal] = useState(false);
    const [comparisonDiffData, setComparisonDiffData] = useState(null);

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

    return (
        <div className="app-layout">
            <HeaderBar />
            <div className="toolbar-row">
                <ActionsBar
                    onNewWorkspace={addNewWorkspace}
                    onClearWorkspace={clearCurrentWorkspace}
                    onRemoveWorkspace={removeCurrentWorkspace}
                    workspaceCount={workspaces.length}
                    onGenerateWorkflow={() => generateWorkflow(getWorkflowData, currentOutputName)}
                    onSaveWorkflow={handleSaveAsCustomNode}
                    onRevertWorkflow={handleOpenComparison}
                    isSavedWorkflow={!!savedWorkflowId}
                    workflowHasChanges={workflowHasChanges}
                />
                <div className="workflow-names-container">
                    <OutputNameInput name={currentOutputName} onNameChange={updateWorkspaceName} />
                    <WorkflowNameInput
                        name={currentWorkflowName}
                        onNameChange={handleWorkflowNameChange}
                        placeholder={getNextDefaultName()}
                    />
                </div>
            </div>
            <div className="workflow-content">
                <div className="workflow-content-main">
                    <WorkflowMenu onEditWorkflow={handleEditWorkflow} onDeleteWorkflow={handleDeleteWorkflow} />
                    {cwlReady ? (
                        <WorkflowCanvas
                            workflowItems={workspaces[currentWorkspace]}
                            updateCurrentWorkspaceItems={updateCurrentWorkspaceItems}
                            onSetWorkflowData={setGetWorkflowData}
                            currentWorkspaceIndex={currentWorkspace}
                            saveViewportForWorkspace={saveViewportForWorkspace}
                        />
                    ) : (
                        <div
                            className="workflow-canvas-loading"
                            style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'var(--text-secondary)',
                            }}
                        >
                            Loading tool definitions…
                        </div>
                    )}
                    <CWLPreviewPanel getWorkflowData={getWorkflowData} />
                </div>
                <ToggleWorkflowBar
                    current={currentWorkspace}
                    workspaces={workspaces}
                    onChange={handleWorkspaceSwitch}
                />
            </div>
            <Footer />
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
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ToastProvider>
        <CustomWorkflowsProvider>
            <App />
        </CustomWorkflowsProvider>
    </ToastProvider>,
);
