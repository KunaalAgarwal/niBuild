import '../styles/statusBar.css';

function StatusBar({ currentWorkspace, totalWorkspaces, isManagerActive }) {
    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span className="status-bar-item">
                    {isManagerActive ? 'Workflow Manager' : `Workspace ${currentWorkspace + 1}/${totalWorkspaces}`}
                </span>
            </div>
            <div className="status-bar-right">
                <span className="status-bar-item status-bar-item-muted">
                    Agarwal K.{' '}
                    <a
                        className="status-bar-link"
                        href="https://www.linkedin.com/in/kunaal-agarwal/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        [Info]
                    </a>
                    {' · '}
                    Rasero J.{' '}
                    <a
                        className="status-bar-link"
                        href="https://datascience.virginia.edu/people/javier-rasero"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        [Info]
                    </a>
                </span>
            </div>
        </div>
    );
}

export default StatusBar;
