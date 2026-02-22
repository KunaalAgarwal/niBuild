import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { checkExtensionCompatibility } from '../utils/extensionValidation.js';
import { useToast } from '../context/ToastContext.jsx';
import '../styles/edgeMappingModal.css';

/**
 * Type compatibility checking utilities
 */
const getBaseType = (type) => {
    // Remove nullable (?) and array ([]) modifiers
    return type?.replace(/[\?\[\]]/g, '') || 'File';
};

const isArrayType = (type) => type?.includes('[]') || false;

const checkTypeCompatibility = (outputType, inputType, outputExtensions = null, inputAcceptedExtensions = null) => {
    if (!outputType || !inputType) return { compatible: true, warning: true, reason: 'Type information unavailable' };

    const outBase = getBaseType(outputType);
    const inBase = getBaseType(inputType);

    // 'any' type (used by dummy I/O nodes) is always compatible
    if (outBase === 'any' || inBase === 'any') return { compatible: true };

    const outArray = isArrayType(outputType);
    const inArray = isArrayType(inputType);

    // Array → scalar: valid when scatter is involved (scatter unwraps the array)
    if (outArray && !inArray) {
        return { compatible: true, warning: true, reason: `${outputType} will be scattered across ${inputType} inputs` };
    }
    // Scalar → array: incompatible (single value can't fill an array requirement)
    if (!outArray && inArray) {
        return { compatible: false, reason: `Type mismatch: ${outputType} cannot satisfy ${inputType}` };
    }

    // Base type check (File vs non-File)
    if (outBase !== inBase) {
        return { compatible: false, reason: `Type mismatch: ${outputType} → ${inputType}` };
    }

    // Extension compatibility check for File types
    if (outBase === 'File' && (outputExtensions || inputAcceptedExtensions)) {
        const extCompat = checkExtensionCompatibility(outputExtensions, inputAcceptedExtensions);
        if (!extCompat.compatible) {
            return {
                compatible: false,
                reason: extCompat.reason,
                isExtensionMismatch: true
            };
        }
        if (extCompat.warning) {
            return {
                compatible: true,
                warning: true,
                reason: extCompat.reason,
                isExtensionWarning: true
            };
        }
    }

    return { compatible: true };
};

/**
 * Get tool inputs/outputs, with fallback for undefined tools.
 * Includes file extension metadata for validation.
 *
 * For custom workflow nodes, collects IO from all internal non-dummy nodes
 * with namespaced identifiers (internalNodeId/ioName) and group metadata.
 */
