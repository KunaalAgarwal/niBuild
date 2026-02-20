import { useState, useMemo, useRef, useContext, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { Modal, Form } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_IMAGES, DOCKER_TAGS, annotationByName } from '../utils/toolAnnotations.js';
import { EXPRESSION_TEMPLATES } from '../utils/expressionTemplates.js';
import TagDropdown from './TagDropdown.jsx';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import '../styles/workflowItem.css';

// Map DOCKER_IMAGES keys to DOCKER_TAGS keys
const VALID_OPERATORS = ['==', '!=', '>=', '<=', '>', '<'];

const LIBRARY_MAP = {
    fsl: 'FSL',
    afni: 'AFNI',
    ants: 'ANTs',
    freesurfer: 'FreeSurfer',
    mrtrix3: 'MRtrix3',
    fmriprep: 'fMRIPrep',
    mriqc: 'MRIQC',
    connectome_workbench: 'Connectome Workbench',
    amico: 'AMICO'
};

// Pre-computed inverse lookup: docker image base → DOCKER_TAGS key (O(1))
const IMAGE_TO_LIBRARY = new Map(
    Object.entries(DOCKER_IMAGES).map(([key, img]) => [img, LIBRARY_MAP[key]])
);

const getLibraryFromDockerImage = (dockerImage) => {
    const baseImage = dockerImage.split(':')[0];
    return IMAGE_TO_LIBRARY.get(baseImage) || null;
};

