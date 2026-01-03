import React, { useState, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { Modal, Form } from 'react-bootstrap';
import { TOOL_MAP } from '../../public/cwl/toolMap.js';
import '../styles/workflowItem.css';

const NodeComponent = ({ data }) => {
    const [showModal, setShowModal] = useState(false);
    const [textInput, setTextInput] = useState(data.parameters || '');

    // Get tool definition and optional inputs
    const tool = TOOL_MAP[data.label];
    const optionalInputs = tool?.optionalInputs || {};
    const hasDefinedTool = !!tool;

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
        setShowModal(false);

        // Attempt to parse; fallback to user's raw text if invalid
        if (typeof data.onSaveParameters === 'function') {
            try {
                data.onSaveParameters(JSON.parse(textInput));
            } catch (err) {
                alert('Invalid JSON entered. Defaulting to raw text storage. Please ensure entry is formatted appropriately.');
                data.onSaveParameters(textInput);
            }
        }
    };

    const handleInputChange = (e) => {
        setTextInput(e.target.value);
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

    return (
        <>
            <div onDoubleClick={handleOpenModal}>
                {data.label}
                <Handle type="target" position={Position.Top} />
                <Handle type="source" position={Position.Bottom} />
            </div>

            <Modal
                show={showModal}
                onHide={handleCloseModal}
                centered
                className="custom-modal"
                size="lg"
            >
                <Modal.Header>
                    <Modal.Title style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '1rem' }}>
                        {data.label} - Optional Parameters
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body onClick={(e) => e.stopPropagation()}>
                    <Form>
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
