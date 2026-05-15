import { useRef, useCallback } from 'react';
import { Modal } from 'react-bootstrap';
import BIDSDataPanel from './BIDSDataPanel.jsx';
import { useAuxTabsContext } from '../context/AuxTabContext.jsx';
import '../styles/bidsDataModal.css';

/**
 * BIDSDataModal — thin wrapper around BIDSDataPanel.
 *
 * Adds an Expand button to the header that opens the same content as an aux tab,
 * transferring the panel's current draft state.
 */
const BIDSDataModal = ({ show, onClose, bidsStructure, bidsSelections, workspaceId, nodeId }) => {
    const panelRef = useRef(null);
    const { openAuxTab, setActiveTabKey } = useAuxTabsContext();

    const handleExpand = useCallback(() => {
        if (!workspaceId || !nodeId) {
            onClose(null);
            return;
        }
        const draft = panelRef.current?.getDraftState?.();
        const id = openAuxTab({
            type: 'bids-modal',
            workspaceId,
            nodeId,
            initialState: draft || null,
        });
        setActiveTabKey(`aux-${id}`);
        onClose(null);
    }, [workspaceId, nodeId, openAuxTab, setActiveTabKey, onClose]);

    if (!bidsStructure) return null;

    return (
        <Modal show={show} onHide={() => onClose(null)} centered size="lg" className="bids-modal">
            <Modal.Header closeButton>
                <div className="bids-modal-header-left">
                    <Modal.Title>{bidsStructure.datasetName || 'BIDS Dataset'}</Modal.Title>
                    {bidsStructure.bidsVersion && (
                        <div className="modal-subtitle">BIDS v{bidsStructure.bidsVersion}</div>
                    )}
                </div>
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
                <BIDSDataPanel
                    ref={panelRef}
                    bidsStructure={bidsStructure}
                    savedSelections={bidsSelections}
                    onSave={(data) => onClose(data)}
                    onCancel={() => onClose(null)}
                    mode="modal"
                />
            </Modal.Body>
        </Modal>
    );
};

export default BIDSDataModal;
