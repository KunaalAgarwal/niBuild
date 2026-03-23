import { useMemo } from 'react';
import { Form } from 'react-bootstrap';
import { getActiveOperations } from '../utils/getActiveOperations.js';

/**
 * Compact reorderable list of enabled fslmaths operations.
 * Shows only when the tool is orderSensitive and >= 2 operations are active.
 */
const OperationOrderPanel = ({ allParams, paramValues, wiredInputs, operationOrder, onOrderChange }) => {
    // Determine which operations are "active", sorted by user's operationOrder
    const activeOps = useMemo(() => {
        const active = getActiveOperations(allParams, paramValues, wiredInputs, operationOrder);
        const orderIndex = new Map(operationOrder.map((name, i) => [name, i]));
        return active.sort((a, b) => {
            const ai = orderIndex.has(a.name) ? orderIndex.get(a.name) : 1000 + (a.position ?? 99);
            const bi = orderIndex.has(b.name) ? orderIndex.get(b.name) : 1000 + (b.position ?? 99);
            return ai - bi;
        });
    }, [allParams, paramValues, wiredInputs, operationOrder]);

    // Don't render if fewer than 2 active operations
    if (activeOps.length < 2) return null;

    const moveUp = (idx) => {
        if (idx === 0) return;
        const names = activeOps.map((p) => p.name);
        [names[idx - 1], names[idx]] = [names[idx], names[idx - 1]];
        onOrderChange(names);
    };

    const moveDown = (idx) => {
        if (idx === activeOps.length - 1) return;
        const names = activeOps.map((p) => p.name);
        [names[idx], names[idx + 1]] = [names[idx + 1], names[idx]];
        onOrderChange(names);
    };

    const formatValue = (param) => {
        // Show wired source for file inputs
        const wiredSources = wiredInputs?.get(param.name) || [];
        if (wiredSources.length > 0) {
            const src = wiredSources[0];
            return `${src.sourceNodeLabel}`;
        }
        const val = paramValues[param.name];
        if (val === undefined || val === null || val === '' || val === false || val === true) return '';
        if (typeof val === 'number') return String(val);
        if (typeof val === 'string' && val.length > 12) return val.slice(0, 12) + '\u2026';
        return String(val);
    };

    return (
        <Form.Group className="operation-order-group">
            <Form.Label className="modal-label" style={{ marginBottom: 6 }}>
                Operation Order
            </Form.Label>
            <div className="operation-order-list">
                {activeOps.map((param, idx) => (
                    <div key={param.name} className="operation-order-item">
                        <span className="operation-order-pos">{idx + 1}</span>
                        <span className="operation-order-flag">{param.flag}</span>
                        <span className="operation-order-label">{param.label}</span>
                        <span className="operation-order-value">{formatValue(param)}</span>
                        <span className="operation-order-arrows">
                            <button
                                className="operation-order-arrow"
                                onClick={() => moveUp(idx)}
                                disabled={idx === 0}
                                title="Move up"
                            >
                                {'\u25B2'}
                            </button>
                            <button
                                className="operation-order-arrow"
                                onClick={() => moveDown(idx)}
                                disabled={idx === activeOps.length - 1}
                                title="Move down"
                            >
                                {'\u25BC'}
                            </button>
                        </span>
                    </div>
                ))}
            </div>
            <div className="operation-order-help">
                Operations are applied left-to-right on the command line. Use arrows to reorder.
            </div>
        </Form.Group>
    );
};

export default OperationOrderPanel;
