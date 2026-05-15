import { useState, useCallback } from 'react';
import CWLPreviewContent from './CWLPreviewContent.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import '../styles/cwlPreviewPanel.css';

/**
 * Right-side panel: thin chrome around CWLPreviewContent.
 * Has an internal .cwl/.yml switcher and Expand/Collapse buttons.
 * Expand opens both files as full editor tabs.
 */
function CWLPreviewPanel({ getWorkflowData, workspaceId, onCollapse }) {
    const [activeTab, setActiveTab] = useState('workflow');
    const { openAuxTab, setActiveTabKey } = useAuxTabsContext();

    const handleExpand = useCallback(() => {
        if (!workspaceId) return;
        const cwlId = openAuxTab({ type: 'cwl', workspaceId });
        openAuxTab({ type: 'yml', workspaceId });
        setActiveTabKey(`aux-${cwlId}`);
    }, [workspaceId, openAuxTab, setActiveTabKey]);

    return (
        <div className="cwl-preview-panel">
            <div className="cwl-preview-header">
                <div className="cwl-tab-bar">
                    <button
                        className={`cwl-tab${activeTab === 'workflow' ? ' active' : ''}`}
                        onClick={() => setActiveTab('workflow')}
                    >
                        .cwl
                    </button>
                    <button
                        className={`cwl-tab${activeTab === 'job' ? ' active' : ''}`}
                        onClick={() => setActiveTab('job')}
                    >
                        .yml
                    </button>
                </div>
                <div className="cwl-preview-actions">
                    <button
                        className="cwl-action-btn"
                        onClick={handleExpand}
                        disabled={!workspaceId}
                        title="Open .cwl and .yml as tabs"
                    >
                        Expand
                    </button>
                    {onCollapse && (
                        <button className="cwl-action-btn" onClick={onCollapse} title="Collapse panel">
                            &raquo;
                        </button>
                    )}
                </div>
            </div>

            <div className="cwl-preview-body">
                <CWLPreviewContent getWorkflowData={getWorkflowData} pane={activeTab} mode="panel" />
            </div>
        </div>
    );
}

export default CWLPreviewPanel;
