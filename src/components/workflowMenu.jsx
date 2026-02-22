import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WorkflowMenuItem from './workflowMenuItem';
import ModalityTooltip from './modalityTooltip';
import { toolsByModality, modalityOrder, modalityDescriptions, libraryOrder, dummyNodes } from '../utils/toolAnnotations';
import { useCustomWorkflowsContext } from '../context/CustomWorkflowsContext.jsx';
import '../styles/workflowMenu.css';

function WorkflowMenu({ onEditWorkflow, onDeleteWorkflow }) {
  const { customWorkflows, deleteWorkflow } = useCustomWorkflowsContext();

  const [expandedSections, setExpandedSections] = useState(() => {
    const initial = { DummyNodes: false, MyWorkflows: false };
    modalityOrder.forEach(m => { initial[m] = false; });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { wfId, wfName, position: { top, left } }
  const deleteConfirmRef = useRef(null);
  const searchInputRef = useRef(null);

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
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const handleDragStart = useCallback((event, name, isDummy = false) => {
    event.dataTransfer.setData('node/name', name);
    event.dataTransfer.setData('node/isDummy', isDummy.toString());
    // Pass isBIDS flag for BIDS nodes
    const dummyDef = dummyNodes['I/O']?.find(d => d.name === name);
    if (dummyDef?.isBIDS) {
      event.dataTransfer.setData('node/isBIDS', 'true');
    }
  }, []);

  const handleCustomWorkflowDragStart = useCallback((event, workflow) => {
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
            const matchFields = [
              tool.name,
              tool.fullName || '',
              tool.function || '',
              modality
            ];

            if (matchFields.some(f => f.toLowerCase().includes(searchTerm))) {
              results.push({ modality, library, category, tool });
            }
          }
        }
      }
    }

    // Also search custom workflows
    for (const wf of customWorkflows) {
      const nonDummyTools = wf.nodes.filter(n => !n.isDummy).map(n => n.label);
      const matchFields = [
        wf.name,
        ...nonDummyTools
      ];
      const searchTerm = toolQuery || query;
      if (matchFields.some(f => f.toLowerCase().includes(searchTerm))) {
        results.push({
          modality: 'My Workflows',
          library: 'Custom',
          category: 'Custom',
          tool: {
            name: wf.name,
            fullName: wf.name,
            function: `Custom workflow with ${nonDummyTools.length} tools: ${nonDummyTools.join(', ')}`,
            typicalUse: `Tools: ${nonDummyTools.join(', ')}`
          },
          isCustomWorkflow: true,
          customWorkflow: wf
        });
      }
    }

    return results;
  }, [searchQuery, customWorkflows]);

  const clearSearch = () => {
    setSearchQuery('');
    searchInputRef.current?.focus();
  };

  // Group search results by modality for display
  const renderSearchResults = () => {
    if (filteredResults.length === 0) {
      return (
        <div className="workflow-search-empty">
          No tools match &ldquo;{searchQuery.trim()}&rdquo;
        </div>
      );
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
                docUrl: r.tool.docUrl
              }}
              onDragStart={r.isCustomWorkflow
                ? (event) => handleCustomWorkflowDragStart(event, r.customWorkflow)
                : handleDragStart
              }
              warningIcon={r.isCustomWorkflow && r.customWorkflow.hasValidationWarnings}
            />
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="workflow-menu-container">
      {deleteConfirm && createPortal(
        <div
          ref={deleteConfirmRef}
          className="delete-confirm-portal"
          style={{
            top: deleteConfirm.position.top,
            left: deleteConfirm.position.left,
            transform: 'translateY(-50%)'
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
        document.body
      )}

      <div className="workflow-search">
        <input
          ref={searchInputRef}
          type="text"
          className="workflow-search-input"
          placeholder="Search tools..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') clearSearch(); }}
        />
      </div>

      <div className="workflow-menu">
        {filteredResults ? (
          renderSearchResults()
        ) : (
          <>
            {/* I/O (Dummy Nodes) Section */}
            <div className="library-section">
              <div
                className="library-header io-header"
                onClick={() => toggleSection('DummyNodes')}
              >
                <span className="chevron">{expandedSections['DummyNodes'] ? '▼' : '▶'}</span>
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
                          typicalUse: tool.typicalUse
                        }}
                        onDragStart={(event, name) => handleDragStart(event, name, true)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* My Workflows Section */}
            {customWorkflows.length > 0 && (
              <div className="library-section">
                <div
                  className="library-header my-workflows-header"
                  onClick={() => toggleSection('MyWorkflows')}
                >
                  <span className="chevron">{expandedSections['MyWorkflows'] ? '\u25BC' : '\u25B6'}</span>
                  <span className="library-name">My Workflows</span>
                  <span className="tool-count">{customWorkflows.length}</span>
                </div>

                {expandedSections['MyWorkflows'] && (
                  <div className="library-tools">
                    <div className="subsection-tools">
                      {customWorkflows.map((wf) => {
                        const nonDummyTools = wf.nodes.filter(n => !n.isDummy).map(n => n.label);
                        return (
                          <div key={wf.id} className="custom-workflow-item-wrapper">
                            <WorkflowMenuItem
                              name={wf.name}
                              toolInfo={{
                                fullName: wf.name,
                                function: `Custom workflow with ${nonDummyTools.length} tools`,
                                typicalUse: `Tools: ${nonDummyTools.join(', ')}`
                              }}
                              onDragStart={(event) => handleCustomWorkflowDragStart(event, wf)}
                              warningIcon={wf.hasValidationWarnings}
                            />
                            <div className="custom-workflow-action-left">
                              <button
                                className="custom-workflow-action-btn edit-btn"
                                title="Edit in new workspace"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onEditWorkflow) onEditWorkflow(wf);
                                }}
                              >
                                &#9998;
                              </button>
                            </div>
                            <div className="custom-workflow-action-right">
                              <button
                                className="custom-workflow-action-btn delete-btn"
                                title="Delete workflow"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  setDeleteConfirm({
                                    wfId: wf.id,
                                    wfName: wf.name,
                                    position: { top: rect.top + rect.height / 2, left: rect.right + 8 }
                                  });
                                }}
                              >
                                &#10005;
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    <div
                      className="modality-header"
                      onClick={() => toggleSection(modality)}
                    >
                      <span className="chevron">{isModalityExpanded ? '▼' : '▶'}</span>
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
                              <span className="chevron">{isLibraryExpanded ? '▼' : '▶'}</span>
                              <span className="library-name">{library}</span>
                              <span className="tool-count">{libraryToolCount}</span>
                            </div>

                            {isLibraryExpanded && (
                              <div className="library-tools">
                                {categories.map((category) => (
                                  <div key={category} className="subsection">
                                    <div className="subsection-header">{category}</div>
                                    <div className="subsection-tools">
                                      {libraryData[category].map((tool, index) => (
                                        <WorkflowMenuItem
                                          key={`${libraryKey}-${category}-${index}`}
                                          name={tool.name}
                                          toolInfo={{
                                            fullName: tool.fullName,
                                            function: tool.function,
                                            modality: tool.modality,
                                            keyParameters: tool.keyParameters,
                                            keyPoints: tool.keyPoints,
                                            typicalUse: tool.typicalUse,
                                            docUrl: tool.docUrl
                                          }}
                                          onDragStart={handleDragStart}
                                        />
                                      ))}
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
    </div>
  );
}

export default WorkflowMenu;