const getToolIO = (nodeData) => {
    const { label: toolLabel, isDummy, isCustomWorkflow, internalNodes } = nodeData;

    // BIDS Input nodes: dynamic outputs from BIDS selections
    if (isDummy && nodeData.isBIDS) {
        const selections = nodeData.bidsSelections?.selections || {};
        const outputs = Object.keys(selections).length > 0
            ? Object.entries(selections).map(([key]) => ({
                name: key,
                type: 'File[]',
                label: key,
                extensions: [],
            }))
            : [{ name: 'data', type: 'File[]', label: 'data (no selections yet)', extensions: [] }];
        return {
            outputs,
            inputs: [],
            isGeneric: false,
            isBIDS: true,
        };
    }

    // Dummy I/O nodes accept any data type
    if (isDummy) {
        return {
            outputs: [{ name: 'data', type: 'any', label: 'data', extensions: [] }],
            inputs:  [{ name: 'data', type: 'any', label: 'data', acceptedExtensions: null }],
            isGeneric: true,
            isDummy: true
        };
    }

    // Custom workflow nodes: aggregate IO from all internal non-dummy nodes
    if (isCustomWorkflow && internalNodes) {
        const { internalEdges } = nodeData;
        const nonDummyNodes = internalNodes.filter(n => !n.isDummy);
        const outputs = [];
        const inputs = [];

        // Build set of intermediate outputs consumed by downstream internal nodes
        const consumedOutputs = new Set();
        if (internalEdges) {
            for (const edge of internalEdges) {
                const srcNode = internalNodes.find(n => n.id === edge.source);
                const tgtNode = internalNodes.find(n => n.id === edge.target);
                if (srcNode && tgtNode && !srcNode.isDummy && !tgtNode.isDummy) {
                    for (const m of (edge.data?.mappings || [])) {
                        consumedOutputs.add(`${edge.source}/${m.sourceOutput}`);
                    }
                }
            }
        }

        nonDummyNodes.forEach((node, index) => {
            const tool = getToolConfigSync(node.label);
            if (!tool) return;

            Object.entries(tool.outputs).forEach(([name, def]) => {
                const namespacedName = `${node.id}/${name}`;
                if (consumedOutputs.has(namespacedName)) return; // Skip intermediate outputs
                outputs.push({
                    name: namespacedName,
                    type: def.type,
                    label: def.label || name,
                    extensions: def.extensions || [],
                    group: node.label,
                    groupIndex: index,
                });
            });

            // Required inputs
            Object.entries(tool.requiredInputs).forEach(([name, def]) => {
                inputs.push({
                    name: `${node.id}/${name}`,
                    type: def.type,
                    label: def.label || name,
                    acceptedExtensions: def.acceptedExtensions || null,
                    required: true,
                    group: node.label,
                    groupIndex: index,
                });
            });

            // Optional inputs (exclude record types)
            Object.entries(tool.optionalInputs || {})
                .filter(([_, def]) => def.type !== 'record')
                .forEach(([name, def]) => {
                    inputs.push({
                        name: `${node.id}/${name}`,
                        type: def.type,
                        label: def.label || name,
                        acceptedExtensions: null,
                        required: false,
                        group: node.label,
                        groupIndex: index,
                    });
                });
        });

        return { outputs, inputs, isGeneric: false, isCustomWorkflow: true };
    }

    const tool = getToolConfigSync(toolLabel);
    if (tool) {
        return {
            outputs: Object.entries(tool.outputs).map(([name, def]) => ({
                name,
                type: def.type,
                label: def.label || name,
                extensions: def.extensions || []
            })),
            inputs: [
                // Required inputs first
                ...Object.entries(tool.requiredInputs).map(([name, def]) => ({
                    name,
                    type: def.type,
                    label: def.label || name,
                    acceptedExtensions: def.acceptedExtensions || null,
                    required: true
                })),
                // Optional inputs second (exclude record types)
                ...Object.entries(tool.optionalInputs || {})
                    .filter(([_, def]) => def.type !== 'record')
                    .map(([name, def]) => ({
                        name,
                        type: def.type,
                        label: def.label || name,
                        acceptedExtensions: null,
                        required: false
                    }))
            ],
            isGeneric: false
        };
    }
    // Fallback for undefined tools
    return {
        outputs: [{ name: 'output', type: 'File', label: 'Output', extensions: [] }],
        inputs: [{ name: 'input', type: 'File', label: 'Input', acceptedExtensions: null }],
        isGeneric: true
    };
};

