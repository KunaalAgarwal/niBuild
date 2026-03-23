import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { Modal, Form } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_TAGS, annotationByName } from '../utils/toolAnnotations.js';
import { getActiveOperations } from '../utils/getActiveOperations.js';
import ExpressionEditor from './ExpressionEditor.jsx';
import { VALID_OPERATORS, getLibraryFromDockerImage } from '../utils/cwlConstants.js';
import TagDropdown from './TagDropdown.jsx';
import ParamControl from './ParamControl.jsx';
import OperationOrderPanel from './OperationOrderPanel.jsx';
import { usePinnableTooltip } from '../hooks/usePinnableTooltip.js';
import { labelFontSize } from './nodeUtils.js';

/**
 * Renders regular tool nodes with parameter modal, scatter, conditional, and expression support.
 */
const ToolNodeComponent = ({ data, id, isScatterInherited, isGatherNode, upstreamScatterInputs, wiredInputs }) => {
    const [showModal, setShowModal] = useState(false);
    const [paramValues, setParamValues] = useState({});
    const [dockerVersion, setDockerVersion] = useState(data.dockerVersion || 'latest');
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterToggles, setScatterToggles] = useState({});
    const [scatterMethod, setScatterMethod] = useState('dotproduct');
    const [linkMergeValues, setLinkMergeValues] = useState(data.linkMergeOverrides || {});
    const [whenParam, setWhenParam] = useState('');
    const [whenCondition, setWhenCondition] = useState('');
    const [whenTouched, setWhenTouched] = useState(false);
    const [expressionValues, setExpressionValues] = useState(data.expressions || {});
    const [expressionToggles, setExpressionToggles] = useState({});
    const [operationOrder, setOperationOrder] = useState(data.operationOrder || []);

    const infoTip = usePinnableTooltip();

    // Get tool definition
    const tool = getToolConfigSync(data.label);
    const dockerImage = tool?.dockerImage || null;

    // All parameters split into required and optional
    const allParams = useMemo(() => {
        if (!tool) return { required: [], optional: [] };
        const required = Object.entries(tool.requiredInputs || {}).map(([name, def]) => ({ name, ...def }));
        const optional = Object.entries(tool.optionalInputs || {}).map(([name, def]) => ({ name, ...def }));
        return { required, optional };
    }, [tool]);

    // Used to disable the "+" toggle buttons when the panel wouldn't be visible (< 2 active ops).
    const orderPanelVisible = useMemo(() => {
        if (!tool?.orderSensitive) return false;
        const all = [...allParams.required, ...allParams.optional];
        return getActiveOperations(all, paramValues, wiredInputs, operationOrder).length >= 2;
    }, [tool, allParams, paramValues, wiredInputs, operationOrder]);

    // Validate conditional (when) expression
    const whenWarning = useMemo(() => {
        if (!whenParam) return null;
        const cond = whenCondition.trim();
        if (!cond) return whenTouched ? 'Enter a condition (e.g., == true)' : null;
        const hasOperator = VALID_OPERATORS.some((op) => cond.startsWith(op));
        if (!hasOperator) return `Condition should start with an operator: ${VALID_OPERATORS.join(', ')}`;
        const afterOp = cond.replace(/^(==|!=|>=|<=|>|<)\s*/, '');
        if (!afterOp) return 'Missing value after operator';
        return null;
    }, [whenParam, whenCondition, whenTouched]);

    // Validate fx expressions (bare expressions without $() wrapper)
    const expressionWarnings = useMemo(() => {
        const warnings = {};
        Object.entries(expressionValues).forEach(([name, expr]) => {
            if (!expr?.trim()) return;
            const trimmed = expr.trim();
            const opens = (trimmed.match(/\(/g) || []).length;
            const closes = (trimmed.match(/\)/g) || []).length;
            if (opens !== closes) warnings[name] = 'Unmatched parentheses';
        });
        return warnings;
    }, [expressionValues]);

    // Get known tags for this tool's docker image
    const library = dockerImage ? getLibraryFromDockerImage(dockerImage) : null;
    const knownTags = library ? DOCKER_TAGS[library] || ['latest'] : ['latest'];

    // Validate docker version against known tags
    const validateDockerVersion = (version) => {
        const trimmed = version.trim();
        if (!trimmed || trimmed === 'latest') {
            setVersionValid(true);
            setVersionWarning('');
            return;
        }

        if (knownTags.includes(trimmed)) {
            setVersionValid(true);
            setVersionWarning('');
        } else {
            setVersionValid(false);
            const displayTags = knownTags.length > 4 ? `${knownTags.slice(0, 4).join(', ')}...` : knownTags.join(', ');
            setVersionWarning(`Unknown tag. Known: ${displayTags}`);
        }
    };

    // Find tool info using pre-computed Map for O(1) lookup
    const toolInfo = useMemo(() => {
        return annotationByName.get(data.label) || null;
    }, [data.label]);

    // Update a single param value
    const updateParam = (name, value) => {
        setParamValues((prev) => ({ ...prev, [name]: value }));
    };

    // Clamp numeric value to bounds on blur
    const clampToBounds = (name, param) => {
        const val = paramValues[name];
        if (val === null || val === undefined || !param.bounds) return;
        const [min, max] = param.bounds;
        if (val < min) updateParam(name, min);
        else if (val > max) updateParam(name, max);
    };

    // Helper to update linkMerge override for a specific input
    const updateLinkMerge = (inputName, value) => {
        setLinkMergeValues((prev) => ({ ...prev, [inputName]: value }));
    };

    // Scatter toggle handler: toggles a parameter for scatter
    const handleToggleScatter = (paramName) => {
        setScatterToggles((prev) => ({ ...prev, [paramName]: !prev[paramName] }));
    };

    // Shared fx toggle handler: clears expression value when turning off
    const handleToggleFx = (paramName) => {
        setExpressionToggles((prev) => {
            const wasActive = prev[paramName];
            if (wasActive) {
                setExpressionValues((prevExpr) => {
                    const next = { ...prevExpr };
                    delete next[paramName];
                    return next;
                });
            }
            return { ...prev, [paramName]: !wasActive };
        });
    };

    // Build scatter button for a param (context-specific logic stays here)
    const buildScatterButton = (param) => {
        const isScatterLocked = upstreamScatterInputs.has(param.name);
        const isGatherLocked =
            isGatherNode && param.type?.endsWith('[]') && (wiredInputs.get(param.name) || []).length > 0;
        const isLocked = isScatterLocked || isGatherLocked;
        return (
            <span
                className={`scatter-toggle${scatterToggles[param.name] ? ' active' : ''}${isLocked ? ' locked' : ''}`}
                onClick={isLocked ? undefined : () => handleToggleScatter(param.name)}
                title={
                    isGatherLocked
                        ? 'This input gathers scattered outputs into an array'
                        : isScatterLocked
                          ? 'Inherited from upstream scatter'
                          : scatterToggles[param.name]
                            ? 'Remove from scatter'
                            : 'Add to scatter'
                }
            >
                {'\u21BB'}
            </span>
        );
    };

    // Toggle a file parameter in/out of the operation order (for orderSensitive tools)
    const toggleFileInOrder = (name) => {
        setOperationOrder((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    };

    const handleOpenModal = () => {
        // Initialize scatter toggles from saved scatterInputs or auto-suggest from upstream
        const scatterInit = {};
        const savedScatter = data.scatterInputs || [];
        savedScatter.forEach((name) => {
            scatterInit[name] = true;
        });
        upstreamScatterInputs.forEach((name) => {
            scatterInit[name] = true;
        });
        setScatterToggles(scatterInit);
        setScatterMethod(data.scatterMethod || 'dotproduct');

        // Initialize linkMergeOverrides, whenExpression, and expressions from saved data
        setLinkMergeValues(data.linkMergeOverrides || {});
        const whenExpr = data.whenExpression || '';
        const whenMatch = whenExpr.match(/^\$\(inputs\.(\w+)\s+(.*)\)$/);
        if (whenMatch) {
            setWhenParam(whenMatch[1]);
            setWhenCondition(whenMatch[2]);
        } else {
            setWhenParam('');
            setWhenCondition('');
        }
        setWhenTouched(false);
        // Strip $() wrapper from saved expressions for display (user types bare expressions)
        const savedExpressions = data.expressions || {};
        const displayExpressions = {};
        const toggles = {};
        Object.entries(savedExpressions).forEach(([k, v]) => {
            if (v) {
                const match = v.match(/^\$\((.*)\)$/s);
                displayExpressions[k] = match ? match[1] : v;
                toggles[k] = true;
            }
        });
        setExpressionValues(displayExpressions);
        setExpressionToggles(toggles);

        // Initialize operationOrder from saved data
        setOperationOrder(data.operationOrder || []);

        // Initialize paramValues from saved data (object or legacy JSON string)
        const existing = data.parameters;
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            setParamValues({ ...existing });
        } else if (typeof existing === 'string' && existing.trim()) {
            try {
                setParamValues(JSON.parse(existing));
            } catch {
                setParamValues({});
            }
        } else {
            setParamValues({});
        }

        setShowModal(true);
    };

    const handleCloseModal = () => {
        // Default to 'latest' if docker version is empty
        const finalDockerVersion = dockerVersion.trim() || 'latest';
        if (finalDockerVersion !== dockerVersion) {
            setDockerVersion(finalDockerVersion);
        }

        if (typeof data.onSaveParameters === 'function') {
            // Clean expressions: remove empty values and wrap in $()
            const cleanedExpressions = {};
            Object.entries(expressionValues).forEach(([k, v]) => {
                if (v && v.trim()) {
                    const trimmed = v.trim();
                    cleanedExpressions[k] = trimmed.startsWith('$(') ? trimmed : `$(${trimmed})`;
                }
            });

            const validInputNames = new Set([
                ...Object.keys(tool?.requiredInputs || {}),
                ...Object.keys(tool?.optionalInputs || {}),
            ]);
            const activeScatterInputs = Object.entries(scatterToggles)
                .filter(([name, active]) => active && validInputNames.has(name))
                .map(([name]) => name);

            data.onSaveParameters({
                params: paramValues,
                dockerVersion: finalDockerVersion,
                scatterInputs: activeScatterInputs,
                scatterMethod: activeScatterInputs.length > 1 ? scatterMethod : undefined,
                linkMergeOverrides: linkMergeValues,
                whenExpression:
                    whenParam && whenCondition.trim() && !whenWarning
                        ? `$(inputs.${whenParam} ${whenCondition.trim()})`
                        : '',
                expressions: cleanedExpressions,
                operationOrder: tool?.orderSensitive ? operationOrder : undefined,
            });
        }

        setShowModal(false);
    };

    return (
        <>
            <div className="node-wrapper" onDoubleClick={handleOpenModal}>
                <div className="node-top-row">
                    {dockerImage ? (
                        <span className="node-version">{dockerVersion}</span>
                    ) : (
                        <span className="node-version-spacer"></span>
                    )}
                    <span className="node-params-btn" onClick={handleOpenModal}>
                        Params
                    </span>
                </div>

                <div onDoubleClick={handleOpenModal} className="node-content">
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
                        {isScatterInherited && <span className="node-scatter-badge">&#x21BB;</span>}
                        {isGatherNode && <span className="node-gather-badge">G</span>}
                        {data.whenExpression && <span className="node-when-badge">?</span>}
                        {data.expressions && Object.keys(data.expressions).length > 0 && (
                            <span className="node-fx-badge">fx</span>
                        )}
                    </span>
                    {toolInfo ? (
                        <span
                            ref={infoTip.iconRef}
                            className="node-info-btn"
                            onMouseEnter={infoTip.onMouseEnter}
                            onMouseLeave={infoTip.onMouseLeave}
                            onClick={infoTip.onClick}
                        >
                            Info
                        </span>
                    ) : (
                        <span className="node-info-spacer"></span>
                    )}
                </div>
            </div>

            {/* Info Tooltip (same style as workflowMenuItem) */}
            {infoTip.show &&
                toolInfo &&
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
                        {toolInfo.fullName && (
                            <div className="tooltip-section tooltip-fullname">
                                <span className="tooltip-text">{toolInfo.fullName}</span>
                            </div>
                        )}
                        <div className="tooltip-section">
                            <span className="tooltip-label">Function:</span>
                            <span className="tooltip-text">{toolInfo.function}</span>
                        </div>
                        {toolInfo.modality && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Expected Input:</span>
                                <span className="tooltip-text">{toolInfo.modality}</span>
                            </div>
                        )}
                        {toolInfo.keyParameters && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Key Parameters:</span>
                                <span className="tooltip-text">{toolInfo.keyParameters}</span>
                            </div>
                        )}
                        {toolInfo.keyPoints && (
                            <div className="tooltip-section">
                                <span className="tooltip-label">Key Points:</span>
                                <span className="tooltip-text">{toolInfo.keyPoints}</span>
                            </div>
                        )}
                        <div className="tooltip-section">
                            <span className="tooltip-label">Typical Use:</span>
                            <span className="tooltip-text">{toolInfo.typicalUse}</span>
                        </div>
                    </div>,
                    document.body,
                )}

            <Modal show={showModal} onHide={handleCloseModal} centered className="custom-modal" size="lg">
                <Modal.Header>
                    <Modal.Title style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1rem' }}>
                        {data.label} - Parameters
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body onClick={(e) => e.stopPropagation()}>
                    <Form>
                        {/* Docker Version Input */}
                        {dockerImage && (
                            <Form.Group className="docker-version-group">
                                <Form.Label className="modal-label">Docker Image</Form.Label>
                                <TagDropdown
                                    value={dockerVersion}
                                    onChange={setDockerVersion}
                                    onBlur={() => validateDockerVersion(dockerVersion)}
                                    tags={knownTags}
                                    placeholder="latest"
                                    isValid={versionValid}
                                    prefix={`${dockerImage}:`}
                                />
                                {versionWarning && <div className="docker-warning-text">{versionWarning}</div>}
                                <div className="docker-help-text">Select a tag or enter a custom version</div>
                            </Form.Group>
                        )}

                        {/* Conditional Expression Builder */}
                        <Form.Group className="when-expression-group">
                            <Form.Label className="modal-label" style={{ marginBottom: 6 }}>
                                Conditional (when)
                            </Form.Label>
                            <div className="when-builder-row">
                                <Form.Select
                                    size="sm"
                                    className="when-param-select"
                                    value={whenParam}
                                    onChange={(e) => {
                                        setWhenParam(e.target.value);
                                        if (!e.target.value) setWhenCondition('');
                                    }}
                                >
                                    <option value="">None</option>
                                    {[...allParams.required, ...allParams.optional].map((p) => (
                                        <option key={p.name} value={p.name}>
                                            {p.name}
                                        </option>
                                    ))}
                                </Form.Select>
                                {whenParam && (
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        className={`when-condition-input${whenCondition.trim() ? ' filled' : ''}${whenWarning ? ' invalid' : ''}`}
                                        placeholder="== true"
                                        value={whenCondition}
                                        onChange={(e) => {
                                            setWhenCondition(e.target.value);
                                            setWhenTouched(true);
                                        }}
                                        onBlur={() => setWhenTouched(true)}
                                    />
                                )}
                            </div>
                            {whenParam && whenCondition.trim() && !whenWarning && (
                                <div className="when-preview">
                                    $(inputs.{whenParam} {whenCondition.trim()})
                                </div>
                            )}
                            {whenWarning && <div className="when-warning-text">{whenWarning}</div>}
                            <div className="when-help-text">
                                Select an input parameter, then write a condition (e.g., == true, &gt; 0.5, != null).
                                Step only runs when the condition is true. Skipped steps produce null outputs.
                            </div>
                        </Form.Group>

                        {/* Operation ordering for tools like fslmaths */}
                        {tool?.orderSensitive && (
                            <OperationOrderPanel
                                allParams={[...allParams.required, ...allParams.optional]}
                                paramValues={paramValues}
                                wiredInputs={wiredInputs}
                                operationOrder={operationOrder}
                                onOrderChange={setOperationOrder}
                            />
                        )}

                        {/* Scatter Method (visible only when 2+ scatter inputs active) */}
                        {(() => {
                            const activeScatterCount = Object.values(scatterToggles).filter(Boolean).length;
                            return activeScatterCount > 1 ? (
                                <Form.Group className="scatter-method-group">
                                    <Form.Label className="modal-label" style={{ marginBottom: 6 }}>
                                        Scatter Method
                                    </Form.Label>
                                    <Form.Select
                                        size="sm"
                                        className="scatter-method-select"
                                        value={scatterMethod}
                                        onChange={(e) => setScatterMethod(e.target.value)}
                                    >
                                        <option value="dotproduct">dotproduct</option>
                                        <option value="flat_crossproduct">flat_crossproduct</option>
                                        <option value="nested_crossproduct">nested_crossproduct</option>
                                    </Form.Select>
                                    <div className="scatter-method-help-text">
                                        {scatterMethod === 'dotproduct' &&
                                            'Pairs elements 1:1 across inputs (arrays must be the same length). [A,B] \u00d7 [1,2] \u2192 (A,1), (B,2)'}
                                        {scatterMethod === 'flat_crossproduct' &&
                                            'Cartesian product of all inputs \u2014 results in a flat list. [A,B] \u00d7 [1,2] \u2192 (A,1), (A,2), (B,1), (B,2)'}
                                        {scatterMethod === 'nested_crossproduct' &&
                                            'Cartesian product \u2014 results nested by the first input. [A,B] \u00d7 [1,2] \u2192 [(A,1),(A,2)], [(B,1),(B,2)]'}
                                    </div>
                                </Form.Group>
                            ) : null;
                        })()}

                        {/* Unified Parameter Pane */}
                        <div className="params-scroll scrollbar-thin">
                            {/* Required & Optional Parameters (shared rendering) */}
                            {[
                                { params: allParams.required, label: 'Required' },
                                { params: allParams.optional, label: 'Optional' },
                            ].map(
                                ({ params: sectionParams, label: sectionLabel }) =>
                                    sectionParams.length > 0 && (
                                        <div key={sectionLabel} className="param-section">
                                            <div className="param-section-header">{sectionLabel}</div>
                                            {sectionParams.map((param) => {
                                                const wiredSources = wiredInputs.get(param.name) || [];
                                                const isFileType = /^(File|Directory)(\[\])?$/.test(param.type);
                                                return (
                                                    <div
                                                        key={param.name}
                                                        className={`param-card ${isFileType && wiredSources.length > 0 ? 'input-wired' : ''} ${expressionValues[param.name] ? 'has-expression' : ''} ${scatterToggles[param.name] ? 'has-scatter' : ''}`}
                                                    >
                                                        <div className="param-card-header">
                                                            <span className="param-name">{param.name}</span>
                                                            <span
                                                                className="param-type-badge"
                                                                title={
                                                                    param.enumSymbols?.length
                                                                        ? param.enumSymbols.join(', ')
                                                                        : param.options?.length
                                                                          ? param.options.join(', ')
                                                                          : param.type
                                                                }
                                                            >
                                                                {param.type}
                                                            </span>
                                                            <ParamControl
                                                                param={param}
                                                                paramValues={paramValues}
                                                                updateParam={updateParam}
                                                                clampToBounds={clampToBounds}
                                                                expressionToggles={expressionToggles}
                                                                handleToggleFx={handleToggleFx}
                                                                scatterButton={buildScatterButton(param)}
                                                                nodeId={id}
                                                            />
                                                            {tool?.orderSensitive &&
                                                                isFileType &&
                                                                wiredSources.length === 0 && (
                                                                    <span
                                                                        className={`operation-order-toggle ${operationOrder.includes(param.name) ? 'active' : ''}${!orderPanelVisible && !operationOrder.includes(param.name) ? ' disabled' : ''}`}
                                                                        onClick={
                                                                            !orderPanelVisible &&
                                                                            !operationOrder.includes(param.name)
                                                                                ? undefined
                                                                                : () => toggleFileInOrder(param.name)
                                                                        }
                                                                        title={
                                                                            !orderPanelVisible &&
                                                                            !operationOrder.includes(param.name)
                                                                                ? 'Set at least 2 operations before adding file inputs to the order'
                                                                                : operationOrder.includes(param.name)
                                                                                  ? 'Remove from operation order'
                                                                                  : 'Add to operation order'
                                                                        }
                                                                    >
                                                                        {operationOrder.includes(param.name)
                                                                            ? '\u2212'
                                                                            : '+'}
                                                                    </span>
                                                                )}
                                                        </div>
                                                        {isFileType && wiredSources.length === 1 && (
                                                            <div className="input-source-single">
                                                                <span className="input-source">
                                                                    from {wiredSources[0].sourceNodeLabel} /{' '}
                                                                    {wiredSources[0].sourceOutput}
                                                                    {upstreamScatterInputs.has(param.name)
                                                                        ? ' (scattered)'
                                                                        : ''}
                                                                </span>
                                                            </div>
                                                        )}

                                                        {isFileType && wiredSources.length > 1 && (
                                                            <div className="input-source-multi-details">
                                                                <div className="input-source-multi-row">
                                                                    <div className="input-source-multi-sources">
                                                                        {wiredSources.map((src, i) => (
                                                                            <span
                                                                                key={i}
                                                                                className="input-source input-source-detail"
                                                                            >
                                                                                {src.sourceNodeLabel} /{' '}
                                                                                {src.sourceOutput}
                                                                                {upstreamScatterInputs.has(param.name)
                                                                                    ? ' (scattered)'
                                                                                    : ''}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                    <Form.Select
                                                                        size="sm"
                                                                        className="link-merge-select"
                                                                        value={
                                                                            linkMergeValues[param.name] ||
                                                                            'merge_flattened'
                                                                        }
                                                                        onChange={(e) =>
                                                                            updateLinkMerge(param.name, e.target.value)
                                                                        }
                                                                    >
                                                                        <option value="merge_flattened">
                                                                            merge_flattened
                                                                        </option>
                                                                        <option value="merge_nested">
                                                                            merge_nested
                                                                        </option>
                                                                    </Form.Select>
                                                                </div>
                                                                <div className="merge-help-text">
                                                                    flattened combines all into one list [x1, x2] —
                                                                    nested preserves grouping per source [[x1], [x2]]
                                                                </div>
                                                            </div>
                                                        )}
                                                        {expressionToggles[param.name] && (
                                                            <ExpressionEditor
                                                                paramName={param.name}
                                                                paramType={param.type}
                                                                isFileType={isFileType}
                                                                value={expressionValues[param.name]}
                                                                onChange={(val) =>
                                                                    setExpressionValues((prev) => ({
                                                                        ...prev,
                                                                        [param.name]: val,
                                                                    }))
                                                                }
                                                                warning={expressionWarnings[param.name]}
                                                                isScattered={isScatterInherited}
                                                                showHelpText
                                                            />
                                                        )}
                                                        {param.label && (
                                                            <div className="param-description">{param.label}</div>
                                                        )}
                                                        {param.bounds && (
                                                            <div className="param-bounds">
                                                                bounds: {param.bounds[0]} – {param.bounds[1]}
                                                            </div>
                                                        )}
                                                        {param.hasDefault && (
                                                            <div className="param-default-hint">
                                                                default: {String(param.defaultValue)}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ),
                            )}

                            {/* Fallback for unknown tools */}
                            {!tool && (
                                <div className="param-section">
                                    <div className="param-section-header">Parameters</div>
                                    <div className="param-description" style={{ padding: '8px 0' }}>
                                        Tool not fully defined — parameters unavailable.
                                    </div>
                                </div>
                            )}
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default ToolNodeComponent;
