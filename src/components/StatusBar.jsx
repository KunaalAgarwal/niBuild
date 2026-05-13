import '../styles/statusBar.css';

function StatusBar({ currentWorkspace, totalWorkspaces }) {
    return (
        <div className="status-bar">
            <div className="status-bar-left">
                <span className="status-bar-item">
                    Workspace {currentWorkspace + 1}/{totalWorkspaces}
                </span>
            </div>
            <div className="status-bar-right">
                <span className="status-bar-item status-bar-item-muted">niBuild</span>
            </div>
        </div>
    );
}

export default StatusBar;
