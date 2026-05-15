import { useRef, useCallback, useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import CustomWorkflowParamPanel from './CustomWorkflowParamPanel.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import '../styles/workflowItem.css';

/**
 * CustomWorkflowParamModal — thin wrapper around CustomWorkflowParamPanel.
 *
 * Adds an Expand button to the header that opens the same content as an aux tab,
 * transferring the panel's current draft state.
 */
const CustomWorkflowParamModal = ({
    show,
    onClose,
    workflowName,
    internalNodes,
    internalEdges,
    wiredInputs,
    workspaceId,
    nodeId,
}) => {
    const panelRef = useRef(null);
    const { openAuxTab, setActiveTabKey } = useAuxTabsContext();

    // Remount the panel each time the modal opens so initial state re-seeds from internalNodes.
    // Without this, the lazy-init pattern in the panel would only run once for the modal's lifetime.
    const [mountKey, setMountKey] = useState(0);
    useEffect(() => {
        if (show) setMountKey((k) => k + 1);
    }, [show]);

    const handleExpand = useCallback(() => {
        if (!workspaceId || !nodeId) {
            onClose(internalNodes);
            return;
        }
        const draft = panelRef.current?.getDraftState?.();
        const id = openAuxTab({
            type: 'param-modal',
            workspaceId,
            nodeId,
            initialState: draft || null,
        });
        setActiveTabKey(`aux-${id}`);
        // Pass back unchanged nodes — the tab will commit changes when saved.
        onClose(internalNodes);
    }, [workspaceId, nodeId, openAuxTab, setActiveTabKey, onClose, internalNodes]);

    return (
        <Modal show={show} onHide={() => onClose(internalNodes)} centered className="custom-modal" size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{workflowName} - Parameters</Modal.Title>
                <button
                    type="button"
                    className="ide-modal-expand"
                    onClick={handleExpand}
                    title="Open as tab"
                    aria-label="Open as tab"
                >
                    <span className="ide-modal-expand-icon" aria-hidden="true">
                        ⛶
                    </span>
                    <span>Open as Tab</span>
                </button>
            </Modal.Header>
            <Modal.Body className="p-0">
                <CustomWorkflowParamPanel
                    key={mountKey}
                    ref={panelRef}
                    workflowName={workflowName}
                    internalNodes={internalNodes}
                    internalEdges={internalEdges}
                    wiredInputs={wiredInputs}
                    onSave={(allUpdated) => onClose(allUpdated)}
                    onCancel={() => onClose(internalNodes)}
                    mode="modal"
                />
            </Modal.Body>
        </Modal>
    );
};

export default CustomWorkflowParamModal;
