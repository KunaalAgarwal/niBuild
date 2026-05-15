import { useState, useMemo, useRef, useEffect, useCallback, useId, useImperativeHandle, forwardRef } from 'react';
import { Form, Button } from 'react-bootstrap';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { DOCKER_TAGS } from '../utils/toolAnnotations.js';
import { getActiveOperations } from '../utils/getActiveOperations.js';
import ExpressionEditor from './ExpressionEditor.jsx';
import { VALID_OPERATORS, getLibraryFromDockerImage } from '../utils/cwlConstants.js';
import TagDropdown from './TagDropdown.jsx';
import ParamControl from './ParamControl.jsx';
import OperationOrderPanel from './OperationOrderPanel.jsx';
import ToolParamPanelTOC from './ToolParamPanelTOC.jsx';
import { useScrollSpy } from '../hooks/useScrollSpy.js';
import '../styles/workflowItem.css';
import '../styles/toolParamPanel.css';

/**
 * Compute the initial form state from a saved tool node's `data` object.
 * Mirrors the initialization in the old ToolNodeComponent.handleOpenModal.
 */
function computeFormStateFromNode(nodeData, upstreamScatterInputs) {
    // Scatter toggles: saved scatterInputs + auto-suggest from upstream
    const scatterToggles = {};
    const savedScatter = nodeData?.scatterInputs || [];
    savedScatter.forEach((name) => {
        scatterToggles[name] = true;
    });
    (upstreamScatterInputs || new Set()).forEach((name) => {
        scatterToggles[name] = true;
    });

    // Conditional expression: strip $(inputs.<name> <cond>) → (name, cond)
    const whenExpr = nodeData?.whenExpression || '';
    const whenMatch = whenExpr.match(/^\$\(inputs\.(\w+)\s+(.*)\)$/);
    const whenParam = whenMatch ? whenMatch[1] : '';
    const whenCondition = whenMatch ? whenMatch[2] : '';

    // Expressions: strip $() wrapper for display
    const savedExpressions = nodeData?.expressions || {};
    const expressionValues = {};
    const expressionToggles = {};
    Object.entries(savedExpressions).forEach(([k, v]) => {
        if (v) {
            const match = v.match(/^\$\((.*)\)$/s);
            expressionValues[k] = match ? match[1] : v;
            expressionToggles[k] = true;
        }
    });

    // Parameter values (object or legacy JSON string)
    const existing = nodeData?.parameters;
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

    return {
        paramValues,
        dockerVersion: nodeData?.dockerVersion || 'latest',
        scatterToggles,
        scatterMethod: nodeData?.scatterMethod || 'dotproduct',
        linkMergeValues: nodeData?.linkMergeOverrides || {},
        whenParam,
        whenCondition,
        whenTouched: false,
        expressionValues,
        expressionToggles,
        operationOrder: nodeData?.operationOrder || [],
    };
}

/**
 * ToolParamPanel — body of the former ToolNodeComponent inline modal, extracted as a
 * reusable panel that renders inside the IDE's aux-tab area.
 *
 * `initialDraft` (optional) — when provided, seeds all state at once. Otherwise the
 * panel initializes from `nodeData` (the live node.data object).
 *
 * Imperative handle: `getDraftState()` returns the current internal state. Kept for
 * symmetry with sibling panels (no live modal→tab transfer remains, but the contract
 * is convenient for future debugging / state inspection).
 */
