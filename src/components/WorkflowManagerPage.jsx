import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import { computeProblems } from '../utils/workflowValidation.js';
import { deserializeNode, hasUnsavedChanges } from '../utils/workflowDiff.js';
import '../styles/workflowManagerPage.css';

const NOTES_MAX_LENGTH = 2000;

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

const SORT_KEYS = {
    UPDATED: 'updated',
    NAME: 'name',
    STATUS: 'status',
};

// Severity score for the Status column comparator: errors outweigh warnings,
// warnings outweigh clean. Higher = "worse" so desc puts problems first.
function statusScore(s) {
    if (!s) return 0;
    return s.errors * 1000 + s.warnings;
}

function makeComparator(key, dir, statusByWfId) {
    const sign = dir === 'asc' ? 1 : -1;
    if (key === SORT_KEYS.NAME) {
        return (a, b) => sign * (a.name || '').localeCompare(b.name || '');
    }
    if (key === SORT_KEYS.STATUS) {
        return (a, b) => sign * (statusScore(statusByWfId.get(a.id)) - statusScore(statusByWfId.get(b.id)));
    }
    // updated (default) — newest first when desc
    return (a, b) => sign * ((b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
}

function SortChevron({ active, dir }) {
    if (!active) {
        return (
            <svg
                className="wm-sort-chevron wm-sort-chevron-idle"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
            >
                <polyline points="8 9 12 5 16 9" />
                <polyline points="8 15 12 19 16 15" />
            </svg>
        );
    }
    return (
        <svg
            className="wm-sort-chevron wm-sort-chevron-active"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {dir === 'asc' ? <polyline points="6 15 12 9 18 15" /> : <polyline points="6 9 12 15 18 9" />}
        </svg>
    );
}

/* ── Status pill ─────────────────────────────────────────────── */

function StatusPill({ status }) {
    // Render nothing while the validator can't run yet (tool registry preloading).
    // This is preferred over a loading-state pill so first paint doesn't lie.
    if (!status) return null;

    const errors = status.errors || 0;
    const warnings = status.warnings || 0;

    if (errors > 0) {
        return (
            <span
                className="wm-status-pill wm-status-pill-error"
                title={`${errors} validation ${errors === 1 ? 'error' : 'errors'}`}
            >
                {errors} {errors === 1 ? 'error' : 'errors'}
            </span>
        );
    }
    if (warnings > 0) {
        return (
            <span
                className="wm-status-pill wm-status-pill-warning"
                title={`${warnings} validation ${warnings === 1 ? 'warning' : 'warnings'}`}
            >
                {warnings} {warnings === 1 ? 'warning' : 'warnings'}
            </span>
        );
    }
    return (
        <span className="wm-status-pill wm-status-pill-ok" title="No validation issues">
            OK
        </span>
    );
}

/* ── Inline notes textarea ───────────────────────────────────── */

/**
 * Auto-growing textarea with autosave-on-blur. Holds a local draft so each
 * keystroke doesn't ripple through the parent's workflows array (which
 * would re-derive every other row's status).
 */
function NotesInput({ wfId, initialNotes, onSave }) {
    const [draft, setDraft] = useState(initialNotes || '');
    const ref = useRef(null);
    const lastSavedRef = useRef(initialNotes || '');

    // If the workflow's notes change externally (e.g. another row's save
    // triggered a re-render that brought a fresher snapshot), reconcile.
    useEffect(() => {
        if (initialNotes !== lastSavedRef.current) {
            setDraft(initialNotes || '');
            lastSavedRef.current = initialNotes || '';
        }
    }, [initialNotes]);

    // Auto-grow: reset to 'auto' first so shrinking works, then size to scrollHeight.
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }, [draft]);

    const commit = () => {
        if (draft === lastSavedRef.current) return;
        lastSavedRef.current = draft;
        onSave?.(wfId, draft);
    };

    return (
        <textarea
            ref={ref}
            className="wm-notes-input"
            value={draft}
            placeholder="Add notes"
            maxLength={NOTES_MAX_LENGTH}
            spellCheck
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
                // Ctrl/Cmd+Enter saves and blurs (matches a common power-user expectation).
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    e.currentTarget.blur();
                }
            }}
        />
    );
}

