import { useState, useCallback, useMemo, useRef } from 'react';
import WorkflowMenuItem from './workflowMenuItem';
import ModalityTooltip from './modalityTooltip';
import { toolsByModality, modalityOrder, modalityDescriptions, libraryOrder, dummyNodes } from '../utils/toolAnnotations';
import '../styles/workflowMenu.css';

function WorkflowMenu() {
  const [expandedSections, setExpandedSections] = useState(() => {
    const initial = { DummyNodes: false };
    modalityOrder.forEach(m => { initial[m] = false; });
    return initial;
  });

  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);

  const toggleSection = useCallback((key) => {
    setExpandedSections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  }, []);

  const handleDragStart = useCallback((event, name, isDummy = false) => {
    event.dataTransfer.setData('node/name', name);
    event.dataTransfer.setData('node/isDummy', isDummy.toString());
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

    return results;
  }, [searchQuery]);

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
              onDragStart={handleDragStart}
            />
          ))}
        </div>
      </div>
    ));
  };

  return (
    <div className="workflow-menu-container">
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
                className="library-header"
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
