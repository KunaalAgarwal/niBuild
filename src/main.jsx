import { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import ActionsBar from './components/actionsBar';
import HeaderBar from './components/headerBar';
import WorkflowMenu from './components/workflowMenu';
import ToggleWorkflowBar from './components/toggleWorkflowBar';
import WorkflowCanvas from './components/workflowCanvas'
import OutputNameInput from './components/outputNameInput';
import WorkflowNameInput from './components/workflowNameInput';
import Footer from "./components/footer";
import CWLPreviewPanel from './components/CWLPreviewPanel';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGenerateWorkflow } from './hooks/generateWorkflow';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { CustomWorkflowsProvider, useCustomWorkflowsContext } from './context/CustomWorkflowsContext.jsx';
import { TOOL_ANNOTATIONS } from './utils/toolAnnotations.js';
import { preloadAllCWL } from './utils/cwlParser.js';
import { invalidateMergeCache } from './utils/toolRegistry.js';
import { getInvalidConnectionReason } from './utils/adjacencyValidation.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/background.css';

/**
 * Compute boundary nodes (first/last non-dummy in topological order)
 * for a set of internal nodes and edges.
 */
function computeBoundaryNodes(nodes, edges) {
    const nonDummyNodes = nodes.filter(n => !n.isDummy && !n.data?.isDummy);
    if (nonDummyNodes.length === 0) return { firstNonDummy: null, lastNonDummy: null };

    // Build ID-based lookup
    const nodeIds = new Set(nonDummyNodes.map(n => n.id));
    const dummyIds = new Set(
        nodes.filter(n => n.isDummy || n.data?.isDummy).map(n => n.id)
    );
    const realEdges = edges.filter(e => !dummyIds.has(e.source) && !dummyIds.has(e.target));

    // Kahn's topo sort
    const incoming = Object.fromEntries(nonDummyNodes.map(n => [n.id, 0]));
    const outgoing = new Map(nonDummyNodes.map(n => [n.id, []]));
    realEdges.forEach(e => {
        if (incoming[e.target] !== undefined) incoming[e.target]++;
        outgoing.get(e.source)?.push(e.target);
    });

    const queue = nonDummyNodes.filter(n => incoming[n.id] === 0).map(n => n.id);
    const order = [];
    let head = 0;
    while (head < queue.length) {
        const id = queue[head++];
        order.push(id);
        for (const t of (outgoing.get(id) || [])) {
            if (--incoming[t] === 0) queue.push(t);
        }
    }

    const nodeById = new Map(nonDummyNodes.map(n => [n.id, n]));
    const firstNode = nodeById.get(order[0]);
    const lastNode = nodeById.get(order[order.length - 1]);

    return {
        firstNonDummy: firstNode?.label || firstNode?.data?.label || null,
        lastNonDummy: lastNode?.label || lastNode?.data?.label || null
    };
}

/**
 * Serialize workspace nodes for saving as a custom workflow.
 * Strips non-serializable data (callbacks) and normalizes shape.
 */
function serializeNodes(nodes) {
    return nodes.map(n => ({
        id: n.id,
        label: n.data?.label || n.label || '',
        isDummy: n.data?.isDummy || n.isDummy || false,
        parameters: n.data?.parameters || {},
        dockerVersion: n.data?.dockerVersion || 'latest',
        scatterEnabled: n.data?.scatterEnabled || false,
        linkMergeOverrides: n.data?.linkMergeOverrides || {},
        whenExpression: n.data?.whenExpression || '',
        expressions: n.data?.expressions || {},
        position: n.position || { x: 0, y: 0 }
    }));
}

function serializeEdges(edges) {
    return edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: { mappings: e.data?.mappings || [] }
    }));
}

/**
 * Compare workspace content against a saved custom workflow (ignoring node positions).
 * Returns true if there are differences (unsaved changes).
 */
function hasUnsavedChanges(workspace, savedWorkflow) {
    if (!workspace || !savedWorkflow) return false;

    const wsNodes = serializeNodes(workspace.nodes || []).map(({ position, ...rest }) => rest);
    const savedNodes = savedWorkflow.nodes.map(({ position, ...rest }) => rest);

    const wsEdges = serializeEdges(workspace.edges || []);
    const savedEdges = serializeEdges(savedWorkflow.edges || []);

    return JSON.stringify(wsNodes) !== JSON.stringify(savedNodes) ||
           JSON.stringify(wsEdges) !== JSON.stringify(savedEdges);
}

