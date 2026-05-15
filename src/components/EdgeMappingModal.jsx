import React, { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { Modal, Button } from 'react-bootstrap';
import { getToolIO, formatTypeHint, checkTypeCompatibility } from '../utils/edgeMappingUtils.js';
import { useToast } from '../context/ToastContext.jsx';
import '../styles/edgeMappingModal.css';

const EdgeMappingModal = ({
    show,
    onClose,
    onSave,
    sourceNode,
    targetNode,
    existingMappings = [],
    sourceIsScattered = false,
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
                const migratedMappings = existingMappings.map((m) => ({
                    sourceOutput: sourceIO.isDummy && m.sourceOutput === 'output' ? 'data' : m.sourceOutput,
                    targetInput: targetIO.isDummy && m.targetInput === 'input' ? 'data' : m.targetInput,
                }));
                // Filter out stale mappings referencing removed inputs/outputs
                const validOutputNames = new Set(sourceIO.outputs.map((o) => o.name));
                const validInputNames = new Set(targetIO.inputs.map((i) => i.name));
                const validMappings = migratedMappings.filter(
                    (m) => validOutputNames.has(m.sourceOutput) && validInputNames.has(m.targetInput),
                );
                setMappings(validMappings);
            } else {
                // Default mapping: first output to first input
                const defaultMapping = [];
                if (sourceIO.outputs.length > 0 && targetIO.inputs.length > 0) {
                    defaultMapping.push({
                        sourceOutput: sourceIO.outputs[0].name,
                        targetInput: targetIO.inputs[0].name,
                    });
                }
                setMappings(defaultMapping);
            }
            setSelectedOutput(null);
        }
        // Reason: intentionally seeds state on modal-open / node-label change only. sourceIO/targetIO are derived from the node props; existingMappings is captured at fire time as the seed. Re-running on every prop identity change would clobber user edits.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, sourceNode?.label, targetNode?.label]);

    // Calculate line positions synchronously after DOM mutations + recalculate on resize/scroll
    useLayoutEffect(() => {
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
        // Reason: calculateLinePositions reads stable refs + mappings; it's recreated each render but the effect already re-runs on every show/mappings change, so a fresh closure is captured.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [show, mappings]);

    const calculateLinePositions = () => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const outputsScrollRect = outputsScrollRef.current?.getBoundingClientRect();
        const inputsScrollRect = inputsScrollRef.current?.getBoundingClientRect();

        const newPositions = mappings
            .map((mapping) => {
                const outputEl = outputRefs.current[mapping.sourceOutput];
                const inputEl = inputRefs.current[mapping.targetInput];

                if (!outputEl || !inputEl) return null;

                const outputRect = outputEl.getBoundingClientRect();
                const inputRect = inputEl.getBoundingClientRect();

                // Check if endpoints are within visible scroll area
                const outputVisible =
                    outputsScrollRect &&
                    outputRect.bottom > outputsScrollRect.top &&
                    outputRect.top < outputsScrollRect.bottom;
                const inputVisible =
                    inputsScrollRect &&
                    inputRect.bottom > inputsScrollRect.top &&
                    inputRect.top < inputsScrollRect.bottom;

                // Both off-screen → hide entirely
                if (!outputVisible && !inputVisible) return null;

                const x1 = outputRect.right - containerRect.left;
                const y1 = outputRect.top + outputRect.height / 2 - containerRect.top;
                const x2 = inputRect.left - containerRect.left;
                const y2 = inputRect.top + inputRect.height / 2 - containerRect.top;

                // Gap midpoint X between the two scroll containers
                const gapMidX =
                    outputsScrollRect && inputsScrollRect
                        ? (outputsScrollRect.right - containerRect.left + inputsScrollRect.left - containerRect.left) /
                          2
                        : (x1 + x2) / 2;

                // Use parameter names for off-screen text
                const outputLabel = mapping.sourceOutput;
                const inputLabel = mapping.targetInput;

                // Gap boundaries (column edges relative to container)
                const gapLeftX = outputsScrollRect ? outputsScrollRect.right - containerRect.left : x1;
                const gapRightX = inputsScrollRect ? inputsScrollRect.left - containerRect.left : x2;

                return {
                    x1,
                    y1,
                    x2,
                    y2,
                    key: `${mapping.sourceOutput}-${mapping.targetInput}`,
                    outputOffScreen: !outputVisible,
                    inputOffScreen: !inputVisible,
                    outputLabel,
                    inputLabel,
                    gapMidX,
                    gapLeftX,
                    gapRightX,
                    outputClampY: !outputVisible
                        ? outputRect.top < outputsScrollRect.top
                            ? outputsScrollRect.top - containerRect.top + 20
                            : outputsScrollRect.bottom - containerRect.top - 20
                        : y1,
                    inputClampY: !inputVisible
                        ? inputRect.top < inputsScrollRect.top
                            ? inputsScrollRect.top - containerRect.top + 20
                            : inputsScrollRect.bottom - containerRect.top - 20
                        : y2,
                };
            })
            .filter(Boolean);

        // Space apart overlapping off-screen labels (min 16px gap)
        const minGap = 16;
        const spaceApart = (positions, key) => {
            const offScreen = positions.filter(
                (p) => p[key] !== undefined && (key === 'outputClampY' ? p.outputOffScreen : p.inputOffScreen),
            );
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
        setSelectedOutput((prev) => (prev === outputName ? null : outputName));
    };

    const handleInputClick = (inputName) => {
        if (selectedOutput) {
            // Check if this exact mapping exists (to toggle off)
            const existingExactMatch = mappings.findIndex(
                (m) => m.sourceOutput === selectedOutput && m.targetInput === inputName,
            );

            if (existingExactMatch >= 0) {
                // Remove existing mapping (toggle off)
                setMappings((prev) => prev.filter((_, i) => i !== existingExactMatch));
            } else {
                // Enforce one-to-one: remove any existing mapping TO this input, then add new one
                setMappings((prev) => [
                    ...prev.filter((m) => m.targetInput !== inputName),
                    { sourceOutput: selectedOutput, targetInput: inputName },
                ]);
            }
            setSelectedOutput(null);
        }
    };

    const handleLineClick = (mapping) => {
        // Remove mapping when clicking on line
        setMappings((prev) =>
            prev.filter((m) => !(m.sourceOutput === mapping.sourceOutput && m.targetInput === mapping.targetInput)),
        );
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
    const mappingsByOutput = useMemo(() => new Map(mappings.map((m) => [m.sourceOutput, m])), [mappings]);
    const mappingsByInput = useMemo(() => new Map(mappings.map((m) => [m.targetInput, m])), [mappings]);

    const isOutputMapped = (outputName) => mappingsByOutput.has(outputName);
    const isInputMapped = (inputName) => mappingsByInput.has(inputName);

    // O(1) lookup maps for outputs and inputs
    const outputByName = useMemo(() => new Map((sourceIO?.outputs || []).map((o) => [o.name, o])), [sourceIO]);
    const inputByName = useMemo(() => new Map((targetIO?.inputs || []).map((i) => [i.name, i])), [targetIO]);

    // Check type compatibility for a specific output-input pair
    const getMappingCompatibility = (outputName, inputName) => {
        const output = outputByName.get(outputName);
        const input = inputByName.get(inputName);
        // BIDS bids_directory output does not carry scatter
        const effectiveScattered = sourceIsScattered && !(sourceIO.isBIDS && outputName === 'bids_directory');
        return checkTypeCompatibility(
            output?.type,
            input?.type,
            output?.extensions,
            input?.acceptedExtensions,
            effectiveScattered,
        );
    };

    // Check if any current mappings have type issues
    const hasIncompatibleMappings = useMemo(
        () =>
            mappings.some((m) => {
                const { compatible } = getMappingCompatibility(m.sourceOutput, m.targetInput);
                return !compatible;
            }),
        // Reason: getMappingCompatibility is a local function recreated each render that closes over outputByName/inputByName/sourceIsScattered (already in deps). Including the function itself would re-trigger this memo on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [mappings, outputByName, inputByName, sourceIsScattered],
    );

    // Collect unique scatter/gather notes from current mappings for banner display
    const { inheritNotes, gatherNotes } = useMemo(() => {
        const inherit = new Set();
        const gather = new Set();
        for (const m of mappings) {
            const compat = getMappingCompatibility(m.sourceOutput, m.targetInput);
            if (compat.scatterNote) inherit.add(compat.reason);
            if (compat.gatherNote) gather.add(compat.reason);
        }
        return { inheritNotes: [...inherit], gatherNotes: [...gather] };
        // Reason: same as hasIncompatibleMappings above — getMappingCompatibility is recreated each render but reads stable inputs that are already in deps.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mappings, sourceIsScattered]);

    if (!sourceNode || !targetNode) return null;

    return (
        <Modal show={show} onHide={handleCancel} centered size="xl" className="edge-mapping-modal">
            <Modal.Header>
                <Modal.Title>
                    Connect: {sourceNode.label} → {targetNode.label}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {/* Warning banners */}
                {hasIncompatibleMappings && (
                    <div className="type-warning-banner">
                        <span className="warning-icon">⚠️</span>
                        <span>Type mismatch detected. The output and input types may not be compatible.</span>
                    </div>
                )}
                {inheritNotes.map((note, i) => (
                    <div key={`inherit-${i}`} className="scatter-note-banner">
                        <span className="scatter-note-icon">{'\u21BB'}</span>
                        <span>{note}</span>
                    </div>
                ))}
                {gatherNotes.map((note, i) => (
                    <div key={`gather-${i}`} className="scatter-gather-banner">
                        <span className="scatter-gather-icon">{'\u2193'}</span>
                        <span>{note}</span>
                    </div>
                ))}

                <div className="mapping-container" ref={containerRef}>
                    {/* Outputs Column */}
                    <div className="io-column outputs-column">
                        <div className="column-header">
                            {sourceIO.isDummy ? 'Provides' : 'Outputs'} ({sourceNode.label}
                            {sourceIsScattered ? ' - scattered' : ''})
                            {sourceIO.isGeneric && <span className="generic-badge">generic</span>}
                        </div>
                        <div className="io-items-scroll scrollbar-thin" ref={outputsScrollRef}>
                            {sourceIO.outputs.map((output, idx) => {
                                // Check if this output is mapped to an incompatible input
                                const mapping = mappings.find((m) => m.sourceOutput === output.name);
                                const compatibility = mapping
                                    ? getMappingCompatibility(output.name, mapping.targetInput)
                                    : { compatible: true };

                                // Show group header when group changes (custom workflow nodes)
                                const showGroupHeader =
                                    sourceIO.isCustomWorkflow &&
                                    (idx === 0 || output.group !== sourceIO.outputs[idx - 1]?.group);

                                return (
                                    <React.Fragment key={output.name}>
                                        {showGroupHeader && (
                                            <div className="io-group-header">
                                                {output.group}
                                                {sourceIO.groupInfo?.[output.group]?.scattered && (
                                                    <span className="group-scatter-badge">scattered</span>
                                                )}
                                                {sourceIO.groupInfo?.[output.group]?.gathered && (
                                                    <span className="group-gather-badge">gathered</span>
                                                )}
                                            </div>
                                        )}
                                        <div
                                            ref={(el) => (outputRefs.current[output.name] = el)}
                                            className={`io-item output-item ${
                                                selectedOutput === output.name ? 'selected' : ''
                                            } ${isOutputMapped(output.name) ? 'mapped' : ''} ${
                                                !compatibility.compatible ? 'mismatch-warning' : ''
                                            }`}
                                            onClick={() => handleOutputClick(output.name)}
                                        >
                                            <div className="io-item-main">
                                                <span className="io-name">{output.label}</span>
                                                <span
                                                    className="io-type"
                                                    title={
                                                        output.type +
                                                        (output.extensions?.length
                                                            ? ' (' + output.extensions.join(', ') + ')'
                                                            : '') +
                                                        (output.enumSymbols?.length
                                                            ? ' (' + output.enumSymbols.join(', ') + ')'
                                                            : '')
                                                    }
                                                >
                                                    {formatTypeHint(output.type, output.extensions)}
                                                </span>
                                            </div>
                                            {output.description && (
                                                <div className="io-enum-values">{output.description}</div>
                                            )}
                                            {output.enumSymbols?.length > 0 && (
                                                <div className="io-enum-values">
                                                    {output.enumSymbols.map((s) => `'${s}'`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* Connection Lines SVG */}
                    <svg className="connection-lines">
                        {linePositions.map((pos) => {
                            const mapping = mappings.find((m) => `${m.sourceOutput}-${m.targetInput}` === pos.key);
                            const compatibility = mapping
                                ? getMappingCompatibility(mapping.sourceOutput, mapping.targetInput)
                                : { compatible: true };
                            const isOffScreen = pos.outputOffScreen || pos.inputOffScreen;

                            if (isOffScreen) {
                                const visibleX = pos.outputOffScreen ? pos.x2 : pos.x1;
                                const visibleY = pos.outputOffScreen ? pos.y2 : pos.y1;
                                const clampY = pos.outputOffScreen ? pos.outputClampY : pos.inputClampY;
                                const rawLabel = pos.outputOffScreen ? pos.outputLabel : pos.inputLabel;
                                const isWarning = !compatibility.compatible;

                                // Shorten line, leave remaining gap for label flush against line end
                                const gapWidth = pos.gapRightX - pos.gapLeftX;
                                let lineEndX, foX, foWidth, textAlign;
                                const labelPad = 10;
                                if (pos.outputOffScreen) {
                                    lineEndX = pos.gapLeftX + gapWidth * 0.65;
                                    foX = pos.gapLeftX;
                                    foWidth = lineEndX - pos.gapLeftX - labelPad;
                                    textAlign = 'right';
                                } else {
                                    lineEndX = pos.gapRightX - gapWidth * 0.65;
                                    foX = lineEndX + labelPad;
                                    foWidth = pos.gapRightX - lineEndX - labelPad;
                                    textAlign = 'left';
                                }
                                const foHeight = 22;

                                return (
                                    <g
                                        key={pos.key}
                                        className="offscreen-group"
                                        onClick={() => {
                                            if (mapping) handleLineClick(mapping);
                                        }}
                                    >
                                        <line
                                            x1={visibleX}
                                            y1={visibleY}
                                            x2={lineEndX}
                                            y2={clampY}
                                            className={`connection-line-offscreen ${isWarning ? 'warning-line-offscreen' : ''}`}
                                        />
                                        <line
                                            x1={visibleX}
                                            y1={visibleY}
                                            x2={lineEndX}
                                            y2={clampY}
                                            className="connection-line-hitarea"
                                        />
                                        <circle
                                            cx={visibleX}
                                            cy={visibleY}
                                            r="3.5"
                                            className={`connection-dot ${isWarning ? 'warning-dot' : ''}`}
                                        />
                                        <circle
                                            cx={lineEndX}
                                            cy={clampY}
                                            r="2.5"
                                            className={`connection-dot-junction ${isWarning ? 'warning-dot' : ''}`}
                                        />
                                        {foWidth > 0 && (
                                            <foreignObject
                                                x={foX}
                                                y={clampY - foHeight / 2}
                                                width={foWidth}
                                                height={foHeight}
                                            >
                                                <div
                                                    className={`offscreen-label ${isWarning ? 'offscreen-label-warning' : ''}`}
                                                    style={{ textAlign }}
                                                    title={rawLabel}
                                                >
                                                    {rawLabel}
                                                </div>
                                            </foreignObject>
                                        )}
                                    </g>
                                );
                            }

                            const d = buildCurvePath(pos.x1, pos.y1, pos.x2, pos.y2);

                            return (
                                <g
                                    key={pos.key}
                                    onClick={() => {
                                        if (mapping) handleLineClick(mapping);
                                    }}
                                >
                                    <path
                                        d={d}
                                        className={`connection-line ${!compatibility.compatible ? 'warning-line' : ''}`}
                                    />
                                    <path d={d} className="connection-line-hitarea" />
                                    <circle
                                        cx={pos.x1}
                                        cy={pos.y1}
                                        r="3.5"
                                        className={`connection-dot ${!compatibility.compatible ? 'warning-dot' : ''}`}
                                    />
                                    <circle
                                        cx={pos.x2}
                                        cy={pos.y2}
                                        r="3.5"
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
                        <div className="io-items-scroll scrollbar-thin" ref={inputsScrollRef}>
                            {targetIO.inputs.map((input, idx, arr) => {
                                // Check if this input is mapped from an incompatible output
                                const mapping = mappings.find((m) => m.targetInput === input.name);
                                const compatibility = mapping
                                    ? getMappingCompatibility(mapping.sourceOutput, input.name)
                                    : { compatible: true };

                                // Also check if currently selected output would be incompatible
                                const selectedCompatibility = selectedOutput
                                    ? getMappingCompatibility(selectedOutput, input.name)
                                    : { compatible: true };

                                // Show group header when group changes (custom workflow nodes)
                                const showGroupHeader =
                                    targetIO.isCustomWorkflow && (idx === 0 || input.group !== arr[idx - 1]?.group);

                                // Show separator between required and optional inputs
                                // Only within the same group (or when no groups)
                                const sameGroup =
                                    !targetIO.isCustomWorkflow || (idx > 0 && input.group === arr[idx - 1]?.group);
                                const showOptionalSeparator =
                                    sameGroup && !input.required && idx > 0 && arr[idx - 1]?.required;

                                return (
                                    <React.Fragment key={input.name}>
                                        {showGroupHeader && (
                                            <div className="io-group-header">
                                                {input.group}
                                                {targetIO.groupInfo?.[input.group]?.scattered && (
                                                    <span className="group-scatter-badge">scattered</span>
                                                )}
                                                {targetIO.groupInfo?.[input.group]?.gathered && (
                                                    <span className="group-gather-badge">gathered</span>
                                                )}
                                            </div>
                                        )}
                                        {showOptionalSeparator && <div className="io-section-separator">optional</div>}
                                        <div
                                            ref={(el) => (inputRefs.current[input.name] = el)}
                                            className={`io-item input-item ${
                                                isInputMapped(input.name) ? 'mapped' : ''
                                            } ${selectedOutput ? 'clickable' : ''} ${
                                                !compatibility.compatible ? 'mismatch-warning' : ''
                                            } ${selectedOutput && !selectedCompatibility.compatible ? 'mismatch-warning-preview' : ''}`}
                                            onClick={() => handleInputClick(input.name)}
                                            title={
                                                !selectedCompatibility.compatible ? selectedCompatibility.reason : ''
                                            }
                                        >
                                            <div className="io-item-main">
                                                <span className="io-name">{input.name}</span>
                                                <span
                                                    className="io-type"
                                                    title={
                                                        input.type +
                                                        (input.acceptedExtensions?.length
                                                            ? ' (' + input.acceptedExtensions.join(', ') + ')'
                                                            : '') +
                                                        (input.enumSymbols?.length
                                                            ? ' (' + input.enumSymbols.join(', ') + ')'
                                                            : '')
                                                    }
                                                >
                                                    {formatTypeHint(input.type, input.acceptedExtensions)}
                                                </span>
                                            </div>
                                            {input.label && input.label !== input.name && (
                                                <div className="io-label">{input.label}</div>
                                            )}
                                            {input.enumSymbols?.length > 0 && (
                                                <div className="io-enum-values">
                                                    {input.enumSymbols.map((s) => `'${s}'`).join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mapping-instructions">
                    Click an output, then click an input to create a connection. Click on a line to remove it.
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
