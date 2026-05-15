import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WorkflowMenuItem from './workflowMenuItem';
import ModalityTooltip from './modalityTooltip';
import {
    toolsByModality,
    modalityOrder,
    modalityDescriptions,
    libraryOrder,
    dummyNodes,
} from '../utils/toolAnnotations';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import '../styles/workflowMenu.css';

// VS Code–style chevron: points right when collapsed, rotates 90° when expanded.
function Chevron({ expanded }) {
    return (
        <span className={`chevron${expanded ? ' chevron-expanded' : ''}`} aria-hidden="true">
            <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <polyline points="6 4 10 8 6 12" />
            </svg>
        </span>
    );
}

function WorkflowMenu({ onEditWorkflow, onDeleteWorkflow }) {
    // `workflows` (kind='workflow') and `customNodes` (kind='custom-node') are
    // per-kind views of `customWorkflows` — the single hook still owns storage.
    const { customWorkflows, workflows, customNodes, updateWorkflow } = useCustomWorkflowsContext();

    // Collapse is handled by the panel system (react-resizable-panels)

    const [expandedSections, setExpandedSections] = useState(() => {
        const initial = { DummyNodes: false, MyWorkflows: false, CustomNodes: false };
        modalityOrder.forEach((m) => {
            initial[m] = false;
        });
        return initial;
    });

    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null); // { wfId, wfName, position: { top, left } }
    const [renamingId, setRenamingId] = useState(null);
    const deleteConfirmRef = useRef(null);
    const searchInputRef = useRef(null);

    const commitRename = useCallback(
        (id, newName) => {
            const trimmed = newName.trim();
            if (trimmed) {
                updateWorkflow(id, { name: trimmed });
            }
            setRenamingId(null);
        },
        [updateWorkflow],
    );

    const cancelRename = useCallback(() => {
        setRenamingId(null);
    }, []);

    // Click-outside handler to dismiss delete confirmation portal
    useEffect(() => {
        if (!deleteConfirm) return;
        const handleClickOutside = (e) => {
            if (deleteConfirmRef.current && !deleteConfirmRef.current.contains(e.target)) {
                setDeleteConfirm(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [deleteConfirm]);

    const toggleSection = useCallback((key) => {
        setExpandedSections((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    }, []);

    const handleDragStart = useCallback((event, name, isDummy = false) => {
        event.dataTransfer.setData('node/name', name);
        event.dataTransfer.setData('node/isDummy', isDummy.toString());
        // Pass isBIDS flag for BIDS nodes
        const dummyDef = dummyNodes['I/O']?.find((d) => d.name === name);
        if (dummyDef?.isBIDS) {
            event.dataTransfer.setData('node/isBIDS', 'true');
        }
        if (dummyDef?.isOutputNode) {
            event.dataTransfer.setData('node/isOutputNode', 'true');
        }
        if (dummyDef?.isStandardTemplate) {
            event.dataTransfer.setData('node/isStandardTemplate', 'true');
        }
    }, []);

    // Workflow row (kind='workflow') → drop expands into all the saved nodes+edges.
    const handleWorkflowDragStart = useCallback((event, workflow) => {
        event.dataTransfer.setData('node/name', workflow.name);
        event.dataTransfer.setData('node/isDummy', 'false');
        event.dataTransfer.setData('node/savedWorkflowId', workflow.id);
        event.dataTransfer.setData('node/expand', 'true');
    }, []);

    // Custom-node row (kind='custom-node') → drop inserts a single composite
    // node. Existing `node/customWorkflowId` protocol is preserved so the
    // canvas drop handler (`buildNodeOverrides`) doesn't need to change.
    const handleCustomNodeDragStart = useCallback((event, workflow) => {
        event.dataTransfer.setData('node/name', workflow.name);
        event.dataTransfer.setData('node/isDummy', 'false');
        event.dataTransfer.setData('node/customWorkflowId', workflow.id);
    }, []);

    // Count total tools across all libraries/categories in a modality
    const getModalityToolCount = (modality) => {
        const modalityData = toolsByModality[modality];
        if (!modalityData) return 0;
        let count = 0;
        for (const libraries of Object.values(modalityData)) {
            for (const tools of Object.values(libraries)) {
                count += tools.length;
            }
        }
        return count;
    };

    // Count tools in a specific library within a modality
    const getLibraryToolCount = (modalityData, library) => {
        const libraryData = modalityData[library];
        if (!libraryData) return 0;
        return Object.values(libraryData).reduce((sum, tools) => sum + tools.length, 0);
    };

    // Search/filter logic
    const filteredResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return null;

        let modalityFilter = null;
        let toolQuery = query;

        if (query.includes('/')) {
            const slashIdx = query.indexOf('/');
            modalityFilter = query.slice(0, slashIdx).trim();
            toolQuery = query.slice(slashIdx + 1).trim();
        }

        const results = [];

        for (const modality of modalityOrder) {
            const modalityLower = modality.toLowerCase();
            const modalityData = toolsByModality[modality];
            if (!modalityData) continue;

            // If modality filter from "modality/" syntax, skip non-matching modalities
            if (modalityFilter && !modalityLower.includes(modalityFilter)) continue;

            for (const [library, categories] of Object.entries(modalityData)) {
                for (const [category, tools] of Object.entries(categories)) {
                    for (const tool of tools) {
                        // With modality filter but no tool query, show all tools in that modality
                        if (modalityFilter && !toolQuery) {
                            results.push({ modality, library, category, tool });
                            continue;
                        }

                        const searchTerm = toolQuery || query;
                        const matchFields = [tool.name, tool.fullName || '', tool.function || '', modality];

                        if (matchFields.some((f) => f.toLowerCase().includes(searchTerm))) {
                            results.push({ modality, library, category, tool });
                        }
                    }
                }
            }
        }

        // Also search I/O (dummy) nodes
        if (!modalityFilter || 'i/o'.includes(modalityFilter)) {
            for (const tool of dummyNodes['I/O']) {
                const searchTerm = toolQuery || query;
                const matchFields = [tool.name, tool.fullName || '', tool.function || '', 'I/O'];
                if (matchFields.some((f) => f.toLowerCase().includes(searchTerm))) {
                    results.push({
                        modality: 'I/O',
                        library: 'I/O',
                        category: 'I/O',
                        tool,
                        isDummyNode: true,
                    });
                }
            }
        }

        // Also search saved entries — group by kind so the search-result
        // headers mirror the menu's section split (My Workflows / Custom Nodes).
        for (const wf of customWorkflows) {
            const nonDummyTools = wf.nodes.filter((n) => !n.isDummy).map((n) => n.label);
            const matchFields = [wf.name, ...nonDummyTools];
            const searchTerm = toolQuery || query;
            if (matchFields.some((f) => f.toLowerCase().includes(searchTerm))) {
                const isWorkflowKind = (wf.kind || 'custom-node') === 'workflow';
                const descriptor = isWorkflowKind ? 'Workflow' : 'Custom node';
                results.push({
                    modality: isWorkflowKind ? 'My Workflows' : 'Custom Nodes',
                    library: 'Custom',
                    category: 'Custom',
                    tool: {
                        name: wf.name,
                        fullName: wf.name,
                        function: `${descriptor} with ${nonDummyTools.length} tools: ${nonDummyTools.join(', ')}`,
                        typicalUse: `Tools: ${nonDummyTools.join(', ')}`,
                    },
                    isSavedEntry: true,
                    customWorkflow: wf,
                });
            }
        }

        return results;
    }, [searchQuery, customWorkflows]);

    const clearSearch = () => {
        setSearchQuery('');
        searchInputRef.current?.focus();
    };

    // One row of the My Workflows / Custom Nodes lists. Both sections share
    // every visible affordance — rename, drag, open, delete — so we factor the
    // ~120-line row JSX out and pass in just the drag handler. `kind` shapes
    // the tooltip copy and aria labels so screen readers and hover text reflect
    // the section the user is in.
    const renderSavedEntryRow = (wf, onDragStart, kind) => {
        const nonDummyTools = wf.nodes.filter((n) => !n.isDummy).map((n) => n.label);
        const isWorkflowKind = kind === 'workflow';
        const noun = isWorkflowKind ? 'workflow' : 'custom node';
        const descriptor = isWorkflowKind ? 'Workflow' : 'Custom node';

        // Inline rename mode (F2 / pencil click / double-click on row)
        if (renamingId === wf.id) {
            return (
                <div key={wf.id} className="custom-workflow-row custom-workflow-row-renaming">
                    <input
                        type="text"
                        className="custom-workflow-rename-input"
                        autoFocus
                        defaultValue={wf.name}
                        onFocus={(e) => e.currentTarget.select()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                commitRename(wf.id, e.currentTarget.value);
                            } else if (e.key === 'Escape') {
                                cancelRename();
                            }
                        }}
                        onBlur={(e) => commitRename(wf.id, e.target.value)}
                    />
                </div>
            );
        }

        return (
            <div
                key={wf.id}
                className="custom-workflow-row"
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(wf.id);
                }}
            >
                <WorkflowMenuItem
                    name={wf.name}
                    toolInfo={{
                        fullName: wf.name,
                        function: `${descriptor} with ${nonDummyTools.length} tools`,
                        typicalUse: `Tools: ${nonDummyTools.join(', ')}`,
                    }}
                    onDragStart={(event) => onDragStart(event, wf)}
                    warningIcon={wf.hasValidationWarnings}
                />
                <div className="custom-workflow-actions">
                    {/* Rename — pencil icon */}
                    <button
                        type="button"
                        className="custom-workflow-action-btn rename-btn"
                        title={`Rename ${noun}`}
                        aria-label={`Rename ${noun}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(wf.id);
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
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </button>
                    {/* Open in new workspace — external-link icon */}
                    <button
                        type="button"
                        className="custom-workflow-action-btn open-btn"
                        title="Open in new workspace"
                        aria-label={`Open ${noun} in new workspace`}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onEditWorkflow) onEditWorkflow(wf);
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
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                    </button>
                    {/* Delete — X icon */}
                    <button
                        type="button"
                        className="custom-workflow-action-btn delete-btn"
                        title={`Delete ${noun}`}
                        aria-label={`Delete ${noun}`}
                        onClick={(e) => {
                            e.stopPropagation();
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
            </div>
        );
    };

    // Group search results by modality for display
    const renderSearchResults = () => {
        if (filteredResults.length === 0) {
            return <div className="workflow-search-empty">No tools match &ldquo;{searchQuery.trim()}&rdquo;</div>;
        }

        const grouped = {};
        for (const result of filteredResults) {
            if (!grouped[result.modality]) grouped[result.modality] = [];
            grouped[result.modality].push(result);
        }

        return Object.entries(grouped).map(([modality, results]) => (
            <div key={modality} className="search-result-group">
                <div className="search-result-modality">{modality}</div>
                <div className="subsection-tools">
                    {results.map((r, idx) => (
                        <WorkflowMenuItem
                            key={`search-${r.tool.name}-${idx}`}
                            name={r.tool.name}
                            toolInfo={{
                                fullName: r.tool.fullName,
                                function: r.tool.function,
                                modality: r.tool.modality,
                                keyParameters: r.tool.keyParameters,
                                keyPoints: r.tool.keyPoints,
                                typicalUse: r.tool.typicalUse,
                                docUrl: r.tool.docUrl,
                            }}
                            onDragStart={
                                r.isSavedEntry
                                    ? (event) =>
                                          (r.customWorkflow.kind || 'custom-node') === 'workflow'
                                              ? handleWorkflowDragStart(event, r.customWorkflow)
                                              : handleCustomNodeDragStart(event, r.customWorkflow)
                                    : r.isDummyNode
                                      ? (event, name) => handleDragStart(event, name, true)
                                      : handleDragStart
                            }
                            warningIcon={r.isSavedEntry && r.customWorkflow.hasValidationWarnings}
                        />
                    ))}
                </div>
            </div>
        ));
    };

    return (
        <div className="workflow-menu-container">
            <>
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
                                        if (onDeleteWorkflow) onDeleteWorkflow(deleteConfirm.wfId);
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

                <div className="workflow-search">
                    <div className="workflow-search-wrapper">
                        <svg
                            className="workflow-search-icon"
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
                            <circle cx="11" cy="11" r="7" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="workflow-search-input"
                            placeholder="Search tools"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') clearSearch();
                            }}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="workflow-search-clear"
                                onClick={clearSearch}
                                aria-label="Clear search"
                            >
                                <svg
                                    width="12"
                                    height="12"
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
                        )}
                    </div>
                </div>

                <div className="workflow-menu">
                    {filteredResults ? (
                        renderSearchResults()
                    ) : (
                        <>
                            {/* My Workflows (kind='workflow') — drop expands the saved entry. */}
                            {workflows.length > 0 && (
                                <div className="library-section my-workflows-section">
                                    <div
                                        className="library-header my-workflows-header"
                                        onClick={() => toggleSection('MyWorkflows')}
                                    >
                                        <Chevron expanded={expandedSections['MyWorkflows']} />
                                        <span className="library-name">My Workflows</span>
                                        <span className="tool-count">{workflows.length}</span>
                                    </div>

                                    {expandedSections['MyWorkflows'] && (
                                        <div className="library-tools">
                                            <div className="subsection-tools">
                                                {workflows.map((wf) =>
                                                    renderSavedEntryRow(wf, handleWorkflowDragStart, 'workflow'),
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Custom Nodes (kind='custom-node') — drop inserts a single composite node. */}
                            {customNodes.length > 0 && (
                                <div className="library-section custom-nodes-section">
                                    <div
                                        className="library-header custom-nodes-header"
                                        onClick={() => toggleSection('CustomNodes')}
                                    >
                                        <Chevron expanded={expandedSections['CustomNodes']} />
                                        <span className="library-name">Custom Nodes</span>
                                        <span className="tool-count">{customNodes.length}</span>
                                    </div>

                                    {expandedSections['CustomNodes'] && (
                                        <div className="library-tools">
                                            <div className="subsection-tools">
                                                {customNodes.map((wf) =>
                                                    renderSavedEntryRow(wf, handleCustomNodeDragStart, 'custom-node'),
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* I/O (Dummy Nodes) Section */}
                            <div className="library-section io-section">
                                <div className="library-header io-header" onClick={() => toggleSection('DummyNodes')}>
                                    <Chevron expanded={expandedSections['DummyNodes']} />
                                    <span className="library-name">I/O</span>
                                    <span className="tool-count">{dummyNodes['I/O'].length}</span>
                                </div>

                                {expandedSections['DummyNodes'] && (
                                    <div className="library-tools">
                                        <div className="subsection-tools">
                                            {dummyNodes['I/O'].map((tool, index) => (
                                                <WorkflowMenuItem
                                                    key={`dummy-${index}`}
                                                    name={tool.name}
                                                    toolInfo={{
                                                        fullName: tool.fullName,
                                                        function: tool.function,
                                                        typicalUse: tool.typicalUse,
                                                    }}
                                                    onDragStart={(event, name) => handleDragStart(event, name, true)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modality Sections */}
                            {modalityOrder.map((modality) => {
                                const modalityData = toolsByModality[modality];
                                const isModalityExpanded = expandedSections[modality];
                                const modalityToolCount = getModalityToolCount(modality);
                                const libraries = modalityData ? Object.keys(modalityData) : [];

                                // Sort libraries by libraryOrder
                                const sortedLibraries = libraries.sort((a, b) => {
                                    const aIdx = libraryOrder.indexOf(a);
                                    const bIdx = libraryOrder.indexOf(b);
                                    return (aIdx === -1 ? 999 : aIdx) - (bIdx === -1 ? 999 : bIdx);
                                });

                                if (modalityToolCount === 0) return null;

                                return (
                                    <div key={modality} className="modality-section">
                                        <ModalityTooltip name={modality} description={modalityDescriptions[modality]}>
                                            <div className="modality-header" onClick={() => toggleSection(modality)}>
                                                <Chevron expanded={isModalityExpanded} />
                                                <span className="modality-name">{modality}</span>
                                                <span className="tool-count">{modalityToolCount}</span>
                                            </div>
                                        </ModalityTooltip>

                                        {isModalityExpanded && (
                                            <div className="modality-content">
                                                {sortedLibraries.map((library) => {
                                                    const libraryData = modalityData[library];
                                                    const libraryKey = `${modality}::${library}`;
                                                    const isLibraryExpanded = expandedSections[libraryKey];
                                                    const libraryToolCount = getLibraryToolCount(modalityData, library);
                                                    const categories = Object.keys(libraryData || {});

                                                    if (libraryToolCount === 0) return null;

                                                    return (
                                                        <div key={libraryKey} className="library-section">
                                                            <div
                                                                className="library-header"
                                                                onClick={() => toggleSection(libraryKey)}
                                                            >
                                                                <Chevron expanded={isLibraryExpanded} />
                                                                <span className="library-name">{library}</span>
                                                                <span className="tool-count">{libraryToolCount}</span>
                                                            </div>

                                                            {isLibraryExpanded && (
                                                                <div className="library-tools">
                                                                    {categories.map((category) => (
                                                                        <div key={category} className="subsection">
                                                                            <div className="subsection-header">
                                                                                {category}
                                                                            </div>
                                                                            <div className="subsection-tools">
                                                                                {libraryData[category].map(
                                                                                    (tool, index) => (
                                                                                        <WorkflowMenuItem
                                                                                            key={`${libraryKey}-${category}-${index}`}
                                                                                            name={tool.name}
                                                                                            toolInfo={{
                                                                                                fullName: tool.fullName,
                                                                                                function: tool.function,
                                                                                                modality: tool.modality,
                                                                                                keyParameters:
                                                                                                    tool.keyParameters,
                                                                                                keyPoints:
                                                                                                    tool.keyPoints,
                                                                                                typicalUse:
                                                                                                    tool.typicalUse,
                                                                                                docUrl: tool.docUrl,
                                                                                            }}
                                                                                            onDragStart={
                                                                                                handleDragStart
                                                                                            }
                                                                                        />
                                                                                    ),
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </>
        </div>
    );
}

export default WorkflowMenu;
