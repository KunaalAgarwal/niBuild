import { Form } from 'react-bootstrap';
import { EXPRESSION_TEMPLATES } from '../utils/expressionTemplates.js';

/**
 * Shared inline expression editor for CWL valueFrom expressions.
 * Used in both NodeComponent (regular tool params) and CustomWorkflowParamPanel (internal nodes).
 *
 * @param {Object} props
 * @param {string}  props.paramName  - Parameter name (key into expressionValues)
 * @param {string}  props.paramType  - CWL type string (e.g. 'File', 'string', 'int')
 * @param {boolean} props.isFileType - Whether the parameter is a File/Directory type
 * @param {string}  props.value      - Current bare expression value
 * @param {function} props.onChange   - (newValue: string) => void
 * @param {string}  [props.warning]  - Validation warning to display
 * @param {boolean} [props.isScattered] - Show scatter-mode note (scalar only)
 * @param {boolean} [props.showHelpText] - Show help text below expression
 */
const ExpressionEditor = ({
    paramName,
    paramType,
    isFileType,
    value,
    onChange,
    warning,
    isScattered,
    showHelpText,
}) => {
    const templates = EXPRESSION_TEMPLATES.filter((t) => t.applicableTypes.includes(paramType));
    const exprVal = value || '';

    return (
        <div className={isFileType ? 'expression-file-details' : 'expression-scalar-details'}>
            <div className="expression-input-row">
                <Form.Control
                    type="text"
                    size="sm"
                    className={`expression-input${exprVal ? ' filled' : ''}${warning ? ' invalid' : ''}`}
                    placeholder={
                        isFileType
                            ? 'self.nameroot'
                            : paramType === 'string' || paramType === 'enum'
                              ? 'self.toUpperCase()'
                              : 'self + 1'
                    }
                    value={exprVal}
                    onChange={(e) => onChange(e.target.value)}
                />
                {templates.length > 0 && (
                    <Form.Select
                        size="sm"
                        className="expression-template-select"
                        value={templates.find((t) => t.expression === exprVal)?.expression || ''}
                        onChange={(e) => {
                            if (e.target.value) onChange(e.target.value);
                        }}
                    >
                        <option value="">Templates</option>
                        {templates.map((t) => (
                            <option key={t.label} value={t.expression} title={t.description}>
                                {t.label}
                            </option>
                        ))}
                    </Form.Select>
                )}
            </div>
            {exprVal.trim() && !warning && <div className="expression-preview">valueFrom: $({exprVal.trim()})</div>}
            {warning && <div className="expression-warning-text">{warning}</div>}
            {!isFileType && isScattered && (
                <div className="expression-scatter-note">
                    In scatter mode, <code>self</code> receives one element per iteration.
                </div>
            )}
            {showHelpText && (
                <div className="expression-help-text">
                    {isFileType
                        ? `self is a ${paramType} object — use self.nameroot, self.basename, self.dirname, self.path`
                        : `self is the parameter value (${paramType})`}
                </div>
            )}
        </div>
    );
};

export default ExpressionEditor;