/* ── Page component ──────────────────────────────────────────── */

function WorkflowManagerPage({
    onEditWorkflow,
    onDeleteWorkflow,
    onNewWorkflow,
    onImportWorkflow,
    onDuplicateWorkflow,
    onAccessArtifact,
    onUpdateNotes,
    workspaces = [],
    cwlReady = false,
}) {
    const { workflows } = useCustomWorkflowsContext();

    const [sort, setSort] = useState({ key: SORT_KEYS.UPDATED, dir: 'desc' });
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [actionMenu, setActionMenu] = useState(null); // { wfId, position }

    const deleteConfirmRef = useRef(null);
    const actionMenuRef = useRef(null);

    // Click-outside dismiss for the delete-confirm portal.
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

    // Click-outside dismiss for the row "..." action menu.
    useEffect(() => {
        if (!actionMenu) return;
        const handle = (e) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(e.target)) {
                setActionMenu(null);
            }
        };
        document.addEventListener('mousedown', handle);
        return () => document.removeEventListener('mousedown', handle);
    }, [actionMenu]);

    // Compute fresh validation status (errors / warnings) for every saved
    // workflow. Gated on `cwlReady` because computeProblems → getToolIO /
    // getToolConfigSync need the tool registry preloaded; running before
    // that would silently report 0 problems for everything.
    const statusByWfId = useMemo(() => {
        if (!cwlReady) return null;
        const map = new Map();
        for (const wf of workflows) {
            try {
                const nodes = (wf.nodes || []).map(deserializeNode);
                const edges = (wf.edges || []).map((e) => ({
                    id: e.id,
                    source: e.source,
                    target: e.target,
                    data: e.data || { mappings: [] },
                }));
                const problems = computeProblems(nodes, edges, null);
                let errors = 0;
                let warnings = 0;
                for (const p of problems) {
                    if (p.severity === 'error') errors++;
                    else if (p.severity === 'warning') warnings++;
                }
                map.set(wf.id, { errors, warnings });
            } catch {
                // Validation should never throw, but be defensive — fall back to OK.
                map.set(wf.id, { errors: 0, warnings: 0 });
            }
        }
        return map;
    }, [workflows, cwlReady]);

    // "Open in tab" / "Editing" lookup — workspaces editing each saved entry.
    // A workspace can be bound to both a workflow and a custom node at once,
    // so we emit two map entries for it (one per binding). That way the row
    // for either saved entry can find the editing workspace.
    const workspaceByWfId = useMemo(() => {
        const map = new Map();
        for (const ws of workspaces) {
            if (ws.boundWorkflowId) map.set(ws.boundWorkflowId, ws);
            if (ws.boundCustomNodeId) map.set(ws.boundCustomNodeId, ws);
        }
        return map;
    }, [workspaces]);

    const sorted = useMemo(() => {
        // Pass an empty Map when status isn't ready so the comparator's lookups
        // don't blow up; sort by status simply produces no ranking until ready.
        const cmp = makeComparator(sort.key, sort.dir, statusByWfId || new Map());
        return [...workflows].sort(cmp);
    }, [workflows, sort, statusByWfId]);

    const toggleSort = (key) => {
        setSort((prev) => {
            if (prev.key !== key) {
                // First click on a new column: pick the most useful default direction.
                // Names ascend (A→Z); status & date prefer descending (problems/newest first).
                return { key, dir: key === SORT_KEYS.NAME ? 'asc' : 'desc' };
            }
            return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
        });
    };

    const openActionMenu = (wf, anchorEl) => {
        const rect = anchorEl.getBoundingClientRect();
        setActionMenu({
            wfId: wf.id,
            wf,
            position: {
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            },
        });
    };

    const closeActionMenu = () => setActionMenu(null);

    const dispatchAction = (action, wf) => {
        closeActionMenu();
        switch (action) {
            case 'open':
                onEditWorkflow?.(wf);
                break;
            case 'duplicate':
                onDuplicateWorkflow?.(wf.id);
                break;
            case 'cwl':
            case 'yml':
            case 'crate':
                onAccessArtifact?.(wf, action);
                break;
            case 'delete': {
                const row = document.querySelector(`[data-wf-row="${wf.id}"]`);
                const rect = row?.getBoundingClientRect() || { top: 100, right: 400, height: 40 };
                setDeleteConfirm({
                    wfId: wf.id,
                    wfName: wf.name,
                    position: {
                        top: rect.top + rect.height / 2,
                        left: rect.right + 8,
                    },
                });
                break;
            }
            default:
                break;
        }
    };

    return (
        <div className="workflow-manager-page">
            {sorted.length === 0 ? (
                <div className="wm-welcome">
                    <header className="wm-welcome-hero">
                        <h1 className="wm-welcome-title">niBuild</h1>
                        <p className="wm-welcome-tagline">Towards FAIRness in Neuroimaging</p>
                    </header>

                    {/* Future: <RecentList /> goes here when we want recents in the welcome. */}

                    <div className="wm-welcome-grid">
                        <section className="wm-welcome-col" aria-labelledby="wm-welcome-start-title">
                            <h2 id="wm-welcome-start-title" className="wm-welcome-col-title">
                                Start
                            </h2>
                            <ul className="wm-welcome-actions">
                                <li>
                                    <button
                                        type="button"
                                        className="wm-welcome-action"
                                        onClick={() => onNewWorkflow?.()}
                                    >
                                        <svg
                                            className="wm-welcome-action-icon"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <line x1="12" y1="5" x2="12" y2="19" />
                                            <line x1="5" y1="12" x2="19" y2="12" />
                                        </svg>
                                        <span className="wm-welcome-action-text">
                                            <span className="wm-welcome-action-label">New Workflow</span>
                                            <span className="wm-welcome-action-sub">
                                                Create a custom workflow from scratch
                                            </span>
                                        </span>
                                    </button>
                                </li>
                                <li>
                                    <button
                                        type="button"
                                        className="wm-welcome-action"
                                        onClick={() => onImportWorkflow?.()}
                                    >
                                        <svg
                                            className="wm-welcome-action-icon"
                                            width="18"
                                            height="18"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                            <polyline points="17 8 12 3 7 8" />
                                            <line x1="12" y1="3" x2="12" y2="15" />
                                        </svg>
                                        <span className="wm-welcome-action-text">
                                            <span className="wm-welcome-action-label">Import CWL</span>
                                            <span className="wm-welcome-action-sub">Load a prebuilt CWL workflow</span>
                                        </span>
                                    </button>
                                </li>
                            </ul>
                        </section>

                        <section className="wm-welcome-col" aria-labelledby="wm-welcome-resources-title">
                            <h2 id="wm-welcome-resources-title" className="wm-welcome-col-title">
                                Help &amp; Resources
                            </h2>
                            <ul className="wm-welcome-cards">
                                <li>
                                    <a
                                        className="wm-welcome-card"
                                        href="https://kunaalagarwal.github.io/niBuild-auxiliary/"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <svg
                                            className="wm-welcome-card-icon"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22.5z" />
                                            <path d="M4 4.5v15A2.5 2.5 0 0 1 6.5 17H20" />
                                        </svg>
                                        <div className="wm-welcome-card-body">
                                            <div className="wm-welcome-card-title">Documentation</div>
                                            <div className="wm-welcome-card-desc">
                                                Tutorials, node reference, and BIDS guides
                                            </div>
                                        </div>
                                    </a>
                                </li>
                                <li>
                                    <a
                                        className="wm-welcome-card"
                                        href="https://github.com/KunaalAgarwal/niBuild"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <svg
                                            className="wm-welcome-card-icon"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.47.11-3.07 0 0 .97-.31 3.19 1.19a11.1 11.1 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.21-1.5 3.18-1.19 3.18-1.19.63 1.6.23 2.78.12 3.07.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.41-5.27 5.69.41.36.78 1.07.78 2.16v3.2c0 .31.21.68.8.56C20.21 21.38 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                                        </svg>
                                        <div className="wm-welcome-card-body">
                                            <div className="wm-welcome-card-title">GitHub Repository</div>
                                            <div className="wm-welcome-card-desc">Browse the source and contribute</div>
                                        </div>
                                    </a>
                                </li>
                                <li>
                                    <a
                                        className="wm-welcome-card"
                                        href="https://github.com/KunaalAgarwal/niBuild/issues"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <svg
                                            className="wm-welcome-card-icon"
                                            width="20"
                                            height="20"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="1.75"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                        >
                                            <circle cx="12" cy="12" r="10" />
                                            <line x1="12" y1="8" x2="12" y2="12" />
                                            <line x1="12" y1="16" x2="12.01" y2="16" />
                                        </svg>
                                        <div className="wm-welcome-card-body">
                                            <div className="wm-welcome-card-title">Report an Issue</div>
                                            <div className="wm-welcome-card-desc">
                                                Found a bug or have a feature request?
                                            </div>
                                        </div>
                                    </a>
                                </li>
                            </ul>
                        </section>
                    </div>
                </div>
            ) : (
                <>
                    {/* Single header bar — section title left, creation actions right. */}
                    <div className="wm-section-bar">
                        <span className="wm-section-title">Your workflows</span>
                        <div className="wm-toolbar" role="toolbar" aria-label="Workflow manager actions">
                            <button
                                type="button"
                                className="wm-toolbar-btn wm-toolbar-btn-primary"
                                onClick={() => onNewWorkflow?.()}
                                title="Create a new empty workflow"
                            >
                                <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                >
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                <span>New Workflow</span>
                            </button>
                            <button
                                type="button"
                                className="wm-toolbar-btn"
                                onClick={() => onImportWorkflow?.()}
                                title="Import a workflow from a CWL or YAML file"
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
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                                <span>Import CWL</span>
                            </button>
                        </div>
                    </div>

                    <div className="wm-table" role="table" aria-label="Saved workflows">
                        <div className="wm-thead" role="row">
                            <button
                                type="button"
                                className={`wm-th wm-th-sortable${sort.key === SORT_KEYS.NAME ? ' wm-th-active' : ''}`}
                                onClick={() => toggleSort(SORT_KEYS.NAME)}
                                aria-sort={
                                    sort.key === SORT_KEYS.NAME
                                        ? sort.dir === 'asc'
                                            ? 'ascending'
                                            : 'descending'
                                        : 'none'
                                }
                            >
                                <span>Name</span>
                                <SortChevron active={sort.key === SORT_KEYS.NAME} dir={sort.dir} />
                            </button>
                            <button
                                type="button"
                                className={`wm-th wm-th-sortable${sort.key === SORT_KEYS.STATUS ? ' wm-th-active' : ''}`}
                                onClick={() => toggleSort(SORT_KEYS.STATUS)}
                                aria-sort={
                                    sort.key === SORT_KEYS.STATUS
                                        ? sort.dir === 'asc'
                                            ? 'ascending'
                                            : 'descending'
                                        : 'none'
                                }
                            >
                                <span>Status</span>
                                <SortChevron active={sort.key === SORT_KEYS.STATUS} dir={sort.dir} />
                            </button>
                            <div className="wm-th wm-th-notes">Notes</div>
                            <div className="wm-th wm-th-actions">Operations</div>
                        </div>

                        <ul className="wm-list">
                            {sorted.map((wf) => {
                                const toolCount = (wf.nodes || []).filter((n) => !n.isDummy && !n.data?.isDummy).length;
                                // statusByWfId is null until tool registry preloads;
                                // status remains undefined → StatusPill renders nothing.
                                const status = statusByWfId?.get(wf.id);
                                const openWs = workspaceByWfId.get(wf.id);
                                // "Editing" if the open workspace has actual unsaved changes
                                // relative to the saved workflow — otherwise just "Open".
                                const isEditing = openWs ? hasUnsavedChanges(openWs, wf) : false;
                                return (
                                    <li key={wf.id} className="wm-row" data-wf-row={wf.id} role="row">
                                        {/* Name cell */}
                                        <div className="wm-cell wm-cell-name">
                                            <div className="wm-row-name-line">
                                                <span className="wm-row-name" title={wf.name}>
                                                    {wf.name}
                                                </span>
                                                {openWs && (
                                                    <span
                                                        className={`wm-open-chip${
                                                            isEditing ? ' wm-open-chip-editing' : ''
                                                        }`}
                                                        title="This workflow is open in another tab"
                                                    >
                                                        {isEditing ? 'Editing' : 'Open'}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="wm-row-meta">
                                                {toolCount} {toolCount === 1 ? 'tool' : 'tools'}
                                                {' · '}
                                                Updated {formatRelative(wf.updatedAt || wf.createdAt)}
                                                {wf.lastOpenedAt ? (
                                                    <>
                                                        {' · '}
                                                        Opened {formatRelative(wf.lastOpenedAt)}
                                                    </>
                                                ) : null}
                                            </span>
                                        </div>

                                        {/* Status cell */}
                                        <div className="wm-cell wm-cell-status">
                                            <StatusPill status={status} />
                                        </div>

                                        {/* Notes cell — inline auto-growing textarea */}
                                        <div className="wm-cell wm-cell-notes">
                                            <NotesInput
                                                wfId={wf.id}
                                                initialNotes={wf.notes || ''}
                                                onSave={onUpdateNotes}
                                            />
                                        </div>

                                        {/* Operations cell — Open + "..." overflow */}
                                        <div className="wm-cell wm-cell-actions">
                                            <button
                                                type="button"
                                                className="wm-action-btn wm-action-open"
                                                onClick={() => onEditWorkflow?.(wf)}
                                                title="Open in workspace"
                                            >
                                                Open
                                            </button>
                                            <button
                                                type="button"
                                                className="wm-action-btn wm-action-more"
                                                title="More actions"
                                                aria-label="More actions"
                                                aria-haspopup="menu"
                                                aria-expanded={actionMenu?.wfId === wf.id}
                                                onClick={(e) => openActionMenu(wf, e.currentTarget)}
                                            >
                                                <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="currentColor"
                                                    aria-hidden="true"
                                                >
                                                    <circle cx="5" cy="12" r="1.75" />
                                                    <circle cx="12" cy="12" r="1.75" />
                                                    <circle cx="19" cy="12" r="1.75" />
                                                </svg>
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                        <div className="wm-table-footer">
                            <span className="wm-section-count">
                                {sorted.length} {sorted.length === 1 ? 'workflow' : 'workflows'}
                            </span>
                        </div>
                    </div>
                </>
            )}

            {/* Per-row "..." action menu (portal) */}
            {actionMenu &&
                createPortal(
                    <div
                        ref={actionMenuRef}
                        className="wm-action-menu"
                        role="menu"
                        style={{ top: actionMenu.position.top, right: actionMenu.position.right }}
                    >
                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            onClick={() => dispatchAction('open', actionMenu.wf)}
                        >
                            Open
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            disabled
                            title="Coming soon — workflow execution is not yet implemented"
                        >
                            Run
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            onClick={() => dispatchAction('duplicate', actionMenu.wf)}
                        >
                            Duplicate
                        </button>

                        <div className="wm-action-menu-divider" role="separator" />

                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            onClick={() => dispatchAction('cwl', actionMenu.wf)}
                        >
                            Access CWL
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            onClick={() => dispatchAction('yml', actionMenu.wf)}
                        >
                            Access job YML
                        </button>
                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item"
                            onClick={() => dispatchAction('crate', actionMenu.wf)}
                        >
                            Access ro-crate (.crate.zip)
                        </button>

                        <div className="wm-action-menu-divider" role="separator" />

                        <button
                            type="button"
                            role="menuitem"
                            className="wm-action-menu-item wm-action-menu-danger"
                            onClick={() => dispatchAction('delete', actionMenu.wf)}
                        >
                            Delete
                        </button>
                    </div>,
                    document.body,
                )}

            {/* Delete confirmation portal */}
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
