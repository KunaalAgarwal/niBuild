/**
 * Empty-state welcome screen for the Workflow Manager — shown when no saved
 * workflows exist. Pure static markup plus two creation actions; extracted
 * from WorkflowManagerPage so that page file stays focused on the table.
 */
function WorkflowManagerWelcome({ onNewWorkflow, onImportWorkflow }) {
    return (
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
                            <button type="button" className="wm-welcome-action" onClick={() => onNewWorkflow?.()}>
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
                            <button type="button" className="wm-welcome-action" onClick={() => onImportWorkflow?.()}>
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
    );
}

export default WorkflowManagerWelcome;