const NodeComponent = ({ data, id }) => {
    // Check if this is a dummy node early
    const isDummy = data.isDummy === true;

    // Check scatter propagation and source-node status
    const { propagatedIds, sourceNodeIds } = useContext(ScatterPropagationContext);
    const isScatterInherited = propagatedIds.has(id);
    const isSourceNode = sourceNodeIds.has(id);

    // Get wired input state from context
    const wiredContext = useContext(WiredInputsContext);
    const wiredInputs = wiredContext?.get(id) || new Map();

    const [showModal, setShowModal] = useState(false);
    const [paramValues, setParamValues] = useState({});
    const [dockerVersion, setDockerVersion] = useState(data.dockerVersion || 'latest');
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterEnabled, setScatterEnabled] = useState(data.scatterEnabled || false);
    const [linkMergeValues, setLinkMergeValues] = useState(data.linkMergeOverrides || {});
    const [whenParam, setWhenParam] = useState('');
    const [whenCondition, setWhenCondition] = useState('');
    const [whenTouched, setWhenTouched] = useState(false);
    const [expressionValues, setExpressionValues] = useState(data.expressions || {});
    const [expressionToggles, setExpressionToggles] = useState({});

    // Info tooltip state (hover to show, click to pin, click-outside to dismiss)
    const [showInfoTooltip, setShowInfoTooltip] = useState(false);
    const [infoTooltipPinned, setInfoTooltipPinned] = useState(false);
    const [infoTooltipPos, setInfoTooltipPos] = useState({ top: 0, left: 0 });
    const infoIconRef = useRef(null);

    // Get tool definition
    const tool = getToolConfigSync(data.label);
    const dockerImage = tool?.dockerImage || null;

    // All parameters split into required and optional
    const allParams = useMemo(() => {
        if (!tool) return { required: [], optional: [] };
        const required = Object.entries(tool.requiredInputs || {})
            .filter(([_, def]) => def.type !== 'record')
            .map(([name, def]) => ({ name, ...def }));
        const optional = Object.entries(tool.optionalInputs || {})
            .filter(([_, def]) => def.type !== 'record')
            .map(([name, def]) => ({ name, ...def }));
        return { required, optional };
    }, [tool]);

    // Validate conditional (when) expression
    const whenWarning = useMemo(() => {
        if (!whenParam) return null;
        const cond = whenCondition.trim();
        if (!cond) return whenTouched ? 'Enter a condition (e.g., == true)' : null;
        const hasOperator = VALID_OPERATORS.some(op => cond.startsWith(op));
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
    const knownTags = library ? (DOCKER_TAGS[library] || ['latest']) : ['latest'];

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
            const displayTags = knownTags.length > 4
                ? `${knownTags.slice(0, 4).join(', ')}...`
                : knownTags.join(', ');
            setVersionWarning(`Unknown tag. Known: ${displayTags}`);
        }
    };

    // Find tool info using pre-computed Map for O(1) lookup
    // (Previously O(L×C×T) triple-nested loop)
    const toolInfo = useMemo(() => {
        return annotationByName.get(data.label) || null;
    }, [data.label]);

    // Update a single parameter value
    const updateParam = (name, value) => {
        setParamValues(prev => ({ ...prev, [name]: value }));
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
        setLinkMergeValues(prev => ({ ...prev, [inputName]: value }));
    };

    // Shared fx toggle handler: clears expression value when turning off
    const handleToggleFx = (paramName) => {
        setExpressionToggles(prev => {
            const wasActive = prev[paramName];
            if (wasActive) {
                setExpressionValues(prevExpr => {
                    const next = { ...prevExpr };
                    delete next[paramName];
                    return next;
                });
            }
            return { ...prev, [paramName]: !wasActive };
        });
    };

    // Shared renderer for param inline controls (used by both required and optional sections)
    const renderParamControl = (param) => {
        const isFileType = param.type === 'File' || param.type === 'Directory';

        if (isFileType) {
            // File/Directory: only fx toggle in the header; source info renders in card body
            return (
                <div className="param-control">
                    <span
                        className={`expression-toggle${expressionToggles[param.name] ? ' active' : ''}`}
                        onClick={() => handleToggleFx(param.name)}
                        title={expressionToggles[param.name] ? 'Switch to value mode' : 'Switch to expression mode'}
                    >fx</span>
                </div>
            );
        }

        // Expression toggle: when active, show expression input instead of value control
        const isExpressionMode = expressionToggles[param.name] || false;

        if (isExpressionMode) {
            // Expression mode: only fx toggle in the header; input + template render in card body
            return (
                <div className="param-control">
                    <span className="expression-toggle active" onClick={() => handleToggleFx(param.name)} title="Switch to value mode">fx</span>
                </div>
            );
        }

        // Value mode: normal scalar controls with fx toggle button
        const control = param.type === 'boolean' ? (
            <Form.Check
                type="switch"
                id={`param-${id}-${param.name}`}
                checked={paramValues[param.name] === true}
                onChange={(e) => updateParam(param.name, e.target.checked)}
                className="param-switch"
            />
        ) : param.options ? (
            <Form.Select
                size="sm"
                className={`param-select${paramValues[param.name] != null && paramValues[param.name] !== '' ? ' filled' : ''}`}
                value={paramValues[param.name] ?? ''}
                onChange={(e) => updateParam(param.name, e.target.value || null)}
            >
                <option value="">-- default --</option>
                {param.options.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </Form.Select>
        ) : (param.type === 'int' || param.type === 'double' || param.type === 'float' || param.type === 'long') ? (
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
                        updateParam(param.name, param.type === 'int' || param.type === 'long' ? parseInt(val, 10) : parseFloat(val));
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
                    <span className="expression-toggle" onClick={() => handleToggleFx(param.name)} title="Switch to expression mode">fx</span>
                    {control}
                </div>
            </div>
        );
    };

    const handleOpenModal = () => {
        // Auto-enable scatter toggle if inherited from upstream (non-source node)
        if (!isSourceNode && isScatterInherited && !scatterEnabled) {
            setScatterEnabled(true);
        }

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

        // Initialize paramValues from saved data (object or legacy JSON string)
        const existing = data.parameters;
        if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
            setParamValues({ ...existing });
        } else if (typeof existing === 'string' && existing.trim()) {
            try { setParamValues(JSON.parse(existing)); } catch { setParamValues({}); }
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

            data.onSaveParameters({
                params: paramValues,
                dockerVersion: finalDockerVersion,
                scatterEnabled: scatterEnabled,
                linkMergeOverrides: linkMergeValues,
                whenExpression: whenParam && whenCondition.trim() && !whenWarning
                    ? `$(inputs.${whenParam} ${whenCondition.trim()})`
                    : '',
                expressions: cleanedExpressions,
            });
        }

        setShowModal(false);
    };

    // Info tooltip: hover to show, click to pin, click-outside to dismiss
    const infoTooltipRef = useRef(null);

    const updateInfoPosition = () => {
        if (infoIconRef.current) {
            const rect = infoIconRef.current.getBoundingClientRect();
            setInfoTooltipPos({ top: rect.top + rect.height / 2, left: rect.right + 10 });
        }
    };

    const handleInfoMouseEnter = () => {
        if (toolInfo) {
            updateInfoPosition();
            setShowInfoTooltip(true);
        }
    };

    const handleInfoMouseLeave = () => {
        if (!infoTooltipPinned) setShowInfoTooltip(false);
    };

    const handleInfoClick = useCallback((e) => {
        e.stopPropagation();
        if (infoTooltipPinned) {
            setInfoTooltipPinned(false);
            setShowInfoTooltip(false);
        } else {
            updateInfoPosition();
            setShowInfoTooltip(true);
            setInfoTooltipPinned(true);
        }
    }, [infoTooltipPinned]);

    // Close pinned tooltip when clicking outside
    useEffect(() => {
        if (!infoTooltipPinned) return;
        const handleClickOutside = (e) => {
            if (
                infoIconRef.current?.contains(e.target) ||
                infoTooltipRef.current?.contains(e.target)
            ) return;
            setInfoTooltipPinned(false);
            setShowInfoTooltip(false);
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [infoTooltipPinned]);

    // Render simplified UI for dummy nodes (no decoration)
    if (isDummy) {
        return (
            <div className="node-wrapper">
                <div className="node-content">
                    <Handle type="target" position={Position.Top} />
                    <span className="node-label">{data.label}</span>
                    <Handle type="source" position={Position.Bottom} />
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="node-wrapper" onDoubleClick={handleOpenModal}>
                <div className="node-top-row">
                    {dockerImage ? (
                        <span className="node-version">{dockerVersion}</span>
                    ) : (
                        <span className="node-version-spacer"></span>
                    )}
                    <span className="handle-label">IN</span>
                    <span className="node-params-btn" onClick={handleOpenModal}>Params</span>
                </div>

                <div onDoubleClick={handleOpenModal} className="node-content">
                    <Handle type="target" position={Position.Top} />
                    <span className="node-label">{data.label}</span>
                    <Handle type="source" position={Position.Bottom} />
                </div>

                <div className="node-bottom-row">
                    <span className="node-bottom-left">
                        {isScatterInherited && <span className="node-scatter-badge">&#x21BB;</span>}
                        {data.whenExpression && <span className="node-when-badge">?</span>}
                        {data.expressions && Object.keys(data.expressions).length > 0 && <span className="node-fx-badge">fx</span>}
                    </span>
                    <span className="handle-label">OUT</span>
                    {toolInfo ? (
                        <span
                            ref={infoIconRef}
                            className="node-info-btn"
                            onMouseEnter={handleInfoMouseEnter}
                            onMouseLeave={handleInfoMouseLeave}
                            onClick={handleInfoClick}
                        >Info</span>
                    ) : (
                        <span className="node-info-spacer"></span>
                    )}
                </div>
            </div>

            {/* Info Tooltip (same style as workflowMenuItem) */}
            {showInfoTooltip && toolInfo && createPortal(
                <div
                    ref={infoTooltipRef}
                    className="workflow-tooltip"
                    style={{
                        top: infoTooltipPos.top,
                        left: infoTooltipPos.left,
                        transform: 'translateY(-50%)'
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
                document.body
            )}

            <Modal
                show={showModal}
                onHide={handleCloseModal}
                centered
                className="custom-modal"
                size="lg"
            >
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
                                <Form.Label className="modal-label">
                                    Docker Image
                                </Form.Label>
                                <TagDropdown
                                    value={dockerVersion}
                                    onChange={setDockerVersion}
                                    onBlur={() => validateDockerVersion(dockerVersion)}
                                    tags={knownTags}
                                    placeholder="latest"
                                    isValid={versionValid}
                                    prefix={`${dockerImage}:`}
                                />
                                {versionWarning && (
                                    <div className="docker-warning-text">{versionWarning}</div>
                                )}
                                <div className="docker-help-text">
                                    Select a tag or enter a custom version
                                </div>
                            </Form.Group>
                        )}

                        {/* Scatter Toggle */}
                        <Form.Group className="scatter-toggle-group">
                            <div className="scatter-toggle-row">
                                <Form.Label className="modal-label" style={{ marginBottom: 0 }}>
                                    Scatter (Batch Processing)
                                </Form.Label>
                                <Form.Check
                                    type="switch"
                                    id={`scatter-toggle-${id}`}
                                    checked={scatterEnabled}
                                    onChange={(e) => setScatterEnabled(e.target.checked)}
                                    disabled={!isSourceNode}
                                    className="scatter-switch"
                                />
                            </div>
                            <div className="scatter-help-text">
                                {!isSourceNode
                                    ? 'Scatter can only be enabled on source nodes (nodes with no incoming connections). Downstream nodes inherit scatter automatically from upstream.'
                                    : 'Run this step once per input file instead of once total. Enable on the first node to batch-process multiple subjects \u2014 the exported CWL will loop over every file in the input array. Downstream nodes inherit scatter automatically.'}
                            </div>
                        </Form.Group>

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
                                    onChange={(e) => { setWhenParam(e.target.value); if (!e.target.value) setWhenCondition(''); }}
                                >
                                    <option value="">None</option>
                                    {[...allParams.required, ...allParams.optional].map(p => (
                                        <option key={p.name} value={p.name}>{p.name}</option>
                                    ))}
                                </Form.Select>
                                {whenParam && (
                                    <Form.Control
                                        type="text"
                                        size="sm"
                                        className={`when-condition-input${whenCondition.trim() ? ' filled' : ''}${whenWarning ? ' invalid' : ''}`}
                                        placeholder="== true"
                                        value={whenCondition}
                                        onChange={(e) => { setWhenCondition(e.target.value); setWhenTouched(true); }}
                                        onBlur={() => setWhenTouched(true)}
                                    />
                                )}
                            </div>
                            {whenParam && whenCondition.trim() && !whenWarning && (
                                <div className="when-preview">
                                    $(inputs.{whenParam} {whenCondition.trim()})
                                </div>
                            )}
                            {whenWarning && (
                                <div className="when-warning-text">{whenWarning}</div>
                            )}
                            <div className="when-help-text">
                                Select an input parameter, then write a condition (e.g., == true, &gt; 0.5, != null).
                                Step only runs when the condition is true. Skipped steps produce null outputs.
                            </div>
                        </Form.Group>

                        {/* Unified Parameter Pane */}
                        <div className="params-scroll">
                            {/* Required & Optional Parameters (shared rendering) */}
                            {[
                                { params: allParams.required, label: 'Required' },
                                { params: allParams.optional, label: 'Optional' },
                            ].map(({ params: sectionParams, label: sectionLabel }) =>
                                sectionParams.length > 0 && (
                                    <div key={sectionLabel} className="param-section">
                                        <div className="param-section-header">{sectionLabel}</div>
                                        {sectionParams.map((param) => {
                                            const wiredSources = wiredInputs.get(param.name) || [];
                                            const isFileType = param.type === 'File' || param.type === 'Directory';
                                            return (
                                                <div key={param.name} className={`param-card ${isFileType && wiredSources.length > 0 ? 'input-wired' : ''} ${expressionValues[param.name] ? 'has-expression' : ''}`}>
                                                    <div className="param-card-header">
                                                        <span className="param-name">{param.name}</span>
                                                        <span className="param-type-badge">{param.type}</span>
                                                        {renderParamControl(param)}
                                                    </div>
                                                    {isFileType && wiredSources.length === 1 && (
                                                        <div className="input-source-single">
                                                            <span className="input-source">
                                                                from {wiredSources[0].sourceNodeLabel} / {wiredSources[0].sourceOutput}
                                                            </span>
                                                        </div>
                                                    )}

                                                    {isFileType && wiredSources.length > 1 && (
                                                        <div className="input-source-multi-details">
                                                            <div className="input-source-multi-row">
                                                                <div className="input-source-multi-sources">
                                                                    {wiredSources.map((src, i) => (
                                                                        <span key={i} className="input-source input-source-detail">
                                                                            {src.sourceNodeLabel} / {src.sourceOutput}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <Form.Select
                                                                    size="sm"
                                                                    className="link-merge-select"
                                                                    value={linkMergeValues[param.name] || 'merge_flattened'}
                                                                    onChange={(e) => updateLinkMerge(param.name, e.target.value)}
                                                                >
                                                                    <option value="merge_flattened">merge_flattened</option>
                                                                    <option value="merge_nested">merge_nested</option>
                                                                </Form.Select>
                                                            </div>
                                                            <div className="merge-help-text">
                                                                flattened combines all into one list [x1, x2] — nested preserves grouping per source [[x1], [x2]]
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isFileType && expressionToggles[param.name] && (() => {
                                                        const exprVal = expressionValues[param.name] || '';
                                                        const exprWarning = expressionWarnings[param.name];
                                                        const fileTemplates = EXPRESSION_TEMPLATES.filter(t => t.applicableTypes.includes(param.type));
                                                        return (
                                                            <div className="expression-file-details">
                                                                <div className="expression-input-row">
                                                                    <Form.Control type="text" size="sm"
                                                                        className={`expression-input${exprVal ? ' filled' : ''}${exprWarning ? ' invalid' : ''}`}
                                                                        placeholder="self.nameroot"
                                                                        value={exprVal}
                                                                        onChange={(e) => setExpressionValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                                                    />
                                                                    {fileTemplates.length > 0 && (
                                                                        <Form.Select size="sm" className="expression-template-select"
                                                                            value={fileTemplates.find(t => t.expression === exprVal)?.expression || ''}
                                                                            onChange={(e) => { if (e.target.value) setExpressionValues(prev => ({ ...prev, [param.name]: e.target.value })); }}>
                                                                            <option value="">Templates</option>
                                                                            {fileTemplates.map(t => (
                                                                                <option key={t.label} value={t.expression} title={t.description}>{t.label}</option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    )}
                                                                </div>
                                                                {exprVal.trim() && !exprWarning && (
                                                                    <div className="expression-preview">valueFrom: $({exprVal.trim()})</div>
                                                                )}
                                                                {exprWarning && (
                                                                    <div className="expression-warning-text">{exprWarning}</div>
                                                                )}
                                                                <div className="expression-help-text">
                                                                    self is a {param.type} object — use self.nameroot, self.basename, self.dirname, self.path
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    {!isFileType && expressionToggles[param.name] && (() => {
                                                        const exprVal = expressionValues[param.name] || '';
                                                        const exprWarning = expressionWarnings[param.name];
                                                        const applicableTemplates = EXPRESSION_TEMPLATES.filter(
                                                            t => t.applicableTypes.includes(param.type)
                                                        );
                                                        return (
                                                            <div className="expression-scalar-details">
                                                                <div className="expression-input-row">
                                                                    <Form.Control type="text" size="sm"
                                                                        className={`expression-input${exprVal ? ' filled' : ''}${exprWarning ? ' invalid' : ''}`}
                                                                        placeholder={param.type === 'string' ? 'self.toUpperCase()' : 'self + 1'}
                                                                        value={exprVal}
                                                                        onChange={(e) => setExpressionValues(prev => ({ ...prev, [param.name]: e.target.value }))}
                                                                    />
                                                                    {applicableTemplates.length > 0 && (
                                                                        <Form.Select size="sm" className="expression-template-select"
                                                                            value={applicableTemplates.find(t => t.expression === exprVal)?.expression || ''}
                                                                            onChange={(e) => { if (e.target.value) setExpressionValues(prev => ({ ...prev, [param.name]: e.target.value })); }}>
                                                                            <option value="">Templates</option>
                                                                            {applicableTemplates.map(t => (
                                                                                <option key={t.label} value={t.expression} title={t.description}>{t.label}</option>
                                                                            ))}
                                                                        </Form.Select>
                                                                    )}
                                                                </div>
                                                                {exprVal.trim() && !exprWarning && (
                                                                    <div className="expression-preview">valueFrom: $({exprVal.trim()})</div>
                                                                )}
                                                                {exprWarning && (
                                                                    <div className="expression-warning-text">{exprWarning}</div>
                                                                )}
                                                                {isScatterInherited && (
                                                                    <div className="expression-scatter-note">
                                                                        In scatter mode, <code>self</code> receives one element per iteration.
                                                                    </div>
                                                                )}
                                                                <div className="expression-help-text">
                                                                    self is the parameter value ({param.type})
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                    {param.label && (
                                                        <div className="param-description">{param.label}</div>
                                                    )}
                                                    {param.bounds && (
                                                        <div className="param-bounds">bounds: {param.bounds[0]} – {param.bounds[1]}</div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
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

export default NodeComponent;
