import React, { useState, useRef, useEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { TOOL_MAP } from '../../public/cwl/toolMap.js';
import '../styles/edgeMappingModal.css';

/**
 * Get tool inputs/outputs, with fallback for undefined tools
 */
const getToolIO = (toolLabel) => {
    const tool = TOOL_MAP[toolLabel];
    if (tool) {
        return {
            outputs: Object.entries(tool.outputs).map(([name, def]) => ({
                name,
                type: def.type,
                label: def.label || name
            })),
            inputs: Object.entries(tool.requiredInputs)
                .filter(([_, def]) => def.passthrough)
                .map(([name, def]) => ({
                    name,
                    type: def.type,
                    label: def.label || name
                })),
            isGeneric: false
        };
    }
    // Fallback for undefined tools
    return {
        outputs: [{ name: 'output', type: 'File', label: 'Output' }],
        inputs: [{ name: 'input', type: 'File', label: 'Input' }],
        isGeneric: true
    };
};

const EdgeMappingModal = ({
    show,
    onClose,
    onSave,
    sourceNode,
    targetNode,
    existingMappings = []
}) => {
    const [mappings, setMappings] = useState([]);
    const [selectedOutput, setSelectedOutput] = useState(null);
    const outputRefs = useRef({});
    const inputRefs = useRef({});
    const containerRef = useRef(null);
    const [linePositions, setLinePositions] = useState([]);

    const sourceIO = getToolIO(sourceNode?.label);
    const targetIO = getToolIO(targetNode?.label);

    // Initialize mappings when modal opens
    useEffect(() => {
        if (show) {
            if (existingMappings.length > 0) {
                setMappings(existingMappings);
            } else {
                // Default mapping: first output to first input
                const defaultMapping = [];
                if (sourceIO.outputs.length > 0 && targetIO.inputs.length > 0) {
                    // For defined tools, use primaryOutputs if available
                    const tool = TOOL_MAP[sourceNode?.label];
                    const primaryOutput = tool?.primaryOutputs?.[0] || sourceIO.outputs[0].name;
                    defaultMapping.push({
                        sourceOutput: primaryOutput,
                        targetInput: targetIO.inputs[0].name
                    });
                }
                setMappings(defaultMapping);
            }
            setSelectedOutput(null);
        }
    }, [show, sourceNode?.label, targetNode?.label]);

    // Calculate line positions after render
    useEffect(() => {
        if (show && containerRef.current) {
            const timer = setTimeout(() => {
                calculateLinePositions();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [show, mappings]);

    const calculateLinePositions = () => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newPositions = mappings.map(mapping => {
            const outputEl = outputRefs.current[mapping.sourceOutput];
            const inputEl = inputRefs.current[mapping.targetInput];

            if (!outputEl || !inputEl) return null;

            const outputRect = outputEl.getBoundingClientRect();
            const inputRect = inputEl.getBoundingClientRect();

            return {
                x1: outputRect.right - containerRect.left,
                y1: outputRect.top + outputRect.height / 2 - containerRect.top,
                x2: inputRect.left - containerRect.left,
                y2: inputRect.top + inputRect.height / 2 - containerRect.top,
                key: `${mapping.sourceOutput}-${mapping.targetInput}`
            };
        }).filter(Boolean);

        setLinePositions(newPositions);
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
            alert('Please create at least one mapping before saving.');
            return;
        }
        onSave(mappings);
    };

    const handleCancel = () => {
        setMappings([]);
        setSelectedOutput(null);
        onClose();
    };

    const isOutputMapped = (outputName) => {
        return mappings.some(m => m.sourceOutput === outputName);
    };

    const isInputMapped = (inputName) => {
        return mappings.some(m => m.targetInput === inputName);
    };

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
                <div className="mapping-container" ref={containerRef}>
                    {/* Outputs Column */}
                    <div className="io-column outputs-column">
                        <div className="column-header">
                            Outputs ({sourceNode.label})
                            {sourceIO.isGeneric && <span className="generic-badge">generic</span>}
                        </div>
                        {sourceIO.outputs.map(output => (
                            <div
                                key={output.name}
                                ref={el => outputRefs.current[output.name] = el}
                                className={`io-item output-item ${
                                    selectedOutput === output.name ? 'selected' : ''
                                } ${isOutputMapped(output.name) ? 'mapped' : ''}`}
                                onClick={() => handleOutputClick(output.name)}
                            >
                                <span className="io-name">{output.label}</span>
                                <span className="io-type">{output.type}</span>
                            </div>
                        ))}
                    </div>

                    {/* Connection Lines SVG */}
                    <svg className="connection-lines">
                        {linePositions.map(pos => (
                            <g key={pos.key} onClick={() => {
                                const mapping = mappings.find(
                                    m => `${m.sourceOutput}-${m.targetInput}` === pos.key
                                );
                                if (mapping) handleLineClick(mapping);
                            }}>
                                <line
                                    x1={pos.x1}
                                    y1={pos.y1}
                                    x2={pos.x2}
                                    y2={pos.y2}
                                    className="connection-line"
                                />
                                <line
                                    x1={pos.x1}
                                    y1={pos.y1}
                                    x2={pos.x2}
                                    y2={pos.y2}
                                    className="connection-line-hitarea"
                                />
                            </g>
                        ))}
                    </svg>

                    {/* Inputs Column */}
                    <div className="io-column inputs-column">
                        <div className="column-header">
                            Inputs ({targetNode.label})
                            {targetIO.isGeneric && <span className="generic-badge">generic</span>}
                        </div>
                        {targetIO.inputs.map(input => (
                            <div
                                key={input.name}
                                ref={el => inputRefs.current[input.name] = el}
                                className={`io-item input-item ${
                                    isInputMapped(input.name) ? 'mapped' : ''
                                } ${selectedOutput ? 'clickable' : ''}`}
                                onClick={() => handleInputClick(input.name)}
                            >
                                <span className="io-name">{input.label}</span>
                                <span className="io-type">{input.type}</span>
                            </div>
                        ))}
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
                <Button variant="primary" onClick={handleSave}>
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default EdgeMappingModal;
