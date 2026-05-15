import { useMemo, useState } from 'react';
import { computeWorkflowDiff, hasUnsavedChanges } from '../utils/workflowDiff.js';
import '../styles/sidebarStagedChanges.css';

/**
 * Renders the staged-changes diff inside the left sidebar. This is the
 * sidebar-tab equivalent of what used to be the WorkflowComparisonModal:
 * structured diff between the workspace's current state and the saved
 * workflow/custom-node it is bound to.
 *
 * The component is rendered by IDELayout when the sidebar's `staged` tab is
 * active. Visibility/disable state of that tab is gated on the same hooks the
 * TopBar's Staged Changes button uses, so if we got here there's a bound entry
 * with at least one change.
 *
 * Layout is intentionally column-stacked (saved on top, current below, gold
 * diff arrow between) because the sidebar is much narrower than the old XL
 * modal. Section cards collapse by default to keep the panel scannable; the
 * first non-empty section auto-expands.
 */

/* ── Tiny presentational primitives ──────────────────────────── */

function DiffSection({ title, badgeCounts, defaultExpanded, children }) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const total = (badgeCounts.added || 0) + (badgeCounts.removed || 0) + (badgeCounts.modified || 0);

    return (
        <div className="sc-section">
            <div className="sc-section-header" onClick={() => setExpanded((e) => !e)}>
                <span className={`sc-chevron${expanded ? ' expanded' : ''}`}>&#9654;</span>
                <span className="sc-section-title">{title}</span>
                {badgeCounts.added > 0 && <span className="sc-badge added">+{badgeCounts.added}</span>}
                {badgeCounts.removed > 0 && <span className="sc-badge removed">-{badgeCounts.removed}</span>}
                {badgeCounts.modified > 0 && <span className="sc-badge modified">~{badgeCounts.modified}</span>}
                {total === 0 && <span className="sc-section-empty">No changes</span>}
            </div>
            {expanded && total > 0 && <div className="sc-section-body">{children}</div>}
        </div>
    );
}

function ValueStack({ saved, current }) {
    return (
        <div className="sc-value-stack">
            <span className={`sc-value-saved${saved == null ? ' sc-value-empty' : ''}`}>{saved ?? '(none)'}</span>
            <span className="sc-value-arrow">&#8595;</span>
            <span className={`sc-value-current${current == null ? ' sc-value-empty' : ''}`}>{current ?? '(none)'}</span>
        </div>
    );
}

