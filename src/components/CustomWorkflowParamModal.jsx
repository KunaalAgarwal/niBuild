import { useState, useMemo, useEffect, useRef } from 'react';
import { Modal, Form, Button } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_TAGS } from '../utils/toolAnnotations.js';
import ExpressionEditor from './ExpressionEditor.jsx';
import { VALID_OPERATORS, getLibraryFromDockerImage } from '../utils/cwlConstants.js';
import { topoSort } from '../utils/topoSort.js';
import TagDropdown from './TagDropdown.jsx';
import ParamControl from './ParamControl.jsx';
import '../styles/workflowItem.css';

const CustomWorkflowParamModal = ({ show, onClose, workflowName, internalNodes, internalEdges, wiredInputs }) => {
    const nonDummyNodes = useMemo(() => (internalNodes || []).filter((n) => !n.isDummy), [internalNodes]);

    // Compute topological order for scatter propagation
    const firstNodeIndex = useMemo(() => {
        if (nonDummyNodes.length === 0) return 0;

        const nodeIds = new Set(nonDummyNodes.map((n) => n.id));
        const dummyIds = new Set((internalNodes || []).filter((n) => n.isDummy).map((n) => n.id));
        const realEdges = (internalEdges || []).filter(
            (e) => !dummyIds.has(e.source) && !dummyIds.has(e.target) && nodeIds.has(e.source) && nodeIds.has(e.target),
        );

        let order;
        try {
            order = topoSort(nonDummyNodes, realEdges);
        } catch {
            return 0;
        }

        const idToIndex = new Map(nonDummyNodes.map((n, i) => [n.id, i]));
        const topoIndices = order.map((id) => idToIndex.get(id)).filter((i) => i !== undefined);
        return topoIndices.length > 0 ? topoIndices[0] : 0;
    }, [nonDummyNodes, internalEdges, internalNodes]);

    const [currentIndex, setCurrentIndex] = useState(0);

    // Per-node state for the currently viewed node
    const [paramValues, setParamValues] = useState({});
    const [dockerVersion, setDockerVersion] = useState('latest');
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterToggles, setScatterToggles] = useState({});
    const [scatterMethod, setScatterMethod] = useState('dotproduct');
    const [whenParam, setWhenParam] = useState('');
    const [whenCondition, setWhenCondition] = useState('');
    const [whenTouched, setWhenTouched] = useState(false);
    const [expressionValues, setExpressionValues] = useState({});
    const [expressionToggles, setExpressionToggles] = useState({});
    const [linkMergeValues, setLinkMergeValues] = useState({});

    // Deep clone of internal nodes to track edits.
    // Ref mirrors state so the currentIndex effect (below) can read latest nodes
    // without re-firing when editedNodes changes.
    const [editedNodes, setEditedNodes] = useState([]);
    const editedNodesRef = useRef(editedNodes);
    editedNodesRef.current = editedNodes;

    // Load a node's data into all form state variables
    const loadNodeState = (node) => {
        if (!node) return;

        const existing = node.parameters;
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

        setDockerVersion(node.dockerVersion || 'latest');
        setVersionValid(true);
        setVersionWarning('');
        const scatterInit = {};
        if (Array.isArray(node.scatterInputs) && node.scatterInputs.length > 0) {
            node.scatterInputs.forEach((name) => {
                scatterInit[name] = true;
            });
        }
        // Force scatter on for inputs wired from internal BIDS nodes
        const bidsIds = new Set((internalNodes || []).filter((n) => n.isBIDS).map((n) => n.id));
        if (bidsIds.size > 0) {
            for (const edge of internalEdges || []) {
                if (bidsIds.has(edge.source) && edge.target === node.id) {
                    for (const m of edge.data?.mappings || []) {
                        scatterInit[m.targetInput] = true;
                    }
                }
            }
        }
        setScatterToggles(scatterInit);
        setScatterMethod(node.scatterMethod || 'dotproduct');
        setLinkMergeValues(node.linkMergeOverrides || {});

        const whenExpr = node.whenExpression || '';
        const whenMatch = whenExpr.match(/^\$\(inputs\.(\w+)\s*(.*)\)$/);
        if (whenMatch) {
            setWhenParam(whenMatch[1]);
            setWhenCondition(whenMatch[2]);
        } else {
            setWhenParam('');
            setWhenCondition('');
        }
        setWhenTouched(false);

        const savedExpressions = node.expressions || {};
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
    };

    // Initialize edited nodes and load first node state when modal opens
    useEffect(() => {
        if (show) {
            const freshNodes = structuredClone(nonDummyNodes);
            setEditedNodes(freshNodes);
            setCurrentIndex(0);
            loadNodeState(freshNodes[0]);
        }
    }, [show]);

    // Load node state when navigating between nodes (index changes only)
    useEffect(() => {
        if (!show) return;
        const node = editedNodesRef.current[currentIndex];
        if (node) loadNodeState(node);
    }, [currentIndex]);

    // Save current node's state back to editedNodes before navigating.
    // Uses editedNodesRef to avoid stale state from batched updates (H7).
    // Computes when-warning inline to avoid stale useMemo value (H6).
    const saveCurrentNodeState = () => {
        const current = editedNodesRef.current;
        if (current.length === 0) return current;

        const finalDockerVersion = dockerVersion.trim() || 'latest';
        const cleanedExpressions = {};
        Object.entries(expressionValues).forEach(([k, v]) => {
            if (v && v.trim()) {
                const trimmed = v.trim();
                cleanedExpressions[k] = trimmed.startsWith('$(') ? trimmed : `$(${trimmed})`;
            }
        });

        // Compute when-warning inline (not from useMemo) to get freshest validation
        let computedWhenWarning = null;
        if (whenParam) {
            const cond = whenCondition.trim();
            if (!cond) {
                computedWhenWarning = 'Enter a condition';
            } else {
                const hasOperator = VALID_OPERATORS.some((op) => cond.startsWith(op));
                if (!hasOperator) computedWhenWarning = 'Invalid operator';
                else {
                    const afterOp = cond.replace(/^(==|!=|>=|<=|>|<)\s*/, '');
                    if (!afterOp) computedWhenWarning = 'Missing value';
                }
            }
        }

        const whenExpression =
            whenParam && whenCondition.trim() && !computedWhenWarning
                ? `$(inputs.${whenParam} ${whenCondition.trim()})`
                : '';

        const activeScatterInputs = Object.entries(scatterToggles)
            .filter(([_, active]) => active)
            .map(([name]) => name);

        const updated = [...current];
        updated[currentIndex] = {
            ...updated[currentIndex],
            parameters: paramValues,
            dockerVersion: finalDockerVersion,
            scatterInputs: activeScatterInputs,
            scatterMethod: activeScatterInputs.length > 1 ? scatterMethod : undefined,
            linkMergeOverrides: linkMergeValues,
            whenExpression,
            expressions: cleanedExpressions,
        };

        return updated;
    };

    const navigateTo = (newIndex) => {
        const updated = saveCurrentNodeState();
        setEditedNodes(updated);
        setCurrentIndex(newIndex);
    };

    const handleSave = () => {
        const finalNodes = saveCurrentNodeState();
        // Map back to original internal nodes (including dummy nodes)
        const allUpdated = (internalNodes || []).map((origNode) => {
            if (origNode.isDummy) return origNode;
            const edited = finalNodes.find((e) => e.id === origNode.id);
            return edited || origNode;
        });
        onClose(allUpdated);
    };

    const handleCancel = () => {
        // Discard changes — pass back original unmodified nodes
        onClose(internalNodes);
    };

    // Get tool definition for current node
    const currentNode = editedNodes[currentIndex];

    // Filter wired inputs to the current internal node
    const currentNodeWiredInputs = useMemo(() => {
        if (!wiredInputs || !currentNode) return new Map();
        const prefix = `${currentNode.id}/`;
        const filtered = new Map();
        for (const [key, sources] of wiredInputs.entries()) {
            if (key.startsWith(prefix)) filtered.set(key.slice(prefix.length), sources);
        }
        return filtered;
    }, [wiredInputs, currentNode?.id]);

    const tool = useMemo(() => (currentNode ? getToolConfigSync(currentNode.label) : null), [currentNode?.label]);
    const dockerImage = tool?.dockerImage || null;

    // Compute which inputs of the current node are wired from internal BIDS nodes
    const bidsWiredInputs = useMemo(() => {
        if (!currentNode) return new Set();
        const bidsIds = new Set((internalNodes || []).filter((n) => n.isBIDS).map((n) => n.id));
        if (bidsIds.size === 0) return new Set();
        const wired = new Set();
        for (const edge of internalEdges || []) {
            if (bidsIds.has(edge.source) && edge.target === currentNode.id) {
                for (const m of edge.data?.mappings || []) {
                    wired.add(m.targetInput);
                }
            }
        }
        return wired;
    }, [currentNode?.id, internalNodes, internalEdges]);

    const allParams = useMemo(() => {
        if (!tool) return { required: [], optional: [] };
        const required = Object.entries(tool.requiredInputs || {}).map(([name, def]) => ({ name, ...def }));
        const optional = Object.entries(tool.optionalInputs || {}).map(([name, def]) => ({ name, ...def }));
        return { required, optional };
    }, [tool]);

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

    const library = dockerImage ? getLibraryFromDockerImage(dockerImage) : null;
    const knownTags = library ? DOCKER_TAGS[library] || ['latest'] : ['latest'];

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

    const updateParam = (name, value) => {
        setParamValues((prev) => ({ ...prev, [name]: value }));
    };

    const clampToBounds = (name, param) => {
        if (!param.bounds) return;
        setParamValues((prev) => {
            const val = prev[name];
            if (val === null || val === undefined) return prev;
            const [min, max] = param.bounds;
            if (val < min) return { ...prev, [name]: min };
            if (val > max) return { ...prev, [name]: max };
            return prev;
        });
    };

    const updateLinkMerge = (inputName, value) => {
        setLinkMergeValues((prev) => ({ ...prev, [inputName]: value }));
    };

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

    const handleToggleScatter = (paramName) => {
        setScatterToggles((prev) => ({ ...prev, [paramName]: !prev[paramName] }));
    };

    // Build scatter button for a param (context-specific logic stays here)
    const buildScatterButton = (param) => {
        const isFirstNode = currentIndex === firstNodeIndex;
        const isDownstreamScattered = !isFirstNode && (editedNodes[firstNodeIndex]?.scatterInputs?.length || 0) > 0;
        const isBIDSWired = bidsWiredInputs.has(param.name);

        if (isBIDSWired) {
            return (
                <span className="scatter-toggle active locked" title="Scatter forced by BIDS input">
                    {'\u21BB'}
                </span>
            );
        }
        if (isFirstNode) {
            return (
                <span
                    className={`scatter-toggle${scatterToggles[param.name] ? ' active' : ''}`}
                    onClick={() => handleToggleScatter(param.name)}
                    title={scatterToggles[param.name] ? 'Remove from scatter' : 'Add to scatter'}
                >
                    {'\u21BB'}
                </span>
            );
        }
        if (isDownstreamScattered) {
            return (
                <span
                    className="scatter-toggle locked"
                    title={`Inherited from ${nonDummyNodes[firstNodeIndex]?.label || 'root'}`}
                >
                    {'\u21BB'}
                </span>
            );
        }
        return null;
    };

    if (!currentNode) return null;

    return (
        <Modal show={show} onHide={handleCancel} centered className="custom-modal" size="lg">
            <Modal.Header>
                <Modal.Title style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{workflowName} - Parameters</span>
                    </div>
                    <div className="custom-workflow-nav">
                        <Button
                            variant="outline-light"
                            size="sm"
                            disabled={currentIndex === 0}
                            onClick={() => navigateTo(currentIndex - 1)}
                            className="custom-workflow-nav-btn"
                        >
                            &larr;
                        </Button>
                        <span className="custom-workflow-nav-label">
                            {currentNode.label} ({currentIndex + 1} of {nonDummyNodes.length})
                        </span>
                        <Button
                            variant="outline-light"
                            size="sm"
                            disabled={currentIndex === nonDummyNodes.length - 1}
                            onClick={() => navigateTo(currentIndex + 1)}
                            className="custom-workflow-nav-btn"
                        >
                            &rarr;
                        </Button>
                    </div>
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
                    </Form.Group>

                    {Object.values(scatterToggles).filter(Boolean).length > 1 && (
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
                    )}

                    {/* Parameters */}
                    <div className="params-scroll scrollbar-thin">
                        {[
                            { params: allParams.required, label: 'Required' },
                            { params: allParams.optional, label: 'Optional' },
                        ].map(
                            ({ params: sectionParams, label: sectionLabel }) =>
                                sectionParams.length > 0 && (
                                    <div key={sectionLabel} className="param-section">
                                        <div className="param-section-header">{sectionLabel}</div>
                                        {sectionParams.map((param) => {
                                            const isFileType = param.type === 'File' || param.type === 'Directory';
                                            const wiredSources = currentNodeWiredInputs.get(param.name) || [];
                                            return (
                                                <div
                                                    key={param.name}
                                                    className={`param-card ${isFileType && wiredSources.length > 0 ? 'input-wired' : ''} ${expressionValues[param.name] ? 'has-expression' : ''} ${scatterToggles[param.name] ? 'has-scatter' : ''}`}
                                                >
                                                    <div className="param-card-header">
                                                        <span className="param-name">{param.name}</span>
                                                        <span className="param-type-badge">{param.type}</span>
                                                        <ParamControl
                                                            param={param}
                                                            paramValues={paramValues}
                                                            updateParam={updateParam}
                                                            clampToBounds={clampToBounds}
                                                            expressionToggles={expressionToggles}
                                                            handleToggleFx={handleToggleFx}
                                                            scatterButton={buildScatterButton(param)}
                                                            nodeId={currentNode?.id}
                                                        />
                                                    </div>
                                                    {isFileType && wiredSources.length === 1 && (
                                                        <div className="input-source-single">
                                                            <span className="input-source">
                                                                from {wiredSources[0].sourceNodeLabel} /{' '}
                                                                {wiredSources[0].sourceOutput}
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
                                                                            {src.sourceNodeLabel} / {src.sourceOutput}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                                <Form.Select
                                                                    size="sm"
                                                                    className="link-merge-select"
                                                                    value={
                                                                        linkMergeValues[param.name] || 'merge_flattened'
                                                                    }
                                                                    onChange={(e) =>
                                                                        updateLinkMerge(param.name, e.target.value)
                                                                    }
                                                                >
                                                                    <option value="merge_flattened">
                                                                        merge_flattened
                                                                    </option>
                                                                    <option value="merge_nested">merge_nested</option>
                                                                </Form.Select>
                                                            </div>
                                                            <div className="merge-help-text">
                                                                flattened combines all into one list [x1, x2] — nested
                                                                preserves grouping per source [[x1], [x2]]
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
                                                </div>
                                            );
                                        })}
                                    </div>
                                ),
                        )}

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
            <Modal.Footer>
                <Button variant="secondary" size="sm" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button variant="primary" size="sm" onClick={handleSave}>
                    Save
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default CustomWorkflowParamModal;
