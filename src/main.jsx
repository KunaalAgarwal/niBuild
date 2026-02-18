import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import ActionsBar from './components/actionsBar';
import HeaderBar from './components/headerBar';
import WorkflowMenu from './components/workflowMenu';
import ToggleWorkflowBar from './components/toggleWorkflowBar';
import WorkflowCanvas from './components/workflowCanvas'
import WorkflowNameInput from './components/workflowNameInput';
import Footer from "./components/footer";
import CWLPreviewPanel from './components/CWLPreviewPanel';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useGenerateWorkflow } from './hooks/generateWorkflow';
import { ToastProvider, useToast } from './context/ToastContext.jsx';
import { TOOL_ANNOTATIONS } from './utils/toolAnnotations.js';
import { preloadAllCWL } from './utils/cwlParser.js';
import { invalidateMergeCache } from './utils/toolRegistry.js';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/background.css';

function App() {
    const {
        workspaces,
        currentWorkspace,
        setCurrentWorkspace,
        addNewWorkspace,
        clearCurrentWorkspace,
        updateCurrentWorkspaceItems,
        removeCurrentWorkspace,
        updateWorkspaceName
    } = useWorkspaces();

    const currentWorkflowName = workspaces[currentWorkspace]?.name || '';

    // This state will eventually hold a function returned by WorkflowCanvas
    const [getWorkflowData, setGetWorkflowData] = useState(null);

    const { generateWorkflow } = useGenerateWorkflow();
    const { showError } = useToast();

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

    return (
        <div>
            <div className="app-layout">
                <HeaderBar />
                <div className="toolbar-row">
                    <ActionsBar
                        onNewWorkspace={addNewWorkspace}
                        onClearWorkspace={clearCurrentWorkspace}
                        onRemoveWorkspace={removeCurrentWorkspace}
                        workspaceCount={workspaces.length}
                        // On click, we pass our function to generateWorkflow
                        onGenerateWorkflow={() => generateWorkflow(getWorkflowData, currentWorkflowName)}
                    />
                    <WorkflowNameInput
                        name={currentWorkflowName}
                        onNameChange={updateWorkspaceName}
                    />
                </div>
                <div className="workflow-content">
                    <div className="workflow-content-main">
                        <WorkflowMenu />
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
                        onChange={setCurrentWorkspace}
                    />
                </div>
                <Footer />
            </div>
        </div>
    );
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <ToastProvider>
        <App />
    </ToastProvider>
);
