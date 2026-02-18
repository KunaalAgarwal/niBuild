import React, { useState, useMemo, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { Modal, Form } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_IMAGES, DOCKER_TAGS, annotationByName } from '../utils/toolAnnotations.js';
import TagDropdown from './TagDropdown.jsx';
import { ScatterPropagationContext } from '../context/ScatterPropagationContext.jsx';
import { WiredInputsContext } from '../context/WiredInputsContext.jsx';
import '../styles/workflowItem.css';

// Map DOCKER_IMAGES keys to DOCKER_TAGS keys
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

const getLibraryFromDockerImage = (dockerImage) => {
    const baseImage = dockerImage.split(':')[0];
    for (const [key, image] of Object.entries(DOCKER_IMAGES)) {
        if (image === baseImage) {
            return LIBRARY_MAP[key] || null;
        }
    }
    return null;
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
    const wiredInputs = wiredContext.get(id) || new Map();

    const [showModal, setShowModal] = useState(false);
    const [paramValues, setParamValues] = useState({});
    const [dockerVersion, setDockerVersion] = useState(data.dockerVersion || 'latest');
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterEnabled, setScatterEnabled] = useState(data.scatterEnabled || false);

    // Info tooltip state (hover only, like workflowMenuItem)
    const [showInfoTooltip, setShowInfoTooltip] = useState(false);
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

    // Shared renderer for param inline controls (used by both required and optional sections)
    const renderParamControl = (param, wiredInfo, isRequired) => {
        const isFileType = param.type === 'File' || param.type === 'Directory';

        if (isFileType) {
            // File/Directory: show wired source or runtime placeholder
            const content = wiredInfo ? (
                <span className="input-source">
                    from {wiredInfo.sourceNodeLabel} / {wiredInfo.sourceOutput}
                </span>
            ) : (
                <span className="input-runtime">runtime input</span>
            );
            // Required file types render inline (no wrapper div); optional get param-control wrapper
            return isRequired ? content : <div className="param-control">{content}</div>;
        }

        // Scalar types: render editable control
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
                className="param-select"
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
                className="param-number"
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
                className="param-text"
                value={paramValues[param.name] ?? ''}
                onChange={(e) => updateParam(param.name, e.target.value || null)}
            />
        );

        return <div className="param-control">{control}</div>;
    };

    const handleOpenModal = () => {
        // Auto-enable scatter toggle if inherited from upstream (non-source node)
        if (!isSourceNode && isScatterInherited && !scatterEnabled) {
            setScatterEnabled(true);
        }

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
            data.onSaveParameters({
                params: paramValues,
                dockerVersion: finalDockerVersion,
                scatterEnabled: scatterEnabled
            });
        }

        setShowModal(false);
    };

    // Info icon hover handlers (simple tooltip, no click persistence)
    const handleInfoMouseEnter = () => {
        if (infoIconRef.current && toolInfo) {
            const rect = infoIconRef.current.getBoundingClientRect();
            setInfoTooltipPos({
                top: rect.top + rect.height / 2,
                left: rect.right + 10
            });
            setShowInfoTooltip(true);
        }
    };

    const handleInfoMouseLeave = () => {
        setShowInfoTooltip(false);
    };

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
            <div className="node-wrapper">
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

                {isScatterInherited && (
                    <div className="node-scatter-badge">SCATTER</div>
                )}

                <div className="node-bottom-row">
                    <span className="node-bottom-spacer"></span>
                    <span className="handle-label">OUT</span>
                    {toolInfo ? (
                        <span
                            ref={infoIconRef}
                            className="node-info-btn"
                            onMouseEnter={handleInfoMouseEnter}
                            onMouseLeave={handleInfoMouseLeave}
                        >Info</span>
                    ) : (
                        <span className="node-info-spacer"></span>
                    )}
                </div>
            </div>

            {/* Info Tooltip (same style as workflowMenuItem) */}
            {showInfoTooltip && toolInfo && createPortal(
                <div
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

                        {/* Unified Parameter Pane */}
                        <div className="params-scroll">
                            {/* Required Parameters */}
                            {allParams.required.length > 0 && (
                                <div className="param-section">
                                    <div className="param-section-header">Required</div>
                                    {allParams.required.map((param) => {
                                        const wiredInfo = wiredInputs.get(param.name);
                                        const isFileType = param.type === 'File' || param.type === 'Directory';
                                        return (
                                            <div key={param.name} className={`param-card ${isFileType ? (wiredInfo ? 'input-wired' : 'input-unwired') : ''}`}>
                                                <div className="param-card-header">
                                                    <span className="param-name">{param.name}</span>
                                                    <span className="param-type-badge">{param.type}</span>
                                                    {renderParamControl(param, wiredInfo, true)}
                                                </div>
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
                            )}

                            {/* Optional Parameters */}
                            {allParams.optional.length > 0 && (
                                <div className="param-section">
                                    <div className="param-section-header">Optional</div>
                                    {allParams.optional.map((param) => {
                                        const wiredInfo = wiredInputs.get(param.name);
                                        const isFileType = param.type === 'File' || param.type === 'Directory';
                                        return (
                                            <div key={param.name} className={`param-card ${isFileType && wiredInfo ? 'input-wired' : ''}`}>
                                                <div className="param-card-header">
                                                    <span className="param-name">{param.name}</span>
                                                    <span className="param-type-badge">{param.type}</span>
                                                    {renderParamControl(param, wiredInfo, false)}
                                                </div>
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
