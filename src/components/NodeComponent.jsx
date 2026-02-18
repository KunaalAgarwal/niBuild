import React, { useState, useMemo, useRef, useContext } from 'react';
import { createPortal } from 'react-dom';
import { Handle, Position } from 'reactflow';
import { Modal, Form } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_IMAGES, DOCKER_TAGS, annotationByName } from '../utils/toolAnnotations.js';
import { useToast } from '../context/ToastContext.jsx';
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

    const { showError, dismissMessage } = useToast();
    const JSON_ERROR_MSG = 'Invalid JSON entered. Please ensure entry is formatted appropriately.';
    const [showModal, setShowModal] = useState(false);
    const [textInput, setTextInput] = useState(data.parameters || '');
    const [dockerVersion, setDockerVersion] = useState(data.dockerVersion || 'latest');
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterEnabled, setScatterEnabled] = useState(data.scatterEnabled || false);

    // Info tooltip state (hover only, like workflowMenuItem)
    const [showInfoTooltip, setShowInfoTooltip] = useState(false);
    const [infoTooltipPos, setInfoTooltipPos] = useState({ top: 0, left: 0 });
    const infoIconRef = useRef(null);

    // Get tool definition and optional inputs
    const tool = getToolConfigSync(data.label);
    const optionalInputs = tool?.optionalInputs || {};
    const hasDefinedTool = !!tool;
    const dockerImage = tool?.dockerImage || null;

    // Required File/Directory inputs (shown as wired/unwired in modal)
    const requiredFileInputs = useMemo(() => {
        if (!tool?.requiredInputs) return {};
        return Object.fromEntries(
            Object.entries(tool.requiredInputs)
                .filter(([_, def]) => def.type === 'File' || def.type === 'Directory')
        );
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

    // Generate a helpful default JSON showing available optional parameters
    const defaultJson = useMemo(() => {
        if (!hasDefinedTool || Object.keys(optionalInputs).length === 0) {
            return '{\n    \n}';
        }

        const exampleParams = {};
        Object.entries(optionalInputs).forEach(([name, def]) => {
            // Skip record types in example
            if (def.type === 'record') return;

            // Generate example value based on type
            switch (def.type) {
                case 'boolean':
                    exampleParams[name] = false;
                    break;
                case 'int':
                    exampleParams[name] = def.bounds ? def.bounds[0] : 0;
                    break;
                case 'double':
                    exampleParams[name] = def.bounds ? def.bounds[0] : 0.0;
                    break;
                case 'string':
                    exampleParams[name] = '';
                    break;
                default:
                    exampleParams[name] = null;
            }
        });

        return JSON.stringify(exampleParams, null, 4);
    }, [hasDefinedTool, optionalInputs]);

    // Generate help text showing available options
    const optionsHelpText = useMemo(() => {
        if (!hasDefinedTool || Object.keys(optionalInputs).length === 0) {
            return 'No optional parameters defined for this tool.';
        }

        return Object.entries(optionalInputs)
            .filter(([_, def]) => def.type !== 'record')
            .map(([name, def]) => `• ${name} (${def.type}): ${def.label}`)
            .join('\n');
    }, [hasDefinedTool, optionalInputs]);

    const handleOpenModal = () => {
        // Auto-enable scatter toggle if inherited from upstream (non-source node)
        if (!isSourceNode && isScatterInherited && !scatterEnabled) {
            setScatterEnabled(true);
        }

        let inputValue = textInput;

        // Ensure inputValue is always a string before calling trim()
        if (typeof inputValue !== 'string') {
            inputValue = JSON.stringify(inputValue, null, 4);
        }

        if (!inputValue.trim()) {
            setTextInput(defaultJson);
        } else {
            setTextInput(inputValue);
        }

        setShowModal(true);
    };

    const handleCloseModal = () => {
        // Default to 'latest' if docker version is empty
        const finalDockerVersion = dockerVersion.trim() || 'latest';
        if (finalDockerVersion !== dockerVersion) {
            setDockerVersion(finalDockerVersion);
        }

        // Validate JSON before allowing close
        if (typeof data.onSaveParameters === 'function') {
            let parsed;
            try {
                parsed = JSON.parse(textInput);
            } catch (err) {
                showError(JSON_ERROR_MSG, 4000);
                return; // Keep modal open
            }

            dismissMessage(JSON_ERROR_MSG);
            data.onSaveParameters({
                params: parsed,
                dockerVersion: finalDockerVersion,
                scatterEnabled: scatterEnabled
            });
        }

        setShowModal(false);
    };

    const handleInputChange = (e) => {
        setTextInput(e.target.value);
        dismissMessage(JSON_ERROR_MSG);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const tabSpaces = '    '; // Insert 4 spaces
            const { selectionStart, selectionEnd } = e.target;
            const newValue =
                textInput.substring(0, selectionStart) +
                tabSpaces +
                textInput.substring(selectionEnd);

            setTextInput(newValue);

            // Move cursor forward
            setTimeout(() => {
                e.target.selectionStart = e.target.selectionEnd =
                    selectionStart + tabSpaces.length;
            }, 0);
        }
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

                        {/* Required Inputs (File/Directory) */}
                        {Object.keys(requiredFileInputs).length > 0 && (
                            <Form.Group className="required-inputs-section">
                                <Form.Label className="modal-label">Inputs</Form.Label>
                                {Object.entries(requiredFileInputs).map(([name, def]) => {
                                    const wiredInfo = wiredInputs.get(name);
                                    return (
                                        <div key={name} className={`input-row ${wiredInfo ? 'input-wired' : 'input-unwired'}`}>
                                            <span className="input-name">{def.label || name}</span>
                                            <span className="input-type-badge">{def.type}</span>
                                            {wiredInfo ? (
                                                <span className="input-source">
                                                    from {wiredInfo.sourceNodeLabel} / {wiredInfo.sourceOutput}
                                                </span>
                                            ) : (
                                                <span className="input-runtime">supplied at runtime</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </Form.Group>
                        )}

                        <Form.Group className="mb-3">
                            <Form.Label className="modal-label">
                                Configure optional parameters as JSON.
                                {!hasDefinedTool && ' (Tool not fully defined - using generic parameters)'}
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={8}
                                value={textInput}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                className="code-input"
                                spellCheck="false"
                                autoCorrect="off"
                                autoCapitalize="off"
                            />
                        </Form.Group>
                        {hasDefinedTool && Object.keys(optionalInputs).length > 0 && (
                            <Form.Group>
                                <Form.Label className="modal-label" style={{ fontSize: '0.8rem', color: '#808080' }}>
                                    Available options:
                                </Form.Label>
                                <pre style={{
                                    fontSize: '0.75rem',
                                    color: '#a0a0a0',
                                    backgroundColor: '#1a1a1a',
                                    padding: '8px',
                                    borderRadius: '4px',
                                    maxHeight: '150px',
                                    overflow: 'auto',
                                    whiteSpace: 'pre-wrap'
                                }}>
                                    {optionsHelpText}
                                </pre>
                            </Form.Group>
                        )}
                    </Form>
                </Modal.Body>
            </Modal>
        </>
    );
};

export default NodeComponent;
