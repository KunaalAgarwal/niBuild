import React, { useState } from 'react';
import { Modal } from 'react-bootstrap';
import '../styles/headerBar.css';

function HeaderBar(){
    const [showInfo, setShowInfo] = useState(false);

    const handleShowInfo = () => setShowInfo(true);
    const handleCloseInfo = () => setShowInfo(false);

    return (
        <div className="header-bar">
            <h1>fMRIbuild</h1>
            {/*ℹ️ */}
            <span className="header-span" onClick={handleShowInfo}>[how-to]</span>
            <a className="header-span header-link" href="https://github.com/KunaalAgarwal/fMRIbuild" target="_blank">[github]</a>
            <a className="header-span header-link" href="https://github.com/KunaalAgarwal/fMRIbuild/issues" target="_blank">[issues]</a>
            <Modal className="custom-modal" show={showInfo} onHide={handleCloseInfo} centered>
                <Modal.Body className="modal-label header-modal">
                    <ul style={{ paddingLeft: '20px', marginBottom: '0', lineHeight: '2.0' }}>
                        <li><strong>Drag and Drop:</strong> Move tools from the left-side menu onto the canvas.</li>
                        <li><strong>Tool Info:</strong> Hover over a tool to see its function and typical use case.</li>
                        <li><strong>Tool Documentation:</strong> Double-click a tool in the menu to open its official documentation.</li>
                        <li><strong>Connect Nodes:</strong> Draw a connection between nodes to open the mapping modal, where you can specify which outputs connect to which inputs.</li>
                        <li><strong>Edit Connections:</strong> Double-click an edge to modify output-to-input mappings.</li>
                        <li><strong>Optional Parameters:</strong> Double-click a node on the canvas to configure optional parameters (e.g., thresholds, flags).</li>
                        <li><strong>Delete Elements:</strong> Select a node or edge and press Delete/Backspace to remove it.</li>
                        <li><strong>Manage Workspaces:</strong> Organize workflows using multiple workspaces, saved in browser storage.</li>
                        <li><strong>Generate Workflow:</strong> Export a CWL workflow zip containing the workflow definition and tool dependencies.</li>
                    </ul>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default HeaderBar;
