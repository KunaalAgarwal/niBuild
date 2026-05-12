import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import IONodeModal from './IONodeModal.jsx';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders BIDS dataset nodes with info tooltip and data management.
 */
const BIDSNodeComponent = ({ data, isScatterInherited, isGatherNode }) => {
    const [showIOModal, setShowIOModal] = useState(false);
    const infoTip = usePinnableTooltip();

    const selectionCount = data.bidsSelections?.selections ? Object.keys(data.bidsSelections.selections).length : 0;
    const hasData = data.bidsStructure != null;

    return (
        <>
            <div className="node-wrapper node-io node-bids" onDoubleClick={() => setShowIOModal(true)}>
                <div className="node-top-row">
                    <span className="node-io-badge">
                        {hasData && selectionCount > 0 ? (
                            <span className="node-io-badge-text">
                                {selectionCount} output{selectionCount !== 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span className="node-io-badge-text">BIDS</span>
                        )}
                    </span>
                    <span
                        className="node-params-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (hasData) {
                                data.onUpdateBIDS?.({ _openModal: true });
                            } else {
                                data.onUpdateBIDS?.({ _pickDirectory: true });
                            }
                        }}
                    >
                        Data
                    </span>
                </div>
                <div className="node-content">
                    <Handle type="target" position={Position.Left} />
                    <span className="handle-label">IN</span>
                    <span className="node-label" style={{ fontSize: labelFontSize(data.displayLabel || data.label) }}>
                        {data.displayLabel || data.label}
                    </span>
                    <span className="handle-label">OUT</span>
                    <Handle type="source" position={Position.Right} />
                </div>
                <div className="node-bottom-row">
                    <span className="node-bottom-left">
                        {!hasData && <span className="node-warning-badge">!</span>}
                        {isScatterInherited && <span className="node-scatter-badge">{'\u21BB'}</span>}
                        {isGatherNode && <span className="node-gather-badge">G</span>}
                        {data.notes && <span className="node-notes-badge">N</span>}
                    </span>
                    <span ref={infoTip.iconRef} className="node-info-btn" onClick={infoTip.onClick}>
                        Info
                    </span>
                </div>
            </div>

            {/* BIDS Info tooltip */}
            {infoTip.show &&
                createPortal(
                    <div
                        ref={infoTip.tooltipRef}
                        className="workflow-tooltip"
                        style={{
                            top: infoTip.pos.top,
                            left: infoTip.pos.left,
                            transform: 'translateY(-50%)',
                        }}
                    >
                        <button className="tooltip-close-btn" onClick={infoTip.close}>
                            &times;
                        </button>
                        <div className="tooltip-section tooltip-fullname">
                            <span className="tooltip-text">BIDS Dataset Input</span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">BIDS:</span>
                            <span className="tooltip-text">
                                Brain Imaging Data Structure — a standard for organizing neuroimaging datasets
                            </span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">Function:</span>
                            <span className="tooltip-text">
                                Loads a BIDS-formatted dataset and exposes selected data streams as output ports
                            </span>
                        </div>
                        {data.bidsStructure && (
                            <>
                                <div className="tooltip-section">
                                    <span className="tooltip-label">Dataset:</span>
                                    <span className="tooltip-text">{data.bidsStructure.datasetName || 'Unknown'}</span>
                                </div>
                                <div className="tooltip-section">
                                    <span className="tooltip-label">Subjects:</span>
                                    <span className="tooltip-text">
                                        {Object.keys(data.bidsStructure.subjects).length}
                                    </span>
                                </div>
                            </>
                        )}
                        {data.bidsSelections && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Outputs:</span>
                                <span className="tooltip-text">
                                    {Object.keys(data.bidsSelections.selections).join(', ')}
                                </span>
                            </div>
                        )}
                        {!data.bidsStructure && (
                            <div className="tooltip-section">
                                <span className="tooltip-label" style={{ color: '#f0ad4e' }}>
                                    Status:
                                </span>
                                <span className="tooltip-text">
                                    No dataset loaded. Click &quot;Data&quot; to select a BIDS directory.
                                </span>
                            </div>
                        )}
                    </div>,
                    document.body,
                )}
            <IONodeModal
                show={showIOModal}
                onHide={() => setShowIOModal(false)}
                label={data.label}
                notes={data.notes || ''}
                onSave={(updated) => data.onSaveIO?.(updated)}
            />
        </>
    );
};

export default BIDSNodeComponent;
