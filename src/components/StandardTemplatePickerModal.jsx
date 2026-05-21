import { useEffect, useMemo, useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { STANDARD_TEMPLATES, getTemplatesGroupedByFamily } from '../data/standardTemplates.js';
import { useTemplateAssets } from '../context/TemplateAssetContext.jsx';
import '../styles/ioNodeModal.css';

function formatBytes(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StandardTemplatePickerModal({ show, onHide, currentTemplateId, onSelect }) {
    const groups = useMemo(() => getTemplatesGroupedByFamily(), []);
    const { fetchTemplate, getStatus } = useTemplateAssets();
    const [selectedId, setSelectedId] = useState(currentTemplateId || null);

    useEffect(() => {
        if (show) setSelectedId(currentTemplateId || null);
    }, [show, currentTemplateId]);

    const handleConfirm = () => {
        if (!selectedId) return;
        const tpl = STANDARD_TEMPLATES.find((t) => t.id === selectedId);
        if (!tpl) return;
        fetchTemplate(selectedId).catch(() => {});
        onSelect(tpl);
        onHide();
    };

    return (
        <Modal show={show} onHide={onHide} centered size="lg" className="io-node-modal">
            <Modal.Header>
                <Modal.Title>Choose a standard template</Modal.Title>
            </Modal.Header>
            <Modal.Body onClick={(e) => e.stopPropagation()}>
                <p className="template-picker-help">
                    Reference files are fetched on selection and bundled into <code>additional_inputs/</code> when you
                    export the RO-Crate. License and citation metadata flow into the crate manifest.
                </p>
                <div className="template-picker-groups">
                    {[...groups.entries()].map(([family, templates]) => (
                        <section key={family} className="template-picker-group">
                            <h4 className="template-picker-family">{family}</h4>
                            <ul className="template-picker-list">
                                {templates.map((tpl) => {
                                    const status = getStatus(tpl.id);
                                    const isSelected = selectedId === tpl.id;
                                    return (
                                        <li
                                            key={tpl.id}
                                            className={`template-picker-item${isSelected ? ' template-picker-item-selected' : ''}`}
                                            onClick={() => setSelectedId(tpl.id)}
                                            onDoubleClick={() => {
                                                setSelectedId(tpl.id);
                                                handleConfirm();
                                            }}
                                        >
                                            <div className="template-picker-item-main">
                                                <span className="template-picker-item-label">{tpl.label}</span>
                                                <span className="template-picker-item-meta">
                                                    {tpl.resolution} · {tpl.modality}
                                                    {tpl.sizeBytes ? ` · ${formatBytes(tpl.sizeBytes)}` : ''}
                                                </span>
                                            </div>
                                            <div className="template-picker-item-status">
                                                {status.kind === 'ready' && (
                                                    <span className="status-pill status-ready">cached</span>
                                                )}
                                                {status.kind === 'fetching' && (
                                                    <span className="status-pill status-fetching">fetching…</span>
                                                )}
                                                {status.kind === 'error' && (
                                                    <span className="status-pill status-error" title={status.message}>
                                                        error
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </section>
                    ))}
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleConfirm} disabled={!selectedId}>
                    Select
                </Button>
            </Modal.Footer>
        </Modal>
    );
}

export default StandardTemplatePickerModal;
