import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import '../styles/workflowManagerPage.css';

// "5 minutes ago" / "2 hours ago" / "yesterday" / etc.
function formatRelative(ts) {
    if (!ts) return 'unknown';
    const diffMs = Date.now() - ts;
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (minutes < 1) return 'just now';
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    if (days < 30) return rtf.format(-days, 'day');
    return new Date(ts).toLocaleDateString();
}

function WorkflowManagerPage({ onEditWorkflow, onDeleteWorkflow }) {
    const { customWorkflows } = useCustomWorkflowsContext();
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const deleteConfirmRef = useRef(null);

    // Click-outside dismiss for the delete-confirm portal (same as WorkflowMenu).
    useEffect(() => {
        if (!deleteConfirm) return;
        const handle = (e) => {
            if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target)) {
                setDeleteConfirm(null);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [deleteConfirm]);

    // Sort newest-first by updatedAt (fall back to createdAt).
    const sorted = [...customWorkflows].sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
    );

    return (
        <div className="workflow-manager-page">
            <header className="wm-header">
                <h1 className="wm-title">Workflow Manager</h1>
                <p className="wm-subtitle">Browse and open your saved workflows.</p>
            </header>

            {sorted.length > 0 && (
                <div className="wm-section-header">
                    <span className="wm-section-title">Your workflows</span>
                    <span className="wm-section-count">
                        {sorted.length} {sorted.length === 1 ? 'workflow' : 'workflows'}
                    </span>
                </div>
            )}

            {sorted.length === 0 ? (
                <div className="wm-empty">
                    <svg
                        width="64"
                        height="64"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.25"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                    <h2>No saved workflows yet</h2>
                    <p>Save a workflow from the editor — it&apos;ll appear here.</p>
                </div>
            ) : (
                <ul className="wm-list">
                    {sorted.map((wf) => {
                        const toolCount = (wf.nodes || []).filter((n) => !n.isDummy && !n.data?.isDummy).length;
                        return (
                            <li key={wf.id} className="wm-row">
                                <span
                                    className={`wm-status${wf.hasValidationWarnings ? ' wm-status-warning' : ' wm-status-ok'}`}
                                >
                                    {wf.hasValidationWarnings ? (
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                            <line x1="12" y1="9" x2="12" y2="13" />
                                            <line x1="12" y1="17" x2="12.01" y2="17" />
                                        </svg>
                                    ) : (
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    )}
                                </span>

                                <div className="wm-row-main">
                                    <span className="wm-row-name">{wf.name}</span>
                                    <span className="wm-row-meta">
                                        {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
                                        {' · '}
                                        Updated {formatRelative(wf.updatedAt || wf.createdAt)}
                                    </span>
                                </div>

                                <div className="wm-row-actions">
                                    <button
                                        type="button"
                                        className="wm-action-btn wm-action-open"
                                        onClick={() => onEditWorkflow?.(wf)}
                                        title="Open in workspace"
                                    >
                                        <svg
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
                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                            <polyline points="15 3 21 3 21 9" />
                                            <line x1="10" y1="14" x2="21" y2="3" />
                                        </svg>
                                        <span>Open</span>
                                    </button>
                                    <button
                                        type="button"
                                        className="wm-action-btn wm-action-delete"
                                        title="Delete workflow"
                                        aria-label="Delete workflow"
                                        onClick={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            setDeleteConfirm({
                                                wfId: wf.id,
                                                wfName: wf.name,
                                                position: {
                                                    top: rect.top + rect.height / 2,
                                                    left: rect.right + 8,
                                                },
                                            });
                                        }}
                                    >
                                        <svg
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
                                            <line x1="18" y1="6" x2="6" y2="18" />
                                            <line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {deleteConfirm &&
                createPortal(
                    <div
                        ref={deleteConfirmRef}
                        className="delete-confirm-portal"
                        style={{
                            top: deleteConfirm.position.top,
                            left: deleteConfirm.position.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <span className="delete-confirm-text">Delete &lsquo;{deleteConfirm.wfName}&rsquo;?</span>
                        <span className="delete-confirm-subtext">All canvas instances will be removed.</span>
                        <div className="delete-confirm-buttons">
                            <button
                                className="delete-confirm-btn delete-confirm-yes"
                                onClick={() => {
                                    onDeleteWorkflow?.(deleteConfirm.wfId);
                                    setDeleteConfirm(null);
                                }}
                            >
                                Yes
                            </button>
                            <button
                                className="delete-confirm-btn delete-confirm-no"
                                onClick={() => setDeleteConfirm(null)}
                            >
                                No
                            </button>
                        </div>
                    </div>,
                    document.body,
                )}
        </div>
    );
}

export default WorkflowManagerPage;
