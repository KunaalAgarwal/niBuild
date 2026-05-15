import { Form } from 'react-bootstrap';

const isFileType = (type) => /^(File|Directory)(\[\])?$/.test(type);

/**
 * Shared parameter control renderer used by both ToolNodeComponent and
 * CustomWorkflowParamPanel. Renders the appropriate form control based on
 * param type (file, record, boolean, select, number, text) with expression
 * and scatter toggle support.
 */
const ParamControl = ({
    param,
    paramValues,
    updateParam,
    clampToBounds,
    expressionToggles,
    handleToggleFx,
    scatterButton,
    nodeId,
}) => {
    if (isFileType(param.type)) {
        return (
            <div className="param-control">
                {scatterButton}
                <span
                    className={`expression-toggle${expressionToggles[param.name] ? ' active' : ''}`}
                    onClick={() => handleToggleFx(param.name)}
                    title={expressionToggles[param.name] ? 'Switch to value mode' : 'Switch to expression mode'}
                >
                    fx
                </span>
            </div>
        );
    }

    // Record type: dropdown to select from mutually exclusive variants
    if (param.type === 'record' && param.recordVariants) {
        return (
            <div className="param-control">
                <Form.Select
                    size="sm"
                    className={`param-select${paramValues[param.name] != null && paramValues[param.name] !== '' ? ' filled' : ''}`}
                    value={paramValues[param.name] ?? ''}
                    onChange={(e) => updateParam(param.name, e.target.value || null)}
                >
                    <option value="">-- none --</option>
                    {param.recordVariants.map((v) => (
                        <option key={v.name} value={v.name}>
                            {v.fields?.[v.name]?.label || v.name}
                        </option>
                    ))}
                </Form.Select>
            </div>
        );
    }

    const isExpressionMode = expressionToggles[param.name] || false;

    if (isExpressionMode) {
        return (
            <div className="param-control">
                {scatterButton}
                <span
                    className="expression-toggle active"
                    onClick={() => handleToggleFx(param.name)}
                    title="Switch to value mode"
                >
                    fx
                </span>
            </div>
        );
    }

    // Value mode: normal scalar controls with fx toggle button
    const control =
        param.type === 'boolean' ? (
            <Form.Check
                type="switch"
                id={`param-${nodeId}-${param.name}`}
                checked={paramValues[param.name] === true}
                onChange={(e) => updateParam(param.name, e.target.checked)}
                className="param-switch"
            />
        ) : param.options ? (
            <Form.Select
                size="sm"
                className={`param-select${paramValues[param.name] != null && paramValues[param.name] !== '' ? ' filled' : ''}`}
                value={paramValues[param.name] ?? ''}
                onChange={(e) => {
                    const raw = e.target.value;
                    if (!raw) {
                        updateParam(param.name, null);
                        return;
                    }
                    if (param.type === 'int' || param.type === 'long') {
                        updateParam(param.name, parseInt(raw, 10));
                        return;
                    }
                    if (param.type === 'float' || param.type === 'double') {
                        updateParam(param.name, parseFloat(raw));
                        return;
                    }
                    updateParam(param.name, raw);
                }}
            >
                <option value="">-- default --</option>
                {param.options.map((opt) => (
                    <option key={opt} value={opt}>
                        {opt}
                    </option>
                ))}
            </Form.Select>
        ) : param.type === 'int' || param.type === 'double' || param.type === 'float' || param.type === 'long' ? (
            <Form.Control
                type="number"
                size="sm"
                className={`param-number${paramValues[param.name] != null && paramValues[param.name] !== '' ? ' filled' : ''}`}
                step={param.type === 'int' || param.type === 'long' ? 1 : 0.01}
                min={param.bounds ? param.bounds[0] : undefined}
                max={param.bounds ? param.bounds[1] : undefined}
                placeholder={param.bounds ? `${param.bounds[0]}..${param.bounds[1]}` : ''}
                value={paramValues[param.name] ?? ''}
                onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                        updateParam(param.name, null);
                    } else {
                        updateParam(
                            param.name,
                            param.type === 'int' || param.type === 'long' ? parseInt(val, 10) : parseFloat(val),
                        );
                    }
                }}
                onBlur={() => clampToBounds(param.name, param)}
            />
        ) : (
            <Form.Control
                type="text"
                size="sm"
                className={`param-text${paramValues[param.name] != null && paramValues[param.name] !== '' ? ' filled' : ''}`}
                value={paramValues[param.name] ?? ''}
                onChange={(e) => updateParam(param.name, e.target.value || null)}
            />
        );

    return (
        <div className="param-control">
            <div className="expression-row">
                {scatterButton}
                <span
                    className="expression-toggle"
                    onClick={() => handleToggleFx(param.name)}
                    title="Switch to expression mode"
                >
                    fx
                </span>
                {control}
            </div>
        </div>
    );
};

export default ParamControl;