function SubChanges({ subChanges }) {
    if (!subChanges || subChanges.length === 0) return null;
    return (
        <div className="sc-sub-changes">
            {subChanges.map((sc) => (
                <div key={sc.key} className="sc-sub-change">
                    <span className="sc-sub-key">{sc.key}</span>
                    {sc.type === 'added' ? (
                        <>
                            <span className="sc-value-arrow">+</span>
                            <span className="sc-sub-value-current">{sc.current}</span>
                        </>
                    ) : sc.type === 'removed' ? (
                        <>
                            <span className="sc-value-arrow">-</span>
                            <span className="sc-sub-value-saved">{sc.saved}</span>
                        </>
                    ) : (
                        <>
                            <span className="sc-sub-value-saved">{sc.saved}</span>
                            <span className="sc-value-arrow">&#8595;</span>
                            <span className="sc-sub-value-current">{sc.current}</span>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}

/* ── Value formatting (shared with the old modal) ────────────── */

const SCATTER_METHOD_LABELS = {
    dotproduct: 'Dot Product',
    flat_crossproduct: 'Flat Cross Product',
    nested_crossproduct: 'Nested Cross Product',
};

const MERGE_METHOD_LABELS = {
    merge_flattened: 'Merge Flattened',
    merge_nested: 'Merge Nested',
};

function formatScatterMethod(m) {
    return m ? SCATTER_METHOD_LABELS[m] || m : null;
}

function formatMergeMethod(m) {
    return MERGE_METHOD_LABELS[m] || m;
}

function formatSimpleValue(key, value) {
    if (value === undefined || value === null) return null;
    if (key === 'scatterInputs') {
        if (!Array.isArray(value) || value.length === 0) return null;
        return value.join(', ');
    }
    if (key === 'scatterMethod') return formatScatterMethod(value);
    if (typeof value === 'string' && value.trim() === '') return null;
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function objectToSubChanges(value, changeType, propKey) {
    if (!value || typeof value !== 'object') return [];
    const entries = Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== '');
    const isLinkMerge = propKey === 'linkMergeOverrides';
    return entries.map(([k, v]) => {
        const formatted = isLinkMerge ? formatMergeMethod(v) : typeof v === 'object' ? JSON.stringify(v) : String(v);
        return {
            key: k,
            ...(changeType === 'added' ? { current: formatted } : { saved: formatted }),
            type: changeType,
        };
    });
}

const IO_DISPLAY_PROPS = [{ key: 'notes', label: 'Notes' }];
const BIDS_DISPLAY_PROPS = [
    { key: 'notes', label: 'Notes' },
    { key: 'bidsSelections', label: 'BIDS Selections', isObject: true },
];
const OPERATIONAL_DISPLAY_PROPS = [
    { key: 'dockerVersion', label: 'Docker Version' },
    { key: 'parameters', label: 'Parameters', isObject: true },
    { key: 'whenExpression', label: 'Conditional' },
    { key: 'expressions', label: 'Expressions', isObject: true },
    { key: 'scatterInputs', label: 'Scatter' },
    { key: 'scatterMethod', label: 'Scatter Method' },
    { key: 'linkMergeOverrides', label: 'Multiple Input', isObject: true },
    { key: 'operationOrder', label: 'Operation Order' },
    { key: 'notes', label: 'Notes' },
];

function getDisplayProps(node) {
    if (node.isBIDS) return BIDS_DISPLAY_PROPS;
    if (node.isDummy) return IO_DISPLAY_PROPS;
    return OPERATIONAL_DISPLAY_PROPS;
}

function getNodeTypeLabel(node) {
    if (node.isBIDS) return 'BIDS Node';
    if (node.isDummy) return 'I/O Node';
    return null;
}

/* ── Card renderers ──────────────────────────────────────────── */

function NodeCard({ node, type }) {
    const cardClass = `sc-card sc-card-${type}`;
    const typeLabel = getNodeTypeLabel(node);

    if (type === 'added' || type === 'removed') {
        const props = [];
        for (const { key, label, isObject } of getDisplayProps(node)) {
            if (isObject) {
                const subs = objectToSubChanges(node[key], type === 'added' ? 'added' : 'removed', key);
                if (subs.length > 0) props.push({ displayName: label, subChanges: subs });
            } else {
                const formatted = formatSimpleValue(key, node[key]);
                if (formatted) props.push({ displayName: label, value: formatted });
            }
        }
        return (
            <div className={cardClass}>
                <div className="sc-card-title">{node.label}</div>
                {typeLabel && <div className="sc-card-summary">{typeLabel}</div>}
                {props.length > 0 && (
                    <div className="sc-prop-list">
                        {props.map((p) => (
                            <div key={p.displayName} className="sc-prop-row">
                                <span className="sc-prop-label">{p.displayName}</span>
                                {p.subChanges ? (
                                    <SubChanges subChanges={p.subChanges} />
                                ) : (
                                    <span className={type === 'added' ? 'sc-value-current' : 'sc-value-saved'}>
                                        {p.value}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    const modifiedLabel =
        node.savedLabel !== node.label ? (
            <>
                {node.savedLabel} <span className="sc-value-arrow">&#8594;</span> {node.label}
            </>
        ) : (
            node.label
        );

    return (
        <div className={cardClass}>
            <div className="sc-card-title">{modifiedLabel}</div>
            {typeLabel && <div className="sc-card-summary">{typeLabel}</div>}
            <div className="sc-prop-list">
                {node.changes.map((change) => (
                    <div key={change.property} className="sc-prop-row">
                        <span className="sc-prop-label">{change.displayName}</span>
                        {change.subChanges ? (
                            <SubChanges subChanges={change.subChanges} />
                        ) : (
                            <ValueStack saved={change.saved} current={change.current} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

function EdgeCard({ edge, type }) {
    const cardClass = `sc-card sc-card-${type}`;
    const title = `${edge.sourceLabel} → ${edge.targetLabel}`;

    if (type === 'added' || type === 'removed') {
        const mappings = edge.data?.mappings || [];
        return (
            <div className={cardClass}>
                <div className="sc-card-title">{title}</div>
                {mappings.length > 0 && (
                    <div className="sc-mapping-list">
                        {mappings.map((m, i) => (
                            <div key={i} className="sc-mapping-item">
                                {m.sourceOutput} → {m.targetInput}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={cardClass}>
            <div className="sc-card-title">{title}</div>
            <div className="sc-prop-list">
                {edge.changes.map((change, i) => (
                    <div key={i} className="sc-prop-row">
                        <span className="sc-prop-label">{change.property}</span>
                        {change.property === 'mappings' ? (
                            <div className="sc-mapping-diff">
                                <span className="sc-value-saved">
                                    {(change.saved || [])
                                        .map((m) => `${m.sourceOutput} → ${m.targetInput}`)
                                        .join(', ') || '(none)'}
                                </span>
                                <span className="sc-value-arrow">&#8595;</span>
                                <span className="sc-value-current">
                                    {(change.current || [])
                                        .map((m) => `${m.sourceOutput} → ${m.targetInput}`)
                                        .join(', ') || '(none)'}
                                </span>
                            </div>
                        ) : (
                            <ValueStack saved={change.saved} current={change.current} />
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ── Per-binding diff section ─────────────────────────────────── */

// Render one binding's diff: header (kind label + name) plus Update + Revert
// buttons, then the diff body. Stays self-contained so the multi-binding
// container can stack two of these without entangled state.
function BindingDiff({ workspace, savedWorkflow, kind, onUpdate, onRevert }) {
    const diffData = useMemo(() => {
        if (!workspace || !savedWorkflow) return null;
        if (!hasUnsavedChanges(workspace, savedWorkflow)) return null;
        return computeWorkflowDiff(savedWorkflow, workspace);
    }, [workspace, savedWorkflow]);

    if (!diffData || !diffData.hasDifferences) return null;

    const nodeTotal = diffData.nodes.added.length + diffData.nodes.removed.length + diffData.nodes.modified.length;
    const edgeTotal = diffData.edges.added.length + diffData.edges.removed.length + diffData.edges.modified.length;

    const kindLabel = kind === 'workflow' ? 'Workflow' : 'Custom Node';
    const updateBtnClass =
        kind === 'workflow' ? 'sc-action-btn sc-action-update-workflow' : 'sc-action-btn sc-action-update-custom';

    return (
        <div className="sc-binding">
            <div className="sc-binding-header">
                <div className="sc-binding-titles">
                    <div className={`sc-binding-eyebrow sc-binding-eyebrow-${kind}`}>{kindLabel}</div>
                    <div className="sc-binding-name" title={savedWorkflow.name}>
                        {savedWorkflow.name}
                    </div>
                </div>
                <div className="sc-binding-actions">
                    <button className={updateBtnClass} onClick={onUpdate} title={`Update ${kindLabel}`}>
                        Update {kindLabel}
                    </button>
                    <button
                        className="sc-action-btn sc-action-revert"
                        onClick={onRevert}
                        title={`Revert workspace to last saved ${kindLabel.toLowerCase()}`}
                    >
                        Revert
                    </button>
                </div>
            </div>

            <div className="sc-binding-body">
                {diffData.metadata.length > 0 && (
                    <DiffSection
                        title="Metadata"
                        badgeCounts={{ added: 0, removed: 0, modified: diffData.metadata.length }}
                        defaultExpanded={true}
                    >
                        {diffData.metadata.map((m) => (
                            <div key={m.field} className="sc-metadata-row">
                                <span className="sc-metadata-field">{m.field}</span>
                                <ValueStack saved={m.saved || '(empty)'} current={m.current || '(empty)'} />
                            </div>
                        ))}
                    </DiffSection>
                )}

                <DiffSection
                    title="Nodes"
                    badgeCounts={{
                        added: diffData.nodes.added.length,
                        removed: diffData.nodes.removed.length,
                        modified: diffData.nodes.modified.length,
                    }}
                    defaultExpanded={nodeTotal > 0}
                >
                    {diffData.nodes.added.length > 0 && (
                        <>
                            <div className="sc-subheader added">Added ({diffData.nodes.added.length})</div>
                            {diffData.nodes.added.map((n) => (
                                <NodeCard key={n.id} node={n} type="added" />
                            ))}
                        </>
                    )}
                    {diffData.nodes.removed.length > 0 && (
                        <>
                            <div className="sc-subheader removed">Removed ({diffData.nodes.removed.length})</div>
                            {diffData.nodes.removed.map((n) => (
                                <NodeCard key={n.id} node={n} type="removed" />
                            ))}
                        </>
                    )}
                    {diffData.nodes.modified.length > 0 && (
                        <>
                            <div className="sc-subheader modified">Modified ({diffData.nodes.modified.length})</div>
                            {diffData.nodes.modified.map((n) => (
                                <NodeCard key={n.id} node={n} type="modified" />
                            ))}
                        </>
                    )}
                </DiffSection>

                <DiffSection
                    title="Edges"
                    badgeCounts={{
                        added: diffData.edges.added.length,
                        removed: diffData.edges.removed.length,
                        modified: diffData.edges.modified.length,
                    }}
                    defaultExpanded={edgeTotal > 0}
                >
                    {diffData.edges.added.length > 0 && (
                        <>
                            <div className="sc-subheader added">Added ({diffData.edges.added.length})</div>
                            {diffData.edges.added.map((e) => (
                                <EdgeCard key={e.id} edge={e} type="added" />
                            ))}
                        </>
                    )}
                    {diffData.edges.removed.length > 0 && (
                        <>
                            <div className="sc-subheader removed">Removed ({diffData.edges.removed.length})</div>
                            {diffData.edges.removed.map((e) => (
                                <EdgeCard key={e.id} edge={e} type="removed" />
                            ))}
                        </>
                    )}
                    {diffData.edges.modified.length > 0 && (
                        <>
                            <div className="sc-subheader modified">Modified ({diffData.edges.modified.length})</div>
                            {diffData.edges.modified.map((e) => (
                                <EdgeCard key={e.id} edge={e} type="modified" />
                            ))}
                        </>
                    )}
                </DiffSection>
            </div>
        </div>
    );
}

/* ── Top-level panel ─────────────────────────────────────────── */

function SidebarStagedChangesContent({
    workspace,
    boundWorkflow,
    boundCustomNode,
    onUpdateWorkflow,
    onUpdateCustomNode,
    onRevertToBinding,
}) {
    // Either binding may be null (passed only when it has diffs to show).
    // If both are null we render an empty-state placeholder; the sidebar tab
    // is normally disabled in that case but this is the defensive fallback.
    const hasAny = !!boundWorkflow || !!boundCustomNode;

    if (!workspace || !hasAny) {
        return (
            <div className="sc-panel sc-panel-empty">
                <p className="sc-empty-msg">No staged changes to review.</p>
                <p className="sc-empty-hint">
                    Bind this workspace to a saved workflow or custom node, then edit to see a diff here.
                </p>
            </div>
        );
    }

    return (
        <div className="sc-panel">
            <div className="sc-panel-body">
                {boundWorkflow && (
                    <BindingDiff
                        workspace={workspace}
                        savedWorkflow={boundWorkflow}
                        kind="workflow"
                        onUpdate={onUpdateWorkflow}
                        onRevert={() => onRevertToBinding?.('workflow')}
                    />
                )}
                {boundCustomNode && (
                    <BindingDiff
                        workspace={workspace}
                        savedWorkflow={boundCustomNode}
                        kind="custom-node"
                        onUpdate={onUpdateCustomNode}
                        onRevert={() => onRevertToBinding?.('custom-node')}
                    />
                )}
            </div>
        </div>
    );
}

export default SidebarStagedChangesContent;
