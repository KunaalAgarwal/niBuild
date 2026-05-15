import { useState, useMemo, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_TAGS } from '../utils/toolAnnotations.js';
import ExpressionEditor from './ExpressionEditor.jsx';
import { VALID_OPERATORS, getLibraryFromDockerImage } from '../utils/cwlConstants.js';
import { topoSort } from '../utils/topoSort.js';
import TagDropdown from './TagDropdown.jsx';
import ParamControl from './ParamControl.jsx';
import '../styles/workflowItem.css';

/**
 * Compute the per-node form state from a saved node (analogous to loadNodeState in the modal).
 */
function computeNodeFormState(node, internalNodes, internalEdges) {
    if (!node) {
        return {
            paramValues: {},
            dockerVersion: 'latest',
            scatterToggles: {},
            scatterMethod: 'dotproduct',
            whenParam: '',
            whenCondition: '',
            whenTouched: false,
            expressionValues: {},
            expressionToggles: {},
            linkMergeValues: {},
        };
    }

    const existing = node.parameters;
    let paramValues = {};
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        paramValues = { ...existing };
    } else if (typeof existing === 'string' && existing.trim()) {
        try {
            paramValues = JSON.parse(existing);
        } catch {
            paramValues = {};
        }
    }

    const scatterInit = {};
    if (Array.isArray(node.scatterInputs) && node.scatterInputs.length > 0) {
        node.scatterInputs.forEach((name) => {
            scatterInit[name] = true;
        });
    }
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

    const whenExpr = node.whenExpression || '';
    const whenMatch = whenExpr.match(/^\$\(inputs\.(\w+)\s*(.*)\)$/);
    const whenParam = whenMatch ? whenMatch[1] : '';
    const whenCondition = whenMatch ? whenMatch[2] : '';

    const savedExpressions = node.expressions || {};
    const expressionValues = {};
    const expressionToggles = {};
    Object.entries(savedExpressions).forEach(([k, v]) => {
        if (v) {
            const match = v.match(/^\$\((.*)\)$/s);
            expressionValues[k] = match ? match[1] : v;
            expressionToggles[k] = true;
        }
    });

    return {
        paramValues,
        dockerVersion: node.dockerVersion || 'latest',
        scatterToggles: scatterInit,
        scatterMethod: node.scatterMethod || 'dotproduct',
        whenParam,
        whenCondition,
        whenTouched: false,
        expressionValues,
        expressionToggles,
        linkMergeValues: node.linkMergeOverrides || {},
    };
}

/**
 * CustomWorkflowParamPanel — body of CustomWorkflowParamModal extracted as a reusable panel.
 * Works in both modal and tab modes.
 *
 * `initialDraft` (optional) — when provided (from Expand-to-tab), seeds all state at once.
 * Otherwise the panel initializes from `internalNodes[0]`.
 *
 * Imperative handle: `getDraftState()` returns the current internal state for tab transfer.
 */