const ToolParamPanel = forwardRef(function ToolParamPanel(
    {
        nodeData,
        nodeId,
        workflowName = 'Workspace',
        upstreamScatterInputs,
        wiredInputs,
        initialDraft = null,
        onSave,
        onExpand = null,
        onDirtyChange = null,
        mode = 'tab',
    },
    ref,
) {
    // Ref-mirror onDirtyChange so the dirty-watch effect doesn't need it as a
    // dep (caller doesn't have to memoize).
    const onDirtyChangeRef = useRef(onDirtyChange);
    onDirtyChangeRef.current = onDirtyChange;
    // Tool definition (from registry, keyed by label).
    const tool = useMemo(() => getToolConfigSync(nodeData?.label), [nodeData?.label]);
    const dockerImage = tool?.dockerImage || null;

    // One-shot initial-state computation — runs exactly once.
    const initialStateRef = useRef(null);
    if (initialStateRef.current === null) {
        initialStateRef.current = initialDraft
            ? {
                  paramValues: initialDraft.paramValues || {},
                  dockerVersion: initialDraft.dockerVersion || 'latest',
                  scatterToggles: initialDraft.scatterToggles || {},
                  scatterMethod: initialDraft.scatterMethod || 'dotproduct',
                  linkMergeValues: initialDraft.linkMergeValues || {},
                  whenParam: initialDraft.whenParam || '',
                  whenCondition: initialDraft.whenCondition || '',
                  whenTouched: initialDraft.whenTouched || false,
                  expressionValues: initialDraft.expressionValues || {},
                  expressionToggles: initialDraft.expressionToggles || {},
                  operationOrder: initialDraft.operationOrder || [],
              }
            : computeFormStateFromNode(nodeData, upstreamScatterInputs);
    }
    const init = initialStateRef.current;

    const [paramValues, setParamValues] = useState(init.paramValues);
    const [dockerVersion, setDockerVersion] = useState(init.dockerVersion);
    const [versionValid, setVersionValid] = useState(true);
    const [versionWarning, setVersionWarning] = useState('');
    const [scatterToggles, setScatterToggles] = useState(init.scatterToggles);
    const [scatterMethod, setScatterMethod] = useState(init.scatterMethod);
    const [linkMergeValues, setLinkMergeValues] = useState(init.linkMergeValues);
    const [whenParam, setWhenParam] = useState(init.whenParam);
    const [whenCondition, setWhenCondition] = useState(init.whenCondition);
    const [whenTouched, setWhenTouched] = useState(init.whenTouched);
    const [expressionValues, setExpressionValues] = useState(init.expressionValues);
    const [expressionToggles, setExpressionToggles] = useState(init.expressionToggles);
    const [operationOrder, setOperationOrder] = useState(init.operationOrder);

    // All parameters split into required and optional
    const allParams = useMemo(() => {
        if (!tool) return { required: [], optional: [] };
        const required = Object.entries(tool.requiredInputs || {}).map(([name, def]) => ({ name, ...def }));
        const optional = Object.entries(tool.optionalInputs || {}).map(([name, def]) => ({ name, ...def }));
        return { required, optional };
    }, [tool]);

    // Disable the "+" toggle buttons when the order panel wouldn't be visible (< 2 active ops).
    const orderPanelVisible = useMemo(() => {
        if (!tool?.orderSensitive) return false;
        const all = [...allParams.required, ...allParams.optional];
        return getActiveOperations(all, paramValues, wiredInputs, operationOrder).length >= 2;
    }, [tool, allParams, paramValues, wiredInputs, operationOrder]);

    // ---- TOC descriptor + scroll-spy ------------------------------------------------
    // The TOC mirrors the conditional render of each section below. The Parameters
    // parent's `id` aliases the first visible subgroup so click-to-jump and
    // ancestor-active highlighting flow consistently. See plan file (sunny-catmull)
    // and `useScrollSpy` for the observer mechanics.
    //
    // Every observable DOM id is prefixed with `instanceId` so a sidebar render and
    // an aux-tab render of the same node — which would otherwise emit identical ids
    // for both panels and confuse `document.getElementById` lookups — stay isolated.
    // useId's colon delimiters aren't valid in some serialization contexts, so strip
    // them out and prepend a stable token.
    const rawInstanceId = useId();
    const instanceId = useMemo(() => `tp-${rawInstanceId.replace(/[^a-zA-Z0-9]/g, '')}`, [rawInstanceId]);

    const scatterMethodVisible = useMemo(
        () => Object.values(scatterToggles).filter(Boolean).length > 1,
        [scatterToggles],
    );

    const sections = useMemo(() => {
        const result = [];
        if (dockerImage) {
            result.push({ id: `${instanceId}-section-docker`, label: 'Docker', type: 'top' });
        }
        result.push({ id: `${instanceId}-section-when`, label: 'Conditional', type: 'top' });
        if (tool?.orderSensitive && orderPanelVisible) {
            result.push({ id: `${instanceId}-section-op-order`, label: 'Operation Order', type: 'top' });
        }
        if (scatterMethodVisible) {
            result.push({ id: `${instanceId}-section-scatter`, label: 'Scatter Method', type: 'top' });
        }
        if (!tool) {
            result.push({ id: `${instanceId}-section-params`, label: 'Parameters', type: 'top' });
        } else {
            const paramsChildren = [];
            if (allParams.required.length > 0) {
                paramsChildren.push({
                    id: `${instanceId}-section-params-required`,
                    label: 'Required',
                    type: 'subgroup',
                    children: allParams.required.map((p) => ({
                        id: `${instanceId}-param-required-${p.name}`,
                        label: p.name,
                    })),
                });
            }
            if (allParams.optional.length > 0) {
                paramsChildren.push({
                    id: `${instanceId}-section-params-optional`,
                    label: 'Optional',
                    type: 'subgroup',
                    children: allParams.optional.map((p) => ({
                        id: `${instanceId}-param-optional-${p.name}`,
                        label: p.name,
                    })),
                });
            }
            if (paramsChildren.length > 0) {
                result.push({
                    // Parent id aliases the first subgroup so clicking "Parameters"
                    // lands at the top of the first visible block.
                    id: paramsChildren[0].id,
                    label: 'Parameters',
                    type: 'paramsGroup',
                    children: paramsChildren,
                });
            }
        }
        return result;
    }, [instanceId, dockerImage, tool, orderPanelVisible, scatterMethodVisible, allParams]);

    // Flatten the descriptor into the list of dom ids that scroll-spy should observe.
    // The Parameters parent's id is omitted because it aliases its first child's id.
    const scrollSpyIds = useMemo(() => {
        const ids = [];
        for (const s of sections) {
            if (s.type === 'paramsGroup') {
                for (const sub of s.children || []) {
                    ids.push(sub.id);
                    for (const leaf of sub.children || []) ids.push(leaf.id);
                }
            } else {
                ids.push(s.id);
            }
        }
        return ids;
    }, [sections]);

    // State-backed ref callback so the scroll-spy hook re-runs once the main pane
    // DOM node mounts — useRef wouldn't trigger a re-render on attachment.
    const [mainPaneEl, setMainPaneEl] = useState(null);

    // suppressRef is read by the scroll-spy hook to skip state updates while a
    // programmatic smooth-scroll is in flight. forcedActiveId optimistically
    // reflects the clicked TOC entry so the highlight doesn't flicker through
    // intermediate sections as the smooth scroll passes over them.
    const suppressScrollSpyRef = useRef(false);
    const suppressTimerRef = useRef(null);
    const [forcedActiveId, setForcedActiveId] = useState(null);

    const { activeId } = useScrollSpy({
        ids: scrollSpyIds,
        container: mainPaneEl,
        suppressRef: suppressScrollSpyRef,
    });

    const displayActiveId = forcedActiveId ?? activeId;

    const handleTocJump = useCallback((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        suppressScrollSpyRef.current = true;
        setForcedActiveId(id);
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        suppressTimerRef.current = setTimeout(() => {
            suppressScrollSpyRef.current = false;
            setForcedActiveId(null);
        }, 650);
    }, []);

    // Clear any pending suppress timer on unmount so it can't fire against a
    // stale component (re-keying on nodeId remounts this).
    useEffect(
        () => () => {
            if (suppressTimerRef.current) clearTimeout(suppressTimerRef.current);
        },
        [],
    );

    // ---- Dirty tracking -------------------------------------------------------
    // State is synchronously initialized via initialStateRef, so a "first render"
    // guard cleanly distinguishes mount from later user edits. If `initialDraft`
    // is provided (expand-to-tab carried a draft over), mark dirty on mount —
    // the draft itself represents unsaved edits.
    const isFirstDirtyRenderRef = useRef(true);
    useEffect(() => {
        if (isFirstDirtyRenderRef.current) {
            isFirstDirtyRenderRef.current = false;
            if (initialDraft) onDirtyChangeRef.current?.(true);
            return;
        }
        onDirtyChangeRef.current?.(true);
        // Reason: initialDraft is captured at mount via initialStateRef; subsequent prop identity changes don't affect mount-time dirty inference.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        paramValues,
        dockerVersion,
        scatterToggles,
        scatterMethod,
        linkMergeValues,
        whenParam,
        whenCondition,
        whenTouched,
        expressionValues,
        expressionToggles,
        operationOrder,
    ]);

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

    // Known docker tags for this tool's image
    const library = dockerImage ? getLibraryFromDockerImage(dockerImage) : null;
    const knownTags = library ? DOCKER_TAGS[library] || ['latest'] : ['latest'];

    // Whether this node is a gather node — derived from wiredInputs. The old modal
    // received `isGatherNode` as a prop, but it's only used to lock scatter on array
    // inputs that have any wired sources. We pass it through `wiredInputs` lookups.
    const isGatherNode = nodeData?.isGatherNode === true; // hint optional; default false

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
        const val = paramValues[name];
        if (val === null || val === undefined || !param.bounds) return;
        const [min, max] = param.bounds;
        if (val < min) updateParam(name, min);
        else if (val > max) updateParam(name, max);
    };

    const updateLinkMerge = (inputName, value) => {
        setLinkMergeValues((prev) => ({ ...prev, [inputName]: value }));
    };

    const handleToggleScatter = (paramName) => {
        setScatterToggles((prev) => ({ ...prev, [paramName]: !prev[paramName] }));
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

    const buildScatterButton = (param) => {
        const isScatterLocked = (upstreamScatterInputs || new Set()).has(param.name);
        const isGatherLocked =
            isGatherNode && param.type?.endsWith('[]') && (wiredInputs?.get?.(param.name) || []).length > 0;
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
                {'↻'}
            </span>
        );
    };

    const toggleFileInOrder = (name) => {
        setOperationOrder((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
    };

    // Expose the current in-progress draft (consistent with sibling panels).
    useImperativeHandle(
        ref,
        () => ({
            getDraftState: () => ({
                paramValues,
                dockerVersion,
                scatterToggles,
                scatterMethod,
                linkMergeValues,
                whenParam,
                whenCondition,
                whenTouched,
                expressionValues,
                expressionToggles,
                operationOrder,
            }),
        }),
        [
            paramValues,
            dockerVersion,
            scatterToggles,
            scatterMethod,
            linkMergeValues,
            whenParam,
            whenCondition,
            whenTouched,
            expressionValues,
            expressionToggles,
            operationOrder,
        ],
    );

    const handleSave = () => {
        const finalDockerVersion = dockerVersion.trim() || 'latest';
        if (finalDockerVersion !== dockerVersion) setDockerVersion(finalDockerVersion);

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

        onSave({
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
        // Clear dirty after dispatching the save. In the aux-tab path the parent
        // also closes the tab in a microtask — both dispatches batch and the dot
        // simply vanishes alongside the tab. In the sidebar path the panel stays
        // mounted and the dot clears.
        onDirtyChangeRef.current?.(false);
    };

    const wrapperClass = `tool-param-panel${mode === 'tab' ? ' tool-param-panel--tab' : ''}`;

    return (
        <div className={wrapperClass}>
            <div className="tool-param-panel-header">
                <div className="tool-param-breadcrumb">
                    <span className="tool-param-breadcrumb-workflow" title={workflowName}>
                        {workflowName}
                    </span>
                    <span className="tool-param-breadcrumb-sep" aria-hidden="true">
                        ›
                    </span>
                    <span className="tool-param-breadcrumb-tool">
                        {nodeData?.displayLabel || nodeData?.label || 'node'}
                    </span>
                </div>
                {onExpand && (
                    <button
                        type="button"
                        className="tool-param-panel-expand-btn"
                        onClick={onExpand}
                        title="Open in tab"
                        aria-label="Open in tab"
                    >
                        expand
                    </button>
                )}
            </div>

            <div className="tool-param-panel-body" onClick={(e) => e.stopPropagation()}>
                <div className="tool-param-panel-layout">
                    <ToolParamPanelTOC sections={sections} activeId={displayActiveId} onJump={handleTocJump} />
                    <div className="tool-param-panel-main" ref={setMainPaneEl}>
                        <Form>
                            {/* Docker Image */}
                            {dockerImage && (
                                <div className="param-section" id={`${instanceId}-section-docker`}>
                                    <div className="param-section-header">Docker</div>
                                    <div className="param-row">
                                        <div className="param-row-main">
                                            <span className="param-name">image</span>
                                            <div className="param-control">
                                                <TagDropdown
                                                    value={dockerVersion}
                                                    onChange={setDockerVersion}
                                                    onBlur={() => validateDockerVersion(dockerVersion)}
                                                    tags={knownTags}
                                                    placeholder="latest"
                                                    isValid={versionValid}
                                                    prefix={`${dockerImage}:`}
                                                />
                                            </div>
                                        </div>
                                        {versionWarning && <div className="docker-warning-text">{versionWarning}</div>}
                                        <div className="docker-help-text">Select a tag or enter a custom version</div>
                                    </div>
                                </div>
                            )}

                            {/* Conditional expression builder */}
                            <div className="param-section" id={`${instanceId}-section-when`}>
                                <div className="param-section-header">Conditional (when)</div>
                                <div className="param-row">
                                    <div className="param-row-main">
                                        <span className="param-name">trigger</span>
                                        <div className="param-control">
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
                                        </div>
                                    </div>
                                    {whenParam && whenCondition.trim() && !whenWarning && (
                                        <div className="when-preview">
                                            $(inputs.{whenParam} {whenCondition.trim()})
                                        </div>
                                    )}
                                    {whenWarning && <div className="when-warning-text">{whenWarning}</div>}
                                    <div className="when-help-text">
                                        Select an input parameter, then write a condition (e.g., == true, &gt; 0.5, !=
                                        null). Step only runs when the condition is true. Skipped steps produce null
                                        outputs.
                                    </div>
                                </div>
                            </div>

                            {/* Operation ordering for tools like fslmaths.
                        OperationOrderPanel renders its own .operation-order-group with an internal
                        label; toolParamPanel.css promotes that label to section-header treatment so
                        the rhythm stays consistent without modifying the leaf widget.
                        Wrapped in a `<section>` carrying the TOC scroll target id; gated on
                        `orderPanelVisible` (≥2 active ops) so we don't render an empty anchor
                        when the child would self-hide. */}
                            {tool?.orderSensitive && orderPanelVisible && (
                                <section id={`${instanceId}-section-op-order`}>
                                    <OperationOrderPanel
                                        allParams={[...allParams.required, ...allParams.optional]}
                                        paramValues={paramValues}
                                        wiredInputs={wiredInputs}
                                        operationOrder={operationOrder}
                                        onOrderChange={setOperationOrder}
                                    />
                                </section>
                            )}

                            {/* Scatter Method (visible only when 2+ scatter inputs active) */}
                            {scatterMethodVisible && (
                                <div className="param-section" id={`${instanceId}-section-scatter`}>
                                    <div className="param-section-header">Scatter Method</div>
                                    <div className="param-row">
                                        <div className="param-row-main">
                                            <span className="param-name">method</span>
                                            <div className="param-control">
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
                                            </div>
                                        </div>
                                        <div className="scatter-method-help-text">
                                            {scatterMethod === 'dotproduct' &&
                                                'Pairs elements 1:1 across inputs (arrays must be the same length). [A,B] × [1,2] → (A,1), (B,2)'}
                                            {scatterMethod === 'flat_crossproduct' &&
                                                'Cartesian product of all inputs — results in a flat list. [A,B] × [1,2] → (A,1), (A,2), (B,1), (B,2)'}
                                            {scatterMethod === 'nested_crossproduct' &&
                                                'Cartesian product — results nested by the first input. [A,B] × [1,2] → [(A,1),(A,2)], [(B,1),(B,2)]'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Unified Parameter Pane.
                        Each `.param-section` carries a stable id matching its TOC entry; each
                        `.param-card` carries a `param-<group>-<name>` id so the TOC's indented
                        leaf links and scroll-spy share a 1:1 map with the DOM. */}
                            <div className="params-scroll scrollbar-thin">
                                {[
                                    { params: allParams.required, label: 'Required', group: 'required' },
                                    { params: allParams.optional, label: 'Optional', group: 'optional' },
                                ].map(
                                    ({ params: sectionParams, label: sectionLabel, group: sectionGroup }) =>
                                        sectionParams.length > 0 && (
                                            <div
                                                key={sectionLabel}
                                                className="param-section"
                                                id={`${instanceId}-section-params-${sectionGroup}`}
                                            >
                                                <div className="param-section-header">{sectionLabel}</div>
                                                {sectionParams.map((param) => {
                                                    const wiredSources = wiredInputs?.get?.(param.name) || [];
                                                    const isFileType = /^(File|Directory)(\[\])?$/.test(param.type);
                                                    return (
                                                        <div
                                                            key={param.name}
                                                            id={`${instanceId}-param-${sectionGroup}-${param.name}`}
                                                            className={`param-card ${isFileType && wiredSources.length > 0 ? 'input-wired' : ''} ${expressionValues[param.name] ? 'has-expression' : ''} ${scatterToggles[param.name] ? 'has-scatter' : ''}`}
                                                        >
                                                            <div className="param-card-header">
                                                                <div className="param-card-label">
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
                                                                </div>
                                                                <ParamControl
                                                                    param={param}
                                                                    paramValues={paramValues}
                                                                    updateParam={updateParam}
                                                                    clampToBounds={clampToBounds}
                                                                    expressionToggles={expressionToggles}
                                                                    handleToggleFx={handleToggleFx}
                                                                    scatterButton={buildScatterButton(param)}
                                                                    nodeId={nodeId}
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
                                                                                    : () =>
                                                                                          toggleFileInOrder(param.name)
                                                                            }
                                                                            title={
                                                                                !orderPanelVisible &&
                                                                                !operationOrder.includes(param.name)
                                                                                    ? 'Set at least 2 operations before adding file inputs to the order'
                                                                                    : operationOrder.includes(
                                                                                            param.name,
                                                                                        )
                                                                                      ? 'Remove from operation order'
                                                                                      : 'Add to operation order'
                                                                            }
                                                                        >
                                                                            {operationOrder.includes(param.name)
                                                                                ? '−'
                                                                                : '+'}
                                                                        </span>
                                                                    )}
                                                            </div>
                                                            {isFileType && wiredSources.length === 1 && (
                                                                <div className="input-source-single">
                                                                    <span className="input-source">
                                                                        from {wiredSources[0].sourceNodeLabel} /{' '}
                                                                        {wiredSources[0].sourceOutput}
                                                                        {(upstreamScatterInputs || new Set()).has(
                                                                            param.name,
                                                                        )
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
                                                                                    {(
                                                                                        upstreamScatterInputs ||
                                                                                        new Set()
                                                                                    ).has(param.name)
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
                                                                                updateLinkMerge(
                                                                                    param.name,
                                                                                    e.target.value,
                                                                                )
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
                                                                        nested preserves grouping per source [[x1],
                                                                        [x2]]
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
                                                                    isScattered={nodeData?.isScatterInherited === true}
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

                                {!tool && (
                                    <div className="param-section" id={`${instanceId}-section-params`}>
                                        <div className="param-section-header">Parameters</div>
                                        <div className="param-description" style={{ padding: '8px 0' }}>
                                            Tool not fully defined — parameters unavailable.
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Form>
                    </div>
                </div>
            </div>

            <div className="tool-param-panel-footer">
                <Button className="btn-save" size="sm" onClick={handleSave}>
                    Save
                </Button>
            </div>
        </div>
    );
});

export default ToolParamPanel;
