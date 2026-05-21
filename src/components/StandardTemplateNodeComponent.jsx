import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import IONodeModal from './IONodeModal.jsx';
import StandardTemplatePickerModal from './StandardTemplatePickerModal.jsx';
import { useTemplateAssets } from '../context/TemplateAssetContext.jsx';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders Standard Template I/O nodes. Selecting a template resolves the
 * registry entry, kicks off the blob fetch (so it's cached for export),
 * and stores the chosen variant on `node.data`.
 *
 * Display behaviour mirrors BIDSNodeComponent: single in/out handles,
 * status badge (idle/fetching/ready/error), Info tooltip pinning, and an
 * "Edit" double-click path into IONodeModal for label/notes.
 */
const StandardTemplateNodeComponent = ({ data, isScatterInherited, isGatherNode }) => {
    const [showIOModal, setShowIOModal] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const infoTip = usePinnableTooltip();
    const { fetchTemplate, getStatus } = useTemplateAssets();

    const templateId = data.templateId || null;
    const template = data.template || null;
    const status = templateId ? getStatus(templateId) : { kind: 'idle' };
    const hasTemplate = !!template;

    // If a saved workspace re-hydrates a Standard Template node, the blob
    // is not in the in-memory cache anymore — kick off a re-fetch so export
    // can complete without the user manually re-picking.
    useEffect(() => {
        if (templateId && status.kind === 'idle') {
            fetchTemplate(templateId).catch(() => {});
        }
    }, [templateId, status.kind, fetchTemplate]);

    const handleSelect = (tpl) => {
        data.onUpdateStandardTemplate?.({
            templateId: tpl.id,
            template: { ...tpl },
            resolvedFilename: tpl.filename,
            label: tpl.label,
        });
    };

    return (
        <>
            <div className="node-wrapper node-io node-bids" onDoubleClick={() => setShowIOModal(true)}>
                <div className="node-top-row">
                    <span className="node-io-badge">
                        {hasTemplate ? (
                            <span className="node-io-badge-text">{template.resolution}</span>
                        ) : (
                            <span className="node-io-badge-text">Template</span>
                        )}
                    </span>
                    <span
                        className="node-params-btn"
                        onClick={(e) => {
                            e.stopPropagation();
                            setShowPicker(true);
                        }}
                    >
                        {hasTemplate ? 'Change' : 'Pick'}
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
                        {!hasTemplate && <span className="node-warning-badge">!</span>}
                        {hasTemplate && status.kind === 'fetching' && (
                            <span className="node-warning-badge" title="Fetching template">
                                …
                            </span>
                        )}
                        {hasTemplate && status.kind === 'error' && (
                            <span className="node-warning-badge" title={status.message}>
                                !
                            </span>
                        )}
                        {isScatterInherited && <span className="node-scatter-badge">{'↻'}</span>}
                        {isGatherNode && <span className="node-gather-badge">G</span>}
                        {data.notes && <span className="node-notes-badge">N</span>}
                    </span>
                    <span ref={infoTip.iconRef} className="node-info-btn" onClick={infoTip.onClick}>
                        Info
                    </span>
                </div>
            </div>

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
                            <span className="tooltip-text">Standard Template Input</span>
                        </div>
                        <div className="tooltip-section">
                            <span className="tooltip-label">Function:</span>
                            <span className="tooltip-text">
                                Provides a standard reference file (MNI152, fsaverage, atlas) to downstream tools.
                                Bundled into <code>additional_inputs/</code> at export.
                            </span>
                        </div>
                        {hasTemplate && (
                            <>
                                <div className="tooltip-section">
                                    <span className="tooltip-label">Variant:</span>
                                    <span className="tooltip-text">{template.label}</span>
                                </div>
                                <div className="tooltip-section">
                                    <span className="tooltip-label">Family:</span>
                                    <span className="tooltip-text">{template.family}</span>
                                </div>
                                <div className="tooltip-section">
                                    <span className="tooltip-label">File:</span>
                                    <span className="tooltip-text">{template.filename}</span>
                                </div>
                                {template.citation && (
                                    <div className="tooltip-section">
                                        <span className="tooltip-label">Citation:</span>
                                        <span className="tooltip-text">{template.citation}</span>
                                    </div>
                                )}
                                {template.license && (
                                    <div className="tooltip-section">
                                        <span className="tooltip-label">License:</span>
                                        <span className="tooltip-text">{template.license}</span>
                                    </div>
                                )}
                                <div className="tooltip-section">
                                    <span className="tooltip-label">Status:</span>
                                    <span className="tooltip-text">{status.kind}</span>
                                </div>
                            </>
                        )}
                        {!hasTemplate && (
                            <div className="tooltip-section">
                                <span className="tooltip-label" style={{ color: 'var(--color-warning)' }}>
                                    Status:
                                </span>
                                <span className="tooltip-text">
                                    No template selected. Click &quot;Pick&quot; to choose a variant.
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
            <StandardTemplatePickerModal
                show={showPicker}
                onHide={() => setShowPicker(false)}
                currentTemplateId={templateId}
                onSelect={handleSelect}
            />
        </>
    );
};

export default StandardTemplateNodeComponent;