/**
 * Validate internal edges of a workflow before saving.
 * Returns true if any validation warnings exist.
 */
function validateWorkflowEdges(nodes, edges) {
    const dummyIds = new Set(
        nodes.filter(n => n.isDummy || n.data?.isDummy).map(n => n.id)
    );
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    for (const edge of edges) {
        if (dummyIds.has(edge.source) || dummyIds.has(edge.target)) continue;
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!sourceNode || !targetNode) continue;

        const srcLabel = sourceNode.label || sourceNode.data?.label;
        const tgtLabel = targetNode.label || targetNode.data?.label;
        if (srcLabel && tgtLabel) {
            const reason = getInvalidConnectionReason(srcLabel, tgtLabel);
            if (reason) return true;
        }
    }
    return false;
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
        updateWorkspaceName,
        updateWorkflowName,
        removeWorkflowNodesFromAll
    } = useWorkspaces();

    const currentOutputName = workspaces[currentWorkspace]?.name || '';
    const currentWorkflowName = workspaces[currentWorkspace]?.workflowName || '';

    // This state will eventually hold a function returned by WorkflowCanvas
    const [getWorkflowData, setGetWorkflowData] = useState(null);

    const { generateWorkflow } = useGenerateWorkflow();
    const { showError, showSuccess, showWarning, showInfo } = useToast();
    const { saveWorkflow, deleteWorkflow, getNextDefaultName, customWorkflows } = useCustomWorkflowsContext();

    // Preload all CWL files on mount so getToolConfigSync() works synchronously
    useEffect(() => {
        const cwlPaths = Object.values(TOOL_ANNOTATIONS)
            .map(ann => ann.cwlPath)
            .filter(Boolean);
        preloadAllCWL(cwlPaths)
            .then(() => invalidateMergeCache())
            .catch(err => {
                console.error('[App] CWL preload failed:', err);
                showError('Failed to load tool definitions. Some tools may not work correctly.');
            });
    }, []);

    const handleDeleteWorkflow = useCallback((wfId) => {
        deleteWorkflow(wfId);
        removeWorkflowNodesFromAll(wfId);
    }, [deleteWorkflow, removeWorkflowNodesFromAll]);

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
        const nonDummyNodes = data.nodes.filter(n => !n.data?.isDummy);
        if (nonDummyNodes.length === 0) {
            showError('Cannot save a workspace with only I/O nodes as a custom node.');
            return;
        }

        // Use the workflow name from the input, or auto-generate one
        const name = currentWorkflowName.trim() || getNextDefaultName();

        // Serialize nodes and edges (strip callbacks)
        const serializedNodes = serializeNodes(data.nodes);
        const serializedEdges = serializeEdges(data.edges);

        // Validate
        const hasWarnings = validateWorkflowEdges(serializedNodes, serializedEdges);
        if (hasWarnings) {
            showWarning('Workflow has connection warnings but will still be saved.');
        }

        // Compute boundary nodes
        const boundaryNodes = computeBoundaryNodes(serializedNodes, serializedEdges);

        const result = saveWorkflow({
            name,
            nodes: serializedNodes,
            edges: serializedEdges,
            hasValidationWarnings: hasWarnings,
            boundaryNodes
        });

        if (result === 'updated') {
            showSuccess(`Updated custom node "${name}"`);
        } else {
            showSuccess(`Saved as custom node "${name}"`);
        }

        // If the workflow name input was empty, auto-fill it with the generated name
        if (!currentWorkflowName.trim()) {
            updateWorkflowName(name);
        }
    }, [getWorkflowData, currentWorkflowName, saveWorkflow, getNextDefaultName, showError, showSuccess, showWarning, updateWorkflowName]);

    const handleWorkspaceSwitch = useCallback((newIndex) => {
        // Warn if leaving a workspace with unsaved custom workflow changes
        const currentWs = workspaces[currentWorkspace];
        const currentWfName = currentWs?.workflowName?.trim();
        if (currentWfName) {
            const savedWf = customWorkflows.find(w => w.name === currentWfName);
            if (savedWf && hasUnsavedChanges(currentWs, savedWf)) {
                showWarning(`Workflow "${currentWfName}" has unsaved changes`);
            }
        }

        // Notify if arriving at a workspace editing a custom workflow
        const targetWs = workspaces[newIndex];
        const targetWfName = targetWs?.workflowName?.trim();
        if (targetWfName) {
            const targetSaved = customWorkflows.find(w => w.name === targetWfName);
            if (targetSaved) {
                showInfo(`Editing custom workflow "${targetWfName}"`);
            }
        }

        setCurrentWorkspace(newIndex);
    }, [workspaces, currentWorkspace, customWorkflows, setCurrentWorkspace, showWarning, showInfo]);

    const handleEditWorkflow = useCallback((workflow) => {
        // Check if this workflow is already open in an existing workspace
        const existingIndex = workspaces.findIndex(ws => ws.workflowName === workflow.name);
        if (existingIndex !== -1) {
            handleWorkspaceSwitch(existingIndex);
            return;
        }

        // Convert serialized nodes back to canvas format
        const nodes = workflow.nodes.map(n => ({
            id: n.id,
            type: 'default',
            data: {
                label: n.label,
                isDummy: n.isDummy,
                parameters: n.parameters || {},
                dockerVersion: n.dockerVersion || 'latest',
                scatterEnabled: n.scatterEnabled || false,
                linkMergeOverrides: n.linkMergeOverrides || {},
                whenExpression: n.whenExpression || '',
                expressions: n.expressions || {},
            },
            position: n.position || { x: 0, y: 0 },
        }));

        const edges = workflow.edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            data: e.data || { mappings: [] },
        }));

        addNewWorkspaceWithData({
            nodes,
            edges,
            workflowName: workflow.name
        });
        showInfo(`Editing "${workflow.name}" in new workspace`);
    }, [addNewWorkspaceWithData, showInfo, workspaces, handleWorkspaceSwitch]);

    const isExistingWorkflow = currentWorkflowName.trim() && customWorkflows.some(w => w.name === currentWorkflowName.trim());
    const saveButtonLabel = isExistingWorkflow ? 'Update Workflow' : 'Save Workflow';

    return (
            <div className="app-layout">
                <HeaderBar />
                <div className="toolbar-row">
                    <ActionsBar
                        onNewWorkspace={addNewWorkspace}
                        onClearWorkspace={clearCurrentWorkspace}
                        onRemoveWorkspace={removeCurrentWorkspace}
                        workspaceCount={workspaces.length}
                        onGenerateWorkflow={() => generateWorkflow(getWorkflowData, currentOutputName, workspaces)}
                        onSaveWorkflow={handleSaveAsCustomNode}
                        saveButtonLabel={saveButtonLabel}
                    />
                    <div className="workflow-names-container">
                        <OutputNameInput
                            name={currentOutputName}
                            onNameChange={updateWorkspaceName}
                        />
                        <WorkflowNameInput
                            name={currentWorkflowName}
                            onNameChange={updateWorkflowName}
                            placeholder={getNextDefaultName()}
                        />
                    </div>
                </div>
                <div className="workflow-content">
                    <div className="workflow-content-main">
                        <WorkflowMenu onEditWorkflow={handleEditWorkflow} onDeleteWorkflow={handleDeleteWorkflow} />
                        <WorkflowCanvas
                            workflowItems={workspaces[currentWorkspace]}
                            updateCurrentWorkspaceItems={updateCurrentWorkspaceItems}
                            onSetWorkflowData={setGetWorkflowData}
                            currentWorkspaceIndex={currentWorkspace}
                        />
                        <CWLPreviewPanel
                            getWorkflowData={getWorkflowData}
                        />
                    </div>
                    <ToggleWorkflowBar
                        current={currentWorkspace}
                        workspaces={workspaces}
                        onChange={handleWorkspaceSwitch}
                    />
                </div>
                <Footer />
            </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ToastProvider>
        <CustomWorkflowsProvider>
            <App />
        </CustomWorkflowsProvider>
    </ToastProvider>
);