const EdgeMappingModal = ({
    show,
    onClose,
    onSave,
    sourceNode,
    targetNode,
    existingMappings = [],
    adjacencyWarning = null,
}) => {
    const { showWarning } = useToast();
    const [mappings, setMappings] = useState([]);
    const [selectedOutput, setSelectedOutput] = useState(null);
    const outputRefs = useRef({});
    const inputRefs = useRef({});
    const containerRef = useRef(null);
    const outputsScrollRef = useRef(null);
    const inputsScrollRef = useRef(null);
    const [linePositions, setLinePositions] = useState([]);

    const sourceIO = getToolIO(sourceNode || {});
    const targetIO = getToolIO(targetNode || {});

    // Initialize mappings when modal opens
    useEffect(() => {
        if (show) {
            if (existingMappings.length > 0) {
                // Migrate old dummy node mapping names ('output'/'input' → 'data')
                const migratedMappings = existingMappings.map(m => ({
                    sourceOutput: (sourceIO.isDummy && m.sourceOutput === 'output') ? 'data' : m.sourceOutput,
                    targetInput: (targetIO.isDummy && m.targetInput === 'input') ? 'data' : m.targetInput,
                }));
                // Filter out stale mappings referencing removed inputs/outputs
                const validOutputNames = new Set(sourceIO.outputs.map(o => o.name));
                const validInputNames = new Set(targetIO.inputs.map(i => i.name));
                const validMappings = migratedMappings.filter(
                    m => validOutputNames.has(m.sourceOutput) && validInputNames.has(m.targetInput)
                );
                setMappings(validMappings);
            } else {
                // Default mapping: first output to first input
                const defaultMapping = [];
                if (sourceIO.outputs.length > 0 && targetIO.inputs.length > 0) {
                    defaultMapping.push({
                        sourceOutput: sourceIO.outputs[0].name,
                        targetInput: targetIO.inputs[0].name
                    });
                }
                setMappings(defaultMapping);
            }
            setSelectedOutput(null);
        }
    }, [show, sourceNode?.label, targetNode?.label]);

    // Calculate line positions after render + recalculate on resize/scroll
    useEffect(() => {
        if (!show || !containerRef.current) return;

        const timer = setTimeout(calculateLinePositions, 50);

        const observer = new ResizeObserver(calculateLinePositions);
        observer.observe(containerRef.current);

        const outputsEl = outputsScrollRef.current;
        const inputsEl = inputsScrollRef.current;
        if (outputsEl) outputsEl.addEventListener('scroll', calculateLinePositions);
        if (inputsEl) inputsEl.addEventListener('scroll', calculateLinePositions);

        return () => {
            clearTimeout(timer);
            observer.disconnect();
            if (outputsEl) outputsEl.removeEventListener('scroll', calculateLinePositions);
            if (inputsEl) inputsEl.removeEventListener('scroll', calculateLinePositions);
        };
    }, [show, mappings]);

    const calculateLinePositions = () => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const outputsScrollRect = outputsScrollRef.current?.getBoundingClientRect();
        const inputsScrollRect = inputsScrollRef.current?.getBoundingClientRect();

        const newPositions = mappings.map(mapping => {
            const outputEl = outputRefs.current[mapping.sourceOutput];
            const inputEl = inputRefs.current[mapping.targetInput];

            if (!outputEl || !inputEl) return null;

            const outputRect = outputEl.getBoundingClientRect();
            const inputRect = inputEl.getBoundingClientRect();

            // Check if endpoints are within visible scroll area
            const outputVisible = outputsScrollRect &&
                outputRect.bottom > outputsScrollRect.top &&
                outputRect.top < outputsScrollRect.bottom;
            const inputVisible = inputsScrollRect &&
                inputRect.bottom > inputsScrollRect.top &&
                inputRect.top < inputsScrollRect.bottom;

            // Both off-screen → hide entirely
            if (!outputVisible && !inputVisible) return null;

            const x1 = outputRect.right - containerRect.left;
            const y1 = outputRect.top + outputRect.height / 2 - containerRect.top;
            const x2 = inputRect.left - containerRect.left;
            const y2 = inputRect.top + inputRect.height / 2 - containerRect.top;

            // Gap midpoint X between the two scroll containers
            const gapMidX = outputsScrollRect && inputsScrollRect
                ? (outputsScrollRect.right - containerRect.left + inputsScrollRect.left - containerRect.left) / 2
                : (x1 + x2) / 2;

            // Look up labels for off-screen text
            const outputLabel = sourceIO.outputs.find(o => o.name === mapping.sourceOutput)?.label || mapping.sourceOutput;
            const inputLabel = targetIO.inputs.find(i => i.name === mapping.targetInput)?.label || mapping.targetInput;

            return {
                x1, y1, x2, y2,
                key: `${mapping.sourceOutput}-${mapping.targetInput}`,
                outputOffScreen: !outputVisible,
                inputOffScreen: !inputVisible,
                outputLabel,
                inputLabel,
                gapMidX,
                outputClampY: !outputVisible
                    ? (outputRect.top < outputsScrollRect.top
                        ? outputsScrollRect.top - containerRect.top + 20
                        : outputsScrollRect.bottom - containerRect.top - 20)
                    : y1,
                inputClampY: !inputVisible
                    ? (inputRect.top < inputsScrollRect.top
                        ? inputsScrollRect.top - containerRect.top + 20
                        : inputsScrollRect.bottom - containerRect.top - 20)
                    : y2,
            };
        }).filter(Boolean);

        // Space apart overlapping off-screen labels (min 16px gap)
        const minGap = 16;
        const spaceApart = (positions, key) => {
            const offScreen = positions.filter(p => p[key] !== undefined &&
                (key === 'outputClampY' ? p.outputOffScreen : p.inputOffScreen));
            if (offScreen.length < 2) return;
            offScreen.sort((a, b) => a[key] - b[key]);
            for (let i = 1; i < offScreen.length; i++) {
                const diff = offScreen[i][key] - offScreen[i - 1][key];
                if (Math.abs(diff) < minGap) {
                    offScreen[i][key] = offScreen[i - 1][key] + minGap;
                }
            }
        };
        spaceApart(newPositions, 'outputClampY');
        spaceApart(newPositions, 'inputClampY');

        setLinePositions(newPositions);
    };

    const buildCurvePath = (x1, y1, x2, y2) => {
        const dx = Math.abs(x2 - x1);
        const offset = Math.max(dx * 0.4, 30);
        return `M ${x1} ${y1} C ${x1 + offset} ${y1}, ${x2 - offset} ${y2}, ${x2} ${y2}`;
    };

    const handleOutputClick = (outputName) => {
        setSelectedOutput(outputName);
    };

    const handleInputClick = (inputName) => {
        if (selectedOutput) {
            // Check if this exact mapping exists (to toggle off)
            const existingExactMatch = mappings.findIndex(
                m => m.sourceOutput === selectedOutput && m.targetInput === inputName
            );

            if (existingExactMatch >= 0) {
                // Remove existing mapping (toggle off)
                setMappings(prev => prev.filter((_, i) => i !== existingExactMatch));
            } else {
                // Enforce one-to-one: remove any existing mapping TO this input, then add new one
                setMappings(prev => [
                    ...prev.filter(m => m.targetInput !== inputName),
                    { sourceOutput: selectedOutput, targetInput: inputName }
                ]);
            }
            setSelectedOutput(null);
        }
    };

    const handleLineClick = (mapping) => {
        // Remove mapping when clicking on line
        setMappings(prev => prev.filter(
            m => !(m.sourceOutput === mapping.sourceOutput && m.targetInput === mapping.targetInput)
        ));
    };

    const handleSave = () => {
        if (mappings.length === 0) {
            showWarning('Please create at least one mapping before saving.');
            return;
        }
        if (hasIncompatibleMappings) {
            showWarning('Cannot save: one or more mappings have incompatible types.');
            return;
        }
        onSave(mappings);
    };

    const handleCancel = () => {
        setMappings([]);
        setSelectedOutput(null);
        onClose();
    };

    // Pre-computed O(1) lookup Maps for mappings
    const mappingsByOutput = useMemo(() => new Map(mappings.map(m => [m.sourceOutput, m])), [mappings]);
    const mappingsByInput = useMemo(() => new Map(mappings.map(m => [m.targetInput, m])), [mappings]);

    const isOutputMapped = (outputName) => mappingsByOutput.has(outputName);
    const isInputMapped = (inputName) => mappingsByInput.has(inputName);

    // Check type compatibility for a specific output-input pair
    const getMappingCompatibility = (outputName, inputName) => {
        const output = sourceIO.outputs.find(o => o.name === outputName);
        const input = targetIO.inputs.find(i => i.name === inputName);
        return checkTypeCompatibility(
            output?.type,
            input?.type,
            output?.extensions,
            input?.acceptedExtensions
        );
    };

    // Check if any current mappings have type issues
    const hasIncompatibleMappings = mappings.some(m => {
        const { compatible } = getMappingCompatibility(m.sourceOutput, m.targetInput);
        return !compatible;
    });

    if (!sourceNode || !targetNode) return null;

    return (
        <Modal
            show={show}
            onHide={handleCancel}
            centered
            size="lg"
            className="edge-mapping-modal"
        >
            <Modal.Header>
                <Modal.Title>
                    Connect: {sourceNode.label} → {targetNode.label}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Warning banners */}
                {adjacencyWarning && (
                    <div className="type-warning-banner">
                        <span className="warning-icon">⚠️</span>
                        <span>{adjacencyWarning}</span>
                    </div>
                )}
                {hasIncompatibleMappings && (
                    <div className="type-warning-banner">
                        <span className="warning-icon">⚠️</span>
                        <span>Type mismatch detected. The output and input types may not be compatible.</span>
                    </div>
                )}

                <div className="mapping-container" ref={containerRef}>
                    {/* Outputs Column */}
                    <div className="io-column outputs-column">
                        <div className="column-header">
                            {sourceIO.isDummy ? 'Provides' : 'Outputs'} ({sourceNode.label})
                            {sourceIO.isGeneric && <span className="generic-badge">generic</span>}
                        </div>
                        <div className="io-items-scroll" ref={outputsScrollRef}>
                            {sourceIO.outputs.map((output, idx) => {
                                // Check if this output is mapped to an incompatible input
                                const mapping = mappings.find(m => m.sourceOutput === output.name);
                                const compatibility = mapping
                                    ? getMappingCompatibility(output.name, mapping.targetInput)
                                    : { compatible: true };

                                // Show group header when group changes (custom workflow nodes)
                                const showGroupHeader = sourceIO.isCustomWorkflow &&
                                    (idx === 0 || output.group !== sourceIO.outputs[idx - 1]?.group);

                                return (
                                    <React.Fragment key={output.name}>
                                        {showGroupHeader && (
                                            <div className="io-group-header">{output.group}</div>
                                        )}
                                        <div
                                            ref={el => outputRefs.current[output.name] = el}
                                            className={`io-item output-item ${
                                                selectedOutput === output.name ? 'selected' : ''
                                            } ${isOutputMapped(output.name) ? 'mapped' : ''} ${
                                                !compatibility.compatible ? 'mismatch-warning' : ''
                                            }`}
                                            onClick={() => handleOutputClick(output.name)}
                                        >
                                            <div className="io-item-main">
                                                <span className="io-name">{output.label}</span>
                                                <span className="io-type">{output.type}</span>
                                                {!compatibility.compatible && <span className="warning-icon" title={compatibility.reason}>⚠️</span>}
                                            </div>
                                            {output.extensions?.length > 0 && (
                                                <span className="io-extensions" title={output.extensions.join(', ')}>
                                                    {output.extensions.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Connection Lines SVG */}
                    <svg className="connection-lines">
                        {linePositions.map(pos => {
                            const mapping = mappings.find(
                                m => `${m.sourceOutput}-${m.targetInput}` === pos.key
                            );
                            const compatibility = mapping
                                ? getMappingCompatibility(mapping.sourceOutput, mapping.targetInput)
                                : { compatible: true };
                            const isOffScreen = pos.outputOffScreen || pos.inputOffScreen;

                            if (isOffScreen) {
                                const visibleX = pos.outputOffScreen ? pos.x2 : pos.x1;
                                const visibleY = pos.outputOffScreen ? pos.y2 : pos.y1;
                                const clampY = pos.outputOffScreen ? pos.outputClampY : pos.inputClampY;
                                const rawLabel = pos.outputOffScreen ? pos.outputLabel : pos.inputLabel;
                                const truncated = rawLabel.length > 12 ? rawLabel.slice(0, 12) + '\u2026' : rawLabel;
                                const labelText = `\u2192 ${truncated}`;
                                const textAnchor = pos.outputOffScreen ? 'end' : 'start';
                                const isWarning = !compatibility.compatible;

                                return (
                                    <g key={pos.key} className="offscreen-group" onClick={() => {
                                        if (mapping) handleLineClick(mapping);
                                    }}>
                                        <line
                                            x1={visibleX} y1={visibleY}
                                            x2={pos.gapMidX} y2={clampY}
                                            className={`connection-line-offscreen ${isWarning ? 'warning-line-offscreen' : ''}`}
                                        />
                                        <line
                                            x1={visibleX} y1={visibleY}
                                            x2={pos.gapMidX} y2={clampY}
                                            className="connection-line-hitarea"
                                        />
                                        <circle cx={visibleX} cy={visibleY} r="3.5"
                                            className={`connection-dot ${isWarning ? 'warning-dot' : ''}`}
                                        />
                                        <text
                                            x={pos.gapMidX} y={clampY}
                                            textAnchor={textAnchor}
                                            className={`connection-label-offscreen ${isWarning ? 'warning-label-offscreen' : ''}`}
                                        >
                                            {labelText}
                                        </text>
                                    </g>
                                );
                            }

                            const d = buildCurvePath(pos.x1, pos.y1, pos.x2, pos.y2);

                            return (
                                <g key={pos.key} onClick={() => {
                                    if (mapping) handleLineClick(mapping);
                                }}>
                                    <path
                                        d={d}
                                        className={`connection-line ${!compatibility.compatible ? 'warning-line' : ''}`}
                                    />
                                    <path
                                        d={d}
                                        className="connection-line-hitarea"
                                    />
                                    <circle cx={pos.x1} cy={pos.y1} r="3.5"
                                        className={`connection-dot ${!compatibility.compatible ? 'warning-dot' : ''}`}
                                    />
                                    <circle cx={pos.x2} cy={pos.y2} r="3.5"
                                        className={`connection-dot ${!compatibility.compatible ? 'warning-dot' : ''}`}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Inputs Column */}
                    <div className="io-column inputs-column">
                        <div className="column-header">
                            {targetIO.isDummy ? 'Receives' : 'Inputs'} ({targetNode.label})
                            {targetIO.isGeneric && <span className="generic-badge">generic</span>}
                        </div>
                        <div className="io-items-scroll" ref={inputsScrollRef}>
                            {targetIO.inputs.map((input, idx, arr) => {
                                // Check if this input is mapped from an incompatible output
                                const mapping = mappings.find(m => m.targetInput === input.name);
                                const compatibility = mapping
                                    ? getMappingCompatibility(mapping.sourceOutput, input.name)
                                    : { compatible: true };

                                // Also check if currently selected output would be incompatible
                                const selectedCompatibility = selectedOutput
                                    ? getMappingCompatibility(selectedOutput, input.name)
                                    : { compatible: true };

                                // Show group header when group changes (custom workflow nodes)
                                const showGroupHeader = targetIO.isCustomWorkflow &&
                                    (idx === 0 || input.group !== arr[idx - 1]?.group);

                                // Show separator between required and optional inputs
                                // Only within the same group (or when no groups)
                                const sameGroup = !targetIO.isCustomWorkflow || (idx > 0 && input.group === arr[idx - 1]?.group);
                                const showOptionalSeparator = sameGroup && !input.required
                                    && idx > 0 && arr[idx - 1]?.required;

                                return (
                                    <React.Fragment key={input.name}>
                                        {showGroupHeader && (
                                            <div className="io-group-header">{input.group}</div>
                                        )}
                                        {showOptionalSeparator && (
                                            <div className="io-section-separator">optional</div>
                                        )}
                                        <div
                                            ref={el => inputRefs.current[input.name] = el}
                                            className={`io-item input-item ${
                                                isInputMapped(input.name) ? 'mapped' : ''
                                            } ${selectedOutput ? 'clickable' : ''} ${
                                                !compatibility.compatible ? 'mismatch-warning' : ''
                                            } ${selectedOutput && !selectedCompatibility.compatible ? 'mismatch-warning-preview' : ''}`}
                                            onClick={() => handleInputClick(input.name)}
                                            title={!selectedCompatibility.compatible ? selectedCompatibility.reason : ''}
                                        >
                                            <div className="io-item-main">
                                                <span className="io-name">{input.label}</span>
                                                <span className="io-type">{input.type}</span>
                                                {!compatibility.compatible && <span className="warning-icon" title={compatibility.reason}>⚠️</span>}
                                            </div>
                                            {input.acceptedExtensions?.length > 0 && (
                                                <span className="io-extensions" title={input.acceptedExtensions.join(', ')}>
                                                    {input.acceptedExtensions.join(', ')}
                                                </span>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mapping-instructions">
                    Click an output, then click an input to create a connection.
                    Click on a line to remove it.
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button variant="primary" onClick={handleSave} disabled={hasIncompatibleMappings}>
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EdgeMappingModal;
