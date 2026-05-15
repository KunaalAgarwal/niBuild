import { useEffect, useRef } from 'react';
import '../styles/topBar.css';

/**
 * Top action bar. The right-side cluster holds three action buttons:
 *   Save/Update Workflow → Save/Update Custom Node → Generate.
 *
 * Save vs. Update: when the active workspace is bound to a saved entry whose
 * kind matches the button, the label flips from "Save as …" to "Update …" and
 * the button disables if there are no staged changes. The cross-kind button
 * stays in "Save as …" mode (creates a new entry without touching the
 * existing binding) and remains active regardless of changes.
 *
 * Reviewing staged changes is NOT exposed from the TopBar — it lives in the
 * left sidebar's "Changes" tab (and the Ctrl+K command palette as a backup).
 * Keeping the TopBar to three buttons leaves room for the responsive label
 * swap to behave the same as before the staged-changes work landed.
 *
 * Each button renders a long and short label; the short label takes over at
 * ≤900px (the same breakpoint that hides the external links). `title` always
 * carries the full action so tooltips and screen readers stay descriptive.
 */
function TopBar({
    onGenerateWorkflow,
    onSaveAsWorkflow,
    onSaveAsCustomNode,
    workflowDisplayName,
    onOpenCommandPalette,
    isCommandPaletteOpen,
    onSearchRefReady,
    paletteQuery = '',
    onPaletteQueryChange,
    isManagerActive = false,
    isBoundAsWorkflow = false,
    isBoundAsCustomNode = false,
    // Per-kind change flags: each Save button reads only its own kind's flag
    // so the two buttons disable independently. A workspace bound as both a
    // workflow and a custom node can therefore have one button in disabled
    // "Update X" mode and the other in active "Update Y" mode at the same time.
    hasWorkflowChanges = false,
    hasCustomNodeChanges = false,
}) {
    // "Update" mode = bound to a same-kind entry. The label switches and the
    // button gates on the kind-specific change flag; otherwise the button
    // stays as a "Save as …" entry and is always enabled (modulo manager mode).
    const workflowUpdateMode = isBoundAsWorkflow;
    const customNodeUpdateMode = isBoundAsCustomNode;

    const workflowLabelLong = workflowUpdateMode ? 'Update Workflow' : 'Save as Workflow';
    const workflowLabelShort = workflowUpdateMode ? 'Update Workflow' : 'Save Workflow';
    const customLabelLong = customNodeUpdateMode ? 'Update Custom Node' : 'Save as Custom Node';
    const customLabelShort = customNodeUpdateMode ? 'Update Custom' : 'Save Custom';

    const workflowDisabled = isManagerActive || (workflowUpdateMode && !hasWorkflowChanges);
    const customDisabled = isManagerActive || (customNodeUpdateMode && !hasCustomNodeChanges);

    // Auto-focus the search input when the palette opens so the user can start
    // typing immediately. The palette no longer renders its own input row —
    // this input is the single visible search field for the command palette.
    const searchInputRef = useRef(null);
    useEffect(() => {
        if (isCommandPaletteOpen) {
            requestAnimationFrame(() => searchInputRef.current?.focus());
        }
    }, [isCommandPaletteOpen]);

    const workflowTitle = isManagerActive
        ? 'Open a workspace to save as a workflow'
        : workflowUpdateMode
          ? hasWorkflowChanges
              ? 'Update the saved workflow with the current workspace contents'
              : 'No changes to update'
          : 'Save the current workspace as a new workflow';

    const customTitle = isManagerActive
        ? 'Open a workspace to save as a custom node'
        : customNodeUpdateMode
          ? hasCustomNodeChanges
              ? 'Update the saved custom node with the current workspace contents'
              : 'No changes to update'
          : 'Save the current workspace as a new custom node';

    return (
        <div className="top-bar">
            <div className="top-bar-left">
                <span className="top-bar-logo">niBuild</span>
                <a
                    className="top-bar-btn top-bar-external-link"
                    href="https://kunaalagarwal.github.io/niBuild-auxiliary/"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Docs
                </a>
                <a
                    className="top-bar-btn top-bar-external-link"
                    href="https://github.com/KunaalAgarwal/niBuild"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    GitHub
                </a>
                <a
                    className="top-bar-btn top-bar-external-link"
                    href="https://github.com/KunaalAgarwal/niBuild/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Issues
                </a>
            </div>

            <div className="top-bar-center">
                <div
                    ref={onSearchRefReady}
                    className={`top-bar-search${isCommandPaletteOpen ? ' palette-open' : ''}`}
                    onClick={isCommandPaletteOpen ? undefined : onOpenCommandPalette}
                >
                    <svg
                        className="top-bar-search-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        ref={searchInputRef}
                        type="text"
                        className="top-bar-search-input"
                        placeholder={isCommandPaletteOpen ? 'Search' : workflowDisplayName}
                        value={isCommandPaletteOpen ? paletteQuery : ''}
                        onChange={(e) => onPaletteQueryChange?.(e.target.value)}
                        readOnly={!isCommandPaletteOpen}
                    />
                </div>
            </div>

            <div className="top-bar-right">
                <button
                    className="top-bar-btn top-bar-btn-action top-bar-btn-save-workflow"
                    onClick={onSaveAsWorkflow}
                    disabled={workflowDisabled}
                    title={workflowTitle}
                >
                    <span className="top-bar-btn-label-long">{workflowLabelLong}</span>
                    <span className="top-bar-btn-label-short">{workflowLabelShort}</span>
                </button>
                <button
                    className="top-bar-btn top-bar-btn-action top-bar-btn-save-custom"
                    onClick={onSaveAsCustomNode}
                    disabled={customDisabled}
                    title={customTitle}
                >
                    <span className="top-bar-btn-label-long">{customLabelLong}</span>
                    <span className="top-bar-btn-label-short">{customLabelShort}</span>
                </button>
                <button
                    className="top-bar-btn top-bar-btn-action top-bar-btn-generate"
                    onClick={onGenerateWorkflow}
                    disabled={isManagerActive}
                    title={isManagerActive ? 'Open a workspace to generate' : 'Generate workflow'}
                >
                    <span className="top-bar-btn-label-long">Generate</span>
                    <span className="top-bar-btn-label-short">Generate</span>
                </button>
            </div>
        </div>
    );
}

export default TopBar;
