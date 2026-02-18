import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { buildCWLWorkflowObject, buildJobTemplate } from '../hooks/buildWorkflow.js';
import { useToast } from '../context/ToastContext.jsx';
import YAML from 'js-yaml';
import '../styles/cwlPreviewPanel.css';

const SHEBANG = '#!/usr/bin/env cwl-runner\n\n';

const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
       .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const highlightYaml = (yaml) => {
    return yaml.split('\n').map((line) => {
        if (line.trimStart().startsWith('#')) {
            return `<span class="cwl-comment">${escapeHtml(line)}</span>`;
        }
        let hl = escapeHtml(line);
        hl = hl.replace(/^(\s*)([\w][\w-]*)(:)/, '$1<span class="cwl-key">$2</span>$3');
        hl = hl.replace(/&#39;(.*?)&#39;/g, '<span class="cwl-string">$&</span>');
        hl = hl.replace(/&quot;(.*?)&quot;/g, '<span class="cwl-string">$&</span>');
        hl = hl.replace(/\b(true|false|null)\b/g, '<span class="cwl-bool">$1</span>');
        return hl;
    }).join('\n');
};

function CWLPreviewPanel({ getWorkflowData }) {
    const { showWarning } = useToast();
    const [cwlOutput, setCwlOutput] = useState('');
    const [jobOutput, setJobOutput] = useState('');
    const [error, setError] = useState(null);
    const [showPlaceholder, setShowPlaceholder] = useState(true);
    const [activeTab, setActiveTab] = useState('workflow');
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const debounceRef = useRef(null);

    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('cwlPanelCollapsed');
            return saved === null ? true : JSON.parse(saved) === true;
        } catch {
            return true;
        }
    });

    const toggleCollapse = useCallback(() => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('cwlPanelCollapsed', JSON.stringify(next));
            return next;
        });
    }, []);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (typeof getWorkflowData !== 'function') {
                setShowPlaceholder(true);
                return;
            }
            try {
                const graph = getWorkflowData();
                const dummyIds = new Set((graph?.nodes || []).filter(n => n.data?.isDummy).map(n => n.id));
                const realNodeCount = (graph?.nodes || []).filter(n => !n.data?.isDummy).length;
                const realEdgeCount = (graph?.edges || []).filter(e => !dummyIds.has(e.source) && !dummyIds.has(e.target)).length;
                if (!graph || !graph.nodes || realNodeCount < 2 || !graph.edges || realEdgeCount < 1) {
                    setCwlOutput('');
                    setJobOutput('');
                    setError(null);
                    setShowPlaceholder(true);
                    return;
                }
                setShowPlaceholder(false);
                const { wf, jobDefaults } = buildCWLWorkflowObject(graph);
                setCwlOutput(SHEBANG + YAML.dump(wf, { noRefs: true }));
                setJobOutput(buildJobTemplate(wf, jobDefaults));
                setError(null);
            } catch (err) {
                setShowPlaceholder(false);
                setError(err.message);
            }
        }, 300);

        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [getWorkflowData]);

    const activeContent = activeTab === 'workflow' ? cwlOutput : jobOutput;

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(activeContent).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        }).catch(() => showWarning('Copy to clipboard failed'));
    }, [activeContent]);

    const highlightedHtml = useMemo(() => activeContent ? highlightYaml(activeContent) : '', [activeContent]);

    return (
        <>
            <div className={`cwl-preview-panel${isCollapsed ? ' cwl-collapsed' : ''}`}>
                {isCollapsed ? (
                    <div className="cwl-collapsed-strip" onClick={toggleCollapse} title="Expand CWL Preview">
                        <span className="cwl-collapsed-label">CWL Preview</span>
                    </div>
                ) : (
                    <>
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
                                    onClick={handleCopy}
                                    disabled={!activeContent}
                                    title="Copy to clipboard"
                                >
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                                <button
                                    className="cwl-action-btn"
                                    onClick={() => setShowFullscreen(true)}
                                    disabled={!activeContent}
                                    title="Expand to fullscreen"
                                >
                                    Expand
                                </button>
                                <button
                                    className="cwl-action-btn"
                                    onClick={toggleCollapse}
                                    title="Collapse panel"
                                >
                                    &raquo;
                                </button>
                            </div>
                        </div>

                        <div className="cwl-preview-body">
                            {error && (
                                <div className="cwl-error-banner">
                                    <span className="cwl-error-icon">!</span>
                                    <span>{error}</span>
                                </div>
                            )}
                            {showPlaceholder && !error && (
                                <div className="cwl-empty-message">
                                    Connect at least two nodes to preview the generated CWL workflow.
                                </div>
                            )}
                            {activeContent && (
                                <pre
                                    className="cwl-code"
                                    dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                                />
                            )}
                        </div>
                    </>
                )}
            </div>

            <Modal
                show={showFullscreen}
                onHide={() => setShowFullscreen(false)}
                centered
                size="xl"
                className="cwl-fullscreen-modal"
            >
                <Modal.Header>
                    <Modal.Title>
                        {activeTab === 'workflow' ? 'CWL Workflow Preview' : 'Job Template Preview'}
                    </Modal.Title>
                    <button
                        className="cwl-action-btn"
                        onClick={handleCopy}
                        disabled={!activeContent}
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                </Modal.Header>
                <Modal.Body>
                    <pre
                        className="cwl-code cwl-code-fullscreen"
                        dangerouslySetInnerHTML={{ __html: highlightedHtml }}
                    />
                </Modal.Body>
            </Modal>
        </>
    );
}

export default CWLPreviewPanel;