const CustomWorkflowParamPanel = forwardRef(function CustomWorkflowParamPanel(
    {
        workflowName,
        internalNodes,
        internalEdges,
        wiredInputs,
        initialDraft = null,
        onSave,
        onCancel,
        onExpand = null,
        onDirtyChange = null,
        mode = 'modal',
    },
    ref,
) {
    // Ref-mirror onDirtyChange so the dirty-watch effect doesn't need it as a
    // dep (caller doesn't have to memoize).
    const onDirtyChangeRef = useRef(onDirtyChange);
    onDirtyChangeRef.current = onDirtyChange;
    const nonDummyNodes = useMemo(() => (internalNodes || []).filter((n) => !n.isDummy), [internalNodes]);

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

    // One-shot initial-state computation — runs exactly once.
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        if (initialDraft) {
            initialStateRef.current = {
                editedNodes: initialDraft.editedNodes || structuredClone(nonDummyNodes),
                currentIndex: initialDraft.currentIndex ?? 0,
                paramValues: initialDraft.paramValues || {},
                dockerVersion: initialDraft.dockerVersion || 'latest',
                scatterToggles: initialDraft.scatterToggles || {},
                scatterMethod: initialDraft.scatterMethod || 'dotproduct',
                whenParam: initialDraft.whenParam || '',
                whenCondition: initialDraft.whenCondition || '',
                whenTouched: initialDraft.whenTouched || false,
                expressionValues: initialDraft.expressionValues || {},
                expressionToggles: initialDraft.expressionToggles || {},
                linkMergeValues: initialDraft.linkMergeValues || {},
            };
        } else {
            const freshNodes = structuredClone(nonDummyNodes);
            const computed = computeNodeFormState(freshNodes[0], internalNodes, internalEdges);
            initialStateRef.current = {
                editedNodes: freshNodes,
                currentIndex: 0,
                ...computed,
            };
        }
    }
    const init = initialStateRef.current;

    const [editedNodes, setEditedNodes] = useState(init.editedNodes);
    const [currentIndex, setCurrentIndex] = useState(init.currentIndex);
    const [paramValues, setParamValues] = useState(init.paramValues);
    const [dockerVersion, setDockerVersion] = useState(init.dockerVersion);
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterToggles, setScatterToggles] = useState(init.scatterToggles);
    const [scatterMethod, setScatterMethod] = useState(init.scatterMethod);
    const [whenParam, setWhenParam] = useState(init.whenParam);
    const [whenCondition, setWhenCondition] = useState(init.whenCondition);
    const [whenTouched, setWhenTouched] = useState(init.whenTouched);
    const [expressionValues, setExpressionValues] = useState(init.expressionValues);
    const [expressionToggles, setExpressionToggles] = useState(init.expressionToggles);
    const [linkMergeValues, setLinkMergeValues] = useState(init.linkMergeValues);

    const editedNodesRef = useRef(editedNodes);
    editedNodesRef.current = editedNodes;

    // Apply a node's state into the form (used on navigation).
    const loadNodeState = (node) => {
        if (!node) return;
        const s = computeNodeFormState(node, internalNodes, internalEdges);
        setParamValues(s.paramValues);
        setDockerVersion(s.dockerVersion);
        setVersionValid(true);
        setVersionWarning('');
        setScatterToggles(s.scatterToggles);
        setScatterMethod(s.scatterMethod);
        setWhenParam(s.whenParam);
        setWhenCondition(s.whenCondition);
        setWhenTouched(false);
        setExpressionValues(s.expressionValues);
        setExpressionToggles(s.expressionToggles);
        setLinkMergeValues(s.linkMergeValues);
    };

    // Skip the first render's index effect — initial state was already seeded.
    const isFirstIndexEffect = useRef(true);
    useEffect(() => {
        if (isFirstIndexEffect.current) {
            isFirstIndexEffect.current = false;
            return;
        }
        const node = editedNodesRef.current[currentIndex];
        if (node) loadNodeState(node);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentIndex]);

    // ---- Dirty tracking -------------------------------------------------------
    // State is synchronously initialized via initialStateRef, so a "first render"
    // guard cleanly distinguishes mount from later state changes. Navigation
    // (currentIndex change) triggers loadNodeState which resets form state — we
    // skip that emission via `navigationLoadInProgressRef` so navigating between
    // internal nodes without editing doesn't spuriously mark the panel dirty.
    const navigationLoadInProgressRef = useRef(false);
    const isFirstDirtyRenderRef = useRef(true);
    useEffect(() => {
        if (isFirstDirtyRenderRef.current) {
            isFirstDirtyRenderRef.current = false;
            if (initialDraft) onDirtyChangeRef.current?.(true);
            return;
        }
        if (navigationLoadInProgressRef.current) {
            navigationLoadInProgressRef.current = false;
            return;
        }
        onDirtyChangeRef.current?.(true);
        // initialDraft captured at mount; later identity changes don't matter.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        paramValues,
        dockerVersion,
        scatterToggles,
        scatterMethod,
        whenParam,
        whenCondition,
        whenTouched,
        expressionValues,
        expressionToggles,
        linkMergeValues,
    ]);

    // Save current node's form values into editedNodes (used before navigating away).
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

    // Expose the current in-progress draft for Expand-to-tab.
    useImperativeHandle(
        ref,
        () => ({
            getDraftState: () => ({
                editedNodes: editedNodesRef.current,
                currentIndex,
                paramValues,
                dockerVersion,
                scatterToggles,
                scatterMethod,
                whenParam,
                whenCondition,
                whenTouched,
                expressionValues,
                expressionToggles,
                linkMergeValues,
            }),
        }),
        [
            currentIndex,
            paramValues,
            dockerVersion,
            scatterToggles,
            scatterMethod,
            whenParam,
            whenCondition,
            whenTouched,
            expressionValues,
            expressionToggles,
            linkMergeValues,
        ],
    );

    const navigateTo = (newIndex) => {
        const updated = saveCurrentNodeState();
        setEditedNodes(updated);
        setCurrentIndex(newIndex);
        // Tell the dirty-watch effect that the next form-state mutation (from
        // loadNodeState in the [currentIndex] effect above) is a navigation,
        // not a user edit — it should skip the emission.
        navigationLoadInProgressRef.current = true;
    };

    const handleSave = () => {
        const finalNodes = saveCurrentNodeState();
        const allUpdated = (internalNodes || []).map((origNode) => {
            if (origNode.isDummy) return origNode;
            const edited = finalNodes.find((e) => e.id === origNode.id);
            return edited || origNode;
        });
        onSave(allUpdated);
        // Clear dirty after dispatching the save (mirrors ToolParamPanel /
        // BIDSDataPanel). In the aux-tab path the tab also closes in a
        // microtask — both dispatches batch.
        onDirtyChangeRef.current?.(false);
    };

    const handleCancel = () => {
        onCancel(internalNodes);
    };

    const currentNode = editedNodes[currentIndex];

    const currentNodeWiredInputs = useMemo(() => {
        if (!wiredInputs || !currentNode) return new Map();
        const prefix = `${currentNode.id}/`;
        const filtered = new Map();
        for (const [key, sources] of wiredInputs.entries()) {
            if (key.startsWith(prefix)) filtered.set(key.slice(prefix.length), sources);
        }
        return filtered;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [wiredInputs, currentNode?.id]);

    const tool = useMemo(
        () => (currentNode ? getToolConfigSync(currentNode.label) : null),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [currentNode?.label],
    );
    const dockerImage = tool?.dockerImage || null;

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentNode?.id, internalNodes, internalEdges]);

    const allParams = useMemo(() => {
        if (!tool) return { required: [], optional: [] };
        const required = Object.entries(tool.requiredInputs || {}).map(([name, def]) => ({ name, ...def }));
        const optional = Object.entries(tool.optionalInputs || {}).map(([name, def]) => ({ name, ...def }));
        return { required, optional };
    }, [tool]);

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

    const buildScatterButton = (param) => {
        const isFirstNode = currentIndex === firstNodeIndex;
        const isDownstreamScattered = !isFirstNode && (editedNodes[firstNodeIndex]?.scatterInputs?.length || 0) > 0;
        const isBIDSWired = bidsWiredInputs.has(param.name);

        if (isBIDSWired) {
            return (
                <span className="scatter-toggle active locked" title="Scatter forced by BIDS input">
                    {'↻'}
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
                    {'↻'}
                </span>
            );
        }
        if (isDownstreamScattered) {
            return (
                <span
                    className="scatter-toggle locked"
                    title={`Inherited from ${nonDummyNodes[firstNodeIndex]?.label || 'root'}`}
                >
                    {'↻'}
                </span>
            );
        }
        return null;
    };

    if (!currentNode) return null;

    const wrapperClass = `custom-workflow-param-panel${mode === 'tab' ? ' custom-workflow-param-panel--tab' : ''}`;

    return (
        <div className={wrapperClass}>
            <div className="custom-workflow-param-panel-header">
                <div className="custom-workflow-param-panel-header-main">
                    {mode === 'tab' && (
                        <div className="custom-workflow-param-title">
                            <span>{workflowName} - Parameters</span>
                        </div>
                    )}
                    <div className={`custom-workflow-nav${mode === 'modal' ? ' custom-workflow-nav--alone' : ''}`}>
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
                </div>
                {onExpand && (
                    <button
                        type="button"
                        className="custom-workflow-param-panel-expand-btn"
                        onClick={onExpand}
                        title="Open in tab"
                        aria-label="Open in tab"
                    >
                        expand
                    </button>
                )}
            </div>

            <div className="custom-workflow-param-panel-body" onClick={(e) => e.stopPropagation()}>
                <Form>
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
                                    'Pairs elements 1:1 across inputs (arrays must be the same length). [A,B] × [1,2] → (A,1), (B,2)'}
                                {scatterMethod === 'flat_crossproduct' &&
                                    'Cartesian product of all inputs — results in a flat list. [A,B] × [1,2] → (A,1), (A,2), (B,1), (B,2)'}
                                {scatterMethod === 'nested_crossproduct' &&
                                    'Cartesian product — results nested by the first input. [A,B] × [1,2] → [(A,1),(A,2)], [(B,1),(B,2)]'}
                            </div>
                        </Form.Group>
                    )}

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
            </div>

            <div className="custom-workflow-param-panel-footer">
                <Button className="btn-cancel" size="sm" onClick={handleCancel}>
                    Cancel
                </Button>
                <Button className="btn-save" size="sm" onClick={handleSave}>
                    Save
                </Button>
            </div>
        </div>
    );
});

export default CustomWorkflowParamPanel;
