import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Modal } from 'react-bootstrap';
import { buildCWLWorkflowObject, buildJobTemplate } from '../hooks/buildWorkflow.js';
import { useToast } from '../context/ToastContext.jsx';
import YAML from 'js-yaml';
import '../styles/cwlPreviewPanel.css';

const SHEBANG = '#!/usr/bin/env cwl-runner\n\n';

const escapeHtml = (str) =>
    str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

const highlightYaml = (yaml) => {
    return yaml
        .split('\n')
        .map((line) => {
            if (line.trimStart().startsWith('#')) {
                return `<span class="cwl-comment">${escapeHtml(line)}</span>`;
            }
            let hl = escapeHtml(line);
            hl = hl.replace(/^(\s*)([\w][\w-]*)(:)/, '$1<span class="cwl-key">$2</span>$3');
            hl = hl.replace(/&#39;(.*?)&#39;/g, '<span class="cwl-string">$&</span>');
            hl = hl.replace(/&quot;(.*?)&quot;/g, '<span class="cwl-string">$&</span>');
            hl = hl.replace(/\b(true|false|null)\b/g, '<span class="cwl-bool">$1</span>');
            hl = hl.replace(/(\s#.*)$/, '<span class="cwl-comment">$1</span>');
            return hl;
        })
        .join('\n');
};

function CWLPreviewPanel({ getWorkflowData, onCollapse }) {
    const { showWarning } = useToast();
    const [cwlOutput, setCwlOutput] = useState('');
    const [jobOutput, setJobOutput] = useState('');
    const [error, setError] = useState(null);
    const [showPlaceholder, setShowPlaceholder] = useState(true);
    const [activeTab, setActiveTab] = useState('workflow');
    const [showFullscreen, setShowFullscreen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [copiedPane, setCopiedPane] = useState(null);
    const debounceRef = useRef(null);
    const copiedTimerRef = useRef(null);
    const copiedPaneTimerRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            if (typeof getWorkflowData !== 'function') {
                setShowPlaceholder(true);
                return;
            }
            try {
                const graph = getWorkflowData();
                const realNodeCount = (graph?.nodes || []).filter((n) => !n.data?.isDummy).length;
                const hasCustomWorkflow = (graph?.nodes || []).some((n) => n.data?.isCustomWorkflow);
                if (!graph || !graph.nodes || (!hasCustomWorkflow && realNodeCount < 1)) {
                    setCwlOutput('');
                    setJobOutput('');
                    setError(null);
                    setShowPlaceholder(true);
                    return;
                }
                setShowPlaceholder(false);
                const { wf, jobDefaults, cwlDefaultKeys } = buildCWLWorkflowObject(graph);
                setCwlOutput(SHEBANG + YAML.dump(wf, { noRefs: true }));
                setJobOutput(buildJobTemplate(wf, jobDefaults, cwlDefaultKeys));
                setError(null);
            } catch (err) {
                setShowPlaceholder(false);
                setError(err.message);
            }
        }, 300);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [getWorkflowData]);

    const activeContent = activeTab === 'workflow' ? cwlOutput : jobOutput;

    // Clean up copied-reset timers on unmount
    useEffect(
        () => () => {
            if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
            if (copiedPaneTimerRef.current) clearTimeout(copiedPaneTimerRef.current);
        },
        [],
    );

    const handleCopy = useCallback(() => {
        navigator.clipboard
            .writeText(activeContent)
            .then(() => {
                setCopied(true);
                if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
                copiedTimerRef.current = setTimeout(() => setCopied(false), 1500);
            })
            .catch(() => showWarning('Copy to clipboard failed'));
    }, [activeContent]);

    const highlightedCwl = useMemo(() => (cwlOutput ? highlightYaml(cwlOutput) : ''), [cwlOutput]);
    const highlightedJob = useMemo(() => (jobOutput ? highlightYaml(jobOutput) : ''), [jobOutput]);
    const highlightedHtml = activeTab === 'workflow' ? highlightedCwl : highlightedJob;

    const handleCopyPane = useCallback((content, pane) => {
        navigator.clipboard
            .writeText(content)
            .then(() => {
                setCopiedPane(pane);
                if (copiedPaneTimerRef.current) clearTimeout(copiedPaneTimerRef.current);
                copiedPaneTimerRef.current = setTimeout(() => setCopiedPane(null), 1500);
            })
            .catch(() => showWarning('Copy to clipboard failed'));
    }, []);

    return (
        <>
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
                        {onCollapse && (
                            <button className="cwl-action-btn" onClick={onCollapse} title="Collapse panel">
                                &raquo;
                            </button>
                        )}
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
                        <div className="cwl-empty-message">Add a node to preview the generated CWL workflow.</div>
                    )}
                    {activeContent && (
                        <pre className="cwl-code" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                    )}
                </div>
            </div>

            <Modal
                show={showFullscreen}
                onHide={() => setShowFullscreen(false)}
                centered
                size="xl"
                className="cwl-fullscreen-modal"
            >
                <Modal.Header>
                    <Modal.Title>CWL Preview</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="cwl-split-container">
                        <div className="cwl-split-pane">
                            <div className="cwl-split-pane-header">
                                <span className="cwl-split-pane-label">.cwl</span>
                                <button
                                    className="cwl-action-btn"
                                    onClick={() => handleCopyPane(cwlOutput, 'cwl')}
                                    disabled={!cwlOutput}
                                >
                                    {copiedPane === 'cwl' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre
                                className="cwl-code cwl-code-fullscreen"
                                dangerouslySetInnerHTML={{ __html: highlightedCwl }}
                            />
                        </div>
                        <div className="cwl-split-pane">
                            <div className="cwl-split-pane-header">
                                <span className="cwl-split-pane-label">.yml</span>
                                <button
                                    className="cwl-action-btn"
                                    onClick={() => handleCopyPane(jobOutput, 'job')}
                                    disabled={!jobOutput}
                                >
                                    {copiedPane === 'job' ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <pre
                                className="cwl-code cwl-code-fullscreen"
                                dangerouslySetInnerHTML={{ __html: highlightedJob }}
                            />
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
}

export default CWLPreviewPanel;
