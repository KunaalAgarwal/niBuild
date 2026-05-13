import '../styles/topBar.css';

function TopBar({
    onGenerateWorkflow,
    onSaveWorkflow,
    onRevertWorkflow,
    isSavedWorkflow,
    workflowHasChanges,
    workflowDisplayName,
    onOpenCommandPalette,
    isCommandPaletteOpen,
}) {
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
                    className={`top-bar-search${isCommandPaletteOpen ? ' palette-open' : ''}`}
                    onClick={onOpenCommandPalette}
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
                    <input type="text" className="top-bar-search-input" placeholder={workflowDisplayName} readOnly />
                </div>
            </div>

            <div className="top-bar-right">
                {isSavedWorkflow ? (
                    <button
                        className="top-bar-btn top-bar-btn-revert"
                        onClick={onRevertWorkflow}
                        disabled={!workflowHasChanges}
                        title="View staged changes"
                    >
                        Staged Changes
                    </button>
                ) : (
                    <button className="top-bar-btn top-bar-btn-save" onClick={onSaveWorkflow} title="Save workflow">
                        Save
                    </button>
                )}
                <button
                    className="top-bar-btn top-bar-btn-generate"
                    onClick={onGenerateWorkflow}
                    title="Generate workflow"
                >
                    Generate
                </button>
            </div>
        </div>
    );
}

export default TopBar;
