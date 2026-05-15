import { useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';
import { Button } from 'react-bootstrap';
import '../styles/bidsDataModal.css';

/** Official BIDS datatype definitions */
const DATATYPE_DEFS = {
    func: 'Task-based and resting state functional MRI',
    dwi: 'Diffusion weighted imaging',
    fmap: 'Field inhomogeneity mapping data (field maps)',
    anat: 'Structural imaging (T1, T2, PD, etc.)',
    perf: 'Perfusion imaging',
    meg: 'Magnetoencephalography',
    eeg: 'Electroencephalography',
    ieeg: 'Intracranial electroencephalography',
    beh: 'Behavioral data',
    pet: 'Positron emission tomography',
    micr: 'Microscopy',
    nirs: 'Near infrared spectroscopy',
    emg: 'Electromyography',
    motion: 'Motion capture',
};

/** Common BIDS suffix definitions */
const SUFFIX_DEFS = {
    T1w: 'T1-weighted image',
    T2w: 'T2-weighted image',
    T1map: 'T1 relaxation time map',
    T2map: 'T2 relaxation time map',
    T2starw: 'T2*-weighted image',
    T2starmap: 'T2* relaxation time map',
    FLAIR: 'Fluid-attenuated inversion recovery',
    PDw: 'Proton density weighted image',
    PDmap: 'Proton density map',
    defacemask: 'Defacing mask',
    bold: 'Blood oxygen level dependent (fMRI)',
    boldref: 'BOLD reference image',
    sbref: 'Single-band reference image',
    dwi: 'Diffusion weighted image',
    magnitude: 'Magnitude image',
    magnitude1: 'First magnitude image',
    magnitude2: 'Second magnitude image',
    phasediff: 'Phase difference map',
    fieldmap: 'Field map',
    epi: 'EPI field map',
    asl: 'Arterial spin labeling',
    m0scan: 'M0 calibration scan',
    pet: 'PET image',
    eeg: 'EEG recording',
    meg: 'MEG recording',
    ieeg: 'Intracranial EEG recording',
    SEM: 'Scanning electron microscopy',
    SPIM: 'Selective plane illumination microscopy',
    nirs: 'NIRS recording',
    MP2RAGE: 'Magnetization prepared 2 rapid gradient echoes',
    UNIT1: 'Unified T1 image',
    VFA: 'Variable flip angle',
    MTsat: 'Magnetization transfer saturation',
    MTS: 'Magnetization transfer saturation',
    TB1TFL: 'B1 map (TurboFLASH)',
    MEGRE: 'Multi-echo gradient echo',
    MESE: 'Multi-echo spin echo',
    IRT1: 'Inversion recovery T1 mapping',
};

function autoLabel(group) {
    const parts = [group.suffix || group.datatype];
    if (group.task && group.task !== 'all') parts.push(group.task);
    return parts.join('_').toLowerCase();
}

function nextGroupId() {
    return crypto.randomUUID();
}

/**
 * Convert persisted savedSelections (external form) → internal panel state.
 * Auto-discovers everything if no saved selections are provided.
 */
function buildInternalStateFromSaved(savedSelections, bidsStructure) {
    const allSubjectIds = bidsStructure?.subjects ? Object.keys(bidsStructure.subjects).sort() : [];
    if (savedSelections?.selections && Object.keys(savedSelections.selections).length > 0) {
        const firstSel = Object.values(savedSelections.selections)[0];
        let subjects;
        if (firstSel.subjects === 'all') {
            subjects = new Set(allSubjectIds);
        } else {
            const valid = (firstSel.subjects || []).filter((s) => allSubjectIds.includes(s));
            subjects = new Set(valid);
        }
        const datatypes = new Set();
        for (const sel of Object.values(savedSelections.selections)) {
            datatypes.add(sel.datatype);
        }
        const groups = [];
        for (const [label, sel] of Object.entries(savedSelections.selections)) {
            groups.push({
                id: nextGroupId(),
                datatype: sel.datatype,
                suffix: sel.suffix,
                task: sel.task || 'all',
                run: sel.run || 'all',
                includeEvents: sel.include_events || false,
                extractSidecarParams: sel.extract_sidecar_params || [],
                label,
            });
        }
        return { selectedSubjects: subjects, selectedDataTypes: datatypes, outputGroups: groups, subjectSearch: '' };
    }
    // Default initialization
    if (!bidsStructure?.subjects) {
        return {
            selectedSubjects: new Set(),
            selectedDataTypes: new Set(),
            outputGroups: [],
            subjectSearch: '',
        };
    }
    const allDatatypes = new Set();
    for (const sub of Object.values(bidsStructure.subjects)) {
        for (const ses of Object.values(sub.sessions)) {
            for (const dt of Object.keys(ses)) {
                allDatatypes.add(dt);
            }
        }
    }
    const groups = [];
    for (const dt of [...allDatatypes].sort()) {
        const suffixes = new Set();
        for (const sub of Object.values(bidsStructure.subjects)) {
            for (const ses of Object.values(sub.sessions)) {
                if (!ses[dt]) continue;
                for (const f of ses[dt]) {
                    suffixes.add(f.suffix);
                }
            }
        }
        for (const suffix of [...suffixes].sort()) {
            const group = {
                id: nextGroupId(),
                datatype: dt,
                suffix,
                task: 'all',
                run: 'all',
                includeEvents: dt === 'func' && suffix === 'bold',
                extractSidecarParams: [],
                label: '',
            };
            group.label = autoLabel(group);
            groups.push(group);
        }
    }
    return {
        selectedSubjects: new Set(allSubjectIds),
        selectedDataTypes: allDatatypes,
        outputGroups: groups,
        subjectSearch: '',
    };
}

/**
 * BIDSDataPanel — reusable BIDS browser. Renders as a sidebar tab and as a full aux tab.
 * (A modal-wrapped variant existed during the redesign but has been removed; the `mode`
 * prop's 'modal' branch is now dead code, slated for a future cleanup pass.)
 *
 * `initialDraft` — if provided (e.g., transferred when expanding from sidebar to a full
 * aux tab), seeds state directly. Otherwise the panel converts `savedSelections` to
 * internal state.
 *
 * Imperative handle: `getDraftState()` returns the current internal state object,
 * for use when expanding from sidebar to a full aux tab.
 */
const BIDSDataPanel = forwardRef(function BIDSDataPanel(
    {
        bidsStructure,
        savedSelections,
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

    // Subject / datatype / output group state
    const [selectedSubjects, setSelectedSubjects] = useState(new Set());
    const [subjectSearch, setSubjectSearch] = useState('');
    const [selectedDataTypes, setSelectedDataTypes] = useState(new Set());
    const [outputGroups, setOutputGroups] = useState([]);

    // Derived: all subject IDs
    const allSubjectIds = useMemo(() => {
        if (!bidsStructure?.subjects) return [];
        return Object.keys(bidsStructure.subjects).sort();
    }, [bidsStructure]);

    const participants = useMemo(() => bidsStructure?.participants || {}, [bidsStructure]);

    // One-time initialization. We do not re-init when bidsStructure flips identity
    // unless we've never initialized. `initialized` is React state (not a ref) so
    // its flip triggers re-runs of dependent effects — specifically the dirty-watch
    // effect below, which needs to see the post-init state on its first "real" run.
    const [initialized, setInitialized] = useState(false);
    useEffect(() => {
        if (initialized) return;
        if (!bidsStructure) return;
        if (initialDraft) {
            setSelectedSubjects(new Set(initialDraft.selectedSubjects || []));
            setSelectedDataTypes(new Set(initialDraft.selectedDataTypes || []));
            setOutputGroups(initialDraft.outputGroups || []);
            setSubjectSearch(initialDraft.subjectSearch || '');
        } else {
            const s = buildInternalStateFromSaved(savedSelections, bidsStructure);
            setSelectedSubjects(s.selectedSubjects);
            setSelectedDataTypes(s.selectedDataTypes);
            setOutputGroups(s.outputGroups);
            setSubjectSearch(s.subjectSearch);
        }
        setInitialized(true);
    }, [bidsStructure, savedSelections, initialDraft, initialized]);

    // ---- Dirty tracking -------------------------------------------------------
    // Initialization is async (gated on bidsStructure availability and a one-shot
    // setInitialized(true) call). The first time this effect runs with
    // initialized === true, state already reflects the just-loaded saved selection
    // — which we want to count as the clean baseline. Subsequent state changes are
    // user edits → emit dirty=true.
    const isFirstPostInitRef = useRef(true);
    useEffect(() => {
        if (!initialized) return;
        if (isFirstPostInitRef.current) {
            isFirstPostInitRef.current = false;
            // If we hydrated from a transferred draft, that draft represents
            // unsaved edits — mark dirty.
            if (initialDraft) onDirtyChangeRef.current?.(true);
            return;
        }
        onDirtyChangeRef.current?.(true);
        // Reason: initialDraft is captured at mount; later prop identity changes are irrelevant once init has completed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialized, selectedSubjects, selectedDataTypes, outputGroups, subjectSearch]);

    // Expose draft state to the parent for Expand-to-tab.
    useImperativeHandle(
        ref,
        () => ({
            getDraftState: () => ({
                selectedSubjects: [...selectedSubjects],
                selectedDataTypes: [...selectedDataTypes],
                outputGroups,
                subjectSearch,
            }),
        }),
        [selectedSubjects, selectedDataTypes, outputGroups, subjectSearch],
    );

    // Derived: data type availability across selected subjects
    const datatypeAvailability = useMemo(() => {
        if (!bidsStructure?.subjects) return new Map();
        const counts = new Map();
        for (const subId of selectedSubjects) {
            const sub = bidsStructure.subjects[subId];
            if (!sub) continue;
            const seen = new Set();
            for (const ses of Object.values(sub.sessions)) {
                for (const dt of Object.keys(ses)) seen.add(dt);
            }
            for (const dt of seen) {
                counts.set(dt, (counts.get(dt) || 0) + 1);
            }
        }
        return counts;
    }, [bidsStructure, selectedSubjects]);

    const allDatatypes = useMemo(() => {
        if (!bidsStructure?.subjects) return [];
        const dts = new Set();
        for (const sub of Object.values(bidsStructure.subjects)) {
            for (const ses of Object.values(sub.sessions)) {
                for (const dt of Object.keys(ses)) dts.add(dt);
            }
        }
        return [...dts].sort();
    }, [bidsStructure]);

    const availableFilters = useMemo(() => {
        if (!bidsStructure?.subjects) return {};
        const result = {};
        for (const dt of selectedDataTypes) {
            const suffixes = new Set();
            const tasks = new Set();
            const runs = new Set();
            for (const subId of selectedSubjects) {
                const sub = bidsStructure.subjects[subId];
                if (!sub) continue;
                for (const ses of Object.values(sub.sessions)) {
                    if (!ses[dt]) continue;
                    for (const f of ses[dt]) {
                        suffixes.add(f.suffix);
                        if (f.entities.task) tasks.add(f.entities.task);
                        if (f.entities.run) runs.add(f.entities.run);
                    }
                }
            }
            result[dt] = {
                suffixes: [...suffixes].sort(),
                tasks: [...tasks].sort(),
                runs: [...runs].sort(),
            };
        }
        return result;
    }, [bidsStructure, selectedSubjects, selectedDataTypes]);

    const resolvedPaths = useMemo(() => {
        if (!bidsStructure?.subjects) return [];
        const paths = [];
        for (const group of outputGroups) {
            for (const subId of selectedSubjects) {
                const sub = bidsStructure.subjects[subId];
                if (!sub) continue;
                for (const ses of Object.values(sub.sessions)) {
                    if (!ses[group.datatype]) continue;
                    for (const f of ses[group.datatype]) {
                        if (f.suffix !== group.suffix) continue;
                        if (group.task && group.task !== 'all' && f.entities.task !== group.task) continue;
                        if (group.run && group.run !== 'all' && f.entities.run !== group.run) continue;
                        paths.push({ group: group.label, path: f.relativePath });
                    }
                }
            }
        }
        return paths;
    }, [bidsStructure, selectedSubjects, outputGroups]);

    const groupFileCounts = useMemo(() => {
        const counts = {};
        for (const p of resolvedPaths) {
            counts[p.group] = (counts[p.group] || 0) + 1;
        }
        return counts;
    }, [resolvedPaths]);

    const toggleSubject = useCallback((subId) => {
        setSelectedSubjects((prev) => {
            const next = new Set(prev);
            if (next.has(subId)) next.delete(subId);
            else next.add(subId);
            return next;
        });
    }, []);

    const toggleDataType = useCallback((dt) => {
        setSelectedDataTypes((prev) => {
            const next = new Set(prev);
            if (next.has(dt)) {
                next.delete(dt);
                setOutputGroups((groups) => groups.filter((g) => g.datatype !== dt));
            } else {
                next.add(dt);
            }
            return next;
        });
    }, []);

    const updateGroup = useCallback((groupId, updates) => {
        setOutputGroups((prev) =>
            prev.map((g) => {
                if (g.id !== groupId) return g;
                const updated = { ...g, ...updates };
                if (!updates.label && updates.suffix !== undefined) {
                    updated.label = autoLabel(updated);
                }
                return updated;
            }),
        );
    }, []);

    const removeGroup = useCallback((groupId) => {
        setOutputGroups((prev) => prev.filter((g) => g.id !== groupId));
    }, []);

    const addGroup = useCallback(() => {
        const dt = [...selectedDataTypes][0] || 'anat';
        const filters = availableFilters[dt] || {};
        const suffix = (filters.suffixes || [])[0] || 'T1w';
        const group = {
            id: nextGroupId(),
            datatype: dt,
            suffix,
            task: 'all',
            run: 'all',
            includeEvents: false,
            extractSidecarParams: [],
            label: '',
        };
        group.label = autoLabel(group);
        setOutputGroups((prev) => [...prev, group]);
    }, [selectedDataTypes, availableFilters]);

    const handleSave = useCallback(() => {
        if (outputGroups.length === 0) {
            onSave(null);
            onDirtyChangeRef.current?.(false);
            return;
        }
        const allSelected = selectedSubjects.size === allSubjectIds.length;
        const selections = {};
        for (const group of outputGroups) {
            const sel = {
                datatype: group.datatype,
                suffix: group.suffix,
                subjects: allSelected ? 'all' : [...selectedSubjects].sort(),
                sessions: 'all',
            };
            if (group.task && group.task !== 'all') sel.task = group.task;
            if (group.run && group.run !== 'all') sel.run = group.run;
            if (group.includeEvents) sel.include_events = true;
            if (group.extractSidecarParams.length > 0) {
                sel.extract_sidecar_params = group.extractSidecarParams;
            }
            selections[group.label] = sel;
        }
        onSave({
            selections,
            datasetName: bidsStructure?.datasetName || '',
            bidsVersion: bidsStructure?.bidsVersion || '',
        });
        onDirtyChangeRef.current?.(false);
    }, [outputGroups, selectedSubjects, allSubjectIds, bidsStructure, onSave]);

    const filteredSubjects = useMemo(() => {
        if (!subjectSearch.trim()) return allSubjectIds;
        const q = subjectSearch.toLowerCase();
        return allSubjectIds.filter((id) => {
            if (id.toLowerCase().includes(q)) return true;
            const demo = participants[id];
            if (demo) {
                return Object.values(demo).some((v) => String(v).toLowerCase().includes(q));
            }
            return false;
        });
    }, [allSubjectIds, subjectSearch, participants]);

    if (!bidsStructure) return null;

    const wrapperClass = `bids-data-panel${mode === 'tab' ? ' bids-data-panel--tab' : ''}`;

    return (
        <div className={wrapperClass}>
            {/* In tab mode there's no Modal.Header — render an internal header
                so the user still sees the dataset name + BIDS version. */}
            {mode === 'tab' && (
                <div className="bids-data-panel-header">
                    <div className="bids-data-panel-header-text">
                        <div className="bids-data-panel-title">{bidsStructure?.datasetName || 'BIDS Dataset'}</div>
                        {bidsStructure?.bidsVersion && (
                            <div className="bids-data-panel-subtitle">BIDS v{bidsStructure.bidsVersion}</div>
                        )}
                    </div>
                    {onExpand && (
                        <button
                            type="button"
                            className="bids-data-panel-expand-btn"
                            onClick={onExpand}
                            title="Open in tab"
                            aria-label="Open in tab"
                        >
                            expand
                        </button>
                    )}
                </div>
            )}
            <div className="bids-data-panel-body">
                <div className="bids-panels">
                    {/* ---- Level 1: Subject Panel ---- */}
                    <div className="bids-subject-panel">
                        <div className="bids-subject-header">
                            <div className="bids-select-btns">
                                <button
                                    className="bids-select-all-btn"
                                    onClick={() => {
                                        if (subjectSearch.trim()) {
                                            setSelectedSubjects((prev) => {
                                                const next = new Set(prev);
                                                filteredSubjects.forEach((id) => next.add(id));
                                                return next;
                                            });
                                        } else {
                                            setSelectedSubjects(new Set(allSubjectIds));
                                        }
                                    }}
                                >
                                    {subjectSearch.trim() ? 'Select filtered' : 'Select all'}
                                </button>
                                <button
                                    className="bids-select-all-btn"
                                    onClick={() => {
                                        if (subjectSearch.trim()) {
                                            setSelectedSubjects((prev) => {
                                                const next = new Set(prev);
                                                filteredSubjects.forEach((id) => next.delete(id));
                                                return next;
                                            });
                                        } else {
                                            setSelectedSubjects(new Set());
                                        }
                                    }}
                                >
                                    {subjectSearch.trim() ? 'Deselect filtered' : 'Deselect all'}
                                </button>
                            </div>
                            <span className="bids-subject-count">
                                {selectedSubjects.size}/{allSubjectIds.length}
                            </span>
                        </div>

                        <input
                            className="bids-search-input"
                            type="text"
                            placeholder="Search subjects..."
                            value={subjectSearch}
                            onChange={(e) => setSubjectSearch(e.target.value)}
                        />

                        <div className="bids-subject-list scrollbar-thin">
                            {filteredSubjects.map((subId) => {
                                const demo = participants[subId];
                                const demoStr = demo
                                    ? Object.entries(demo)
                                          .map(([k, v]) => `${k}: ${v}`)
                                          .join(', ')
                                    : '';
                                return (
                                    <div key={subId} className="bids-subject-row" onClick={() => toggleSubject(subId)}>
                                        <input
                                            type="checkbox"
                                            checked={selectedSubjects.has(subId)}
                                            onChange={() => {}}
                                        />
                                        <span className="bids-subject-id">{subId}</span>
                                        {demoStr && (
                                            <span className="bids-subject-demo" title={demoStr}>
                                                {demoStr}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ---- Right panel ---- */}
                    <div className="bids-right-panel">
                        <div className="bids-datatype-section">
                            <div className="bids-section-label">Data Types</div>
                            <div className="bids-datatype-grid">
                                {allDatatypes.map((dt) => {
                                    const count = datatypeAvailability.get(dt) || 0;
                                    const isSelected = selectedDataTypes.has(dt);
                                    const isAvailable = count > 0;
                                    return (
                                        <div
                                            key={dt}
                                            className={`bids-datatype-chip${isSelected ? ' selected' : ''}${!isAvailable ? ' unavailable' : ''}`}
                                            onClick={() => isAvailable && toggleDataType(dt)}
                                            title={DATATYPE_DEFS[dt] || dt}
                                        >
                                            <div className="bids-datatype-chip-top">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={!isAvailable}
                                                    onChange={() => {}}
                                                />
                                                <span>{dt}</span>
                                                <span className="bids-availability-badge">
                                                    ({count}/{selectedSubjects.size})
                                                </span>
                                            </div>
                                            {DATATYPE_DEFS[dt] && (
                                                <span className="bids-datatype-desc">{DATATYPE_DEFS[dt]}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="bids-outputs-section">
                            <div className="bids-section-label">Output Ports</div>
                            <div className="bids-outputs-subtitle">
                                Each group becomes an output on the BIDS node. Connect outputs to downstream tools.
                            </div>

                            {outputGroups.length === 0 && (
                                <div className="bids-empty-state">Select a data type to create output groups</div>
                            )}

                            {outputGroups.map((group) => {
                                const filters = availableFilters[group.datatype] || {};
                                const isFunc = group.datatype === 'func';

                                return (
                                    <div key={group.id} className="bids-output-group">
                                        <div className="bids-output-header">
                                            <input
                                                className="bids-output-label-input"
                                                value={group.label}
                                                onChange={(e) => updateGroup(group.id, { label: e.target.value })}
                                                placeholder="output label"
                                            />
                                            <span className="bids-output-type-badge">File[]</span>
                                            <span className="bids-output-count-badge">
                                                {groupFileCounts[group.label] || 0} file
                                                {(groupFileCounts[group.label] || 0) !== 1 ? 's' : ''}
                                            </span>
                                            <button
                                                className="bids-remove-group-btn"
                                                onClick={() => removeGroup(group.id)}
                                            >
                                                Remove
                                            </button>
                                        </div>

                                        <div className="bids-output-filters">
                                            <span className="bids-filter-label">Type:</span>
                                            <select
                                                className="bids-filter-select"
                                                value={group.datatype}
                                                onChange={(e) => {
                                                    const newDt = e.target.value;
                                                    const newFilters = availableFilters[newDt] || {};
                                                    const newSuffix = (newFilters.suffixes || [])[0] || '';
                                                    updateGroup(group.id, {
                                                        datatype: newDt,
                                                        suffix: newSuffix,
                                                        task: 'all',
                                                        run: 'all',
                                                    });
                                                }}
                                            >
                                                {[...selectedDataTypes].sort().map((dt) => (
                                                    <option key={dt} value={dt}>
                                                        {dt}
                                                    </option>
                                                ))}
                                            </select>

                                            <span className="bids-filter-label">Suffix:</span>
                                            <select
                                                className="bids-filter-select"
                                                value={group.suffix}
                                                onChange={(e) => updateGroup(group.id, { suffix: e.target.value })}
                                            >
                                                {(filters.suffixes || []).map((s) => (
                                                    <option key={s} value={s} title={SUFFIX_DEFS[s] || s}>
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                            {SUFFIX_DEFS[group.suffix] && (
                                                <span className="bids-suffix-desc">{SUFFIX_DEFS[group.suffix]}</span>
                                            )}
                                        </div>

                                        {(isFunc || (filters.runs || []).length > 1) && (
                                            <div className="bids-output-filters">
                                                {isFunc && (filters.tasks || []).length > 0 && (
                                                    <>
                                                        <span className="bids-filter-label">Task:</span>
                                                        <select
                                                            className="bids-filter-select"
                                                            value={group.task}
                                                            onChange={(e) =>
                                                                updateGroup(group.id, { task: e.target.value })
                                                            }
                                                        >
                                                            <option value="all">all</option>
                                                            {filters.tasks.map((t) => (
                                                                <option key={t} value={t}>
                                                                    {t}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </>
                                                )}

                                                {(filters.runs || []).length > 1 && (
                                                    <>
                                                        <span className="bids-filter-label">Run:</span>
                                                        <select
                                                            className="bids-filter-select"
                                                            value={group.run}
                                                            onChange={(e) =>
                                                                updateGroup(group.id, { run: e.target.value })
                                                            }
                                                        >
                                                            <option value="all">all</option>
                                                            {filters.runs.map((r) => (
                                                                <option key={r} value={r}>
                                                                    {r}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </>
                                                )}

                                                {isFunc && group.suffix === 'bold' && (
                                                    <label className="bids-filter-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={group.includeEvents}
                                                            onChange={(e) =>
                                                                updateGroup(group.id, {
                                                                    includeEvents: e.target.checked,
                                                                })
                                                            }
                                                        />
                                                        events.tsv
                                                    </label>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {selectedDataTypes.size > 0 && (
                                <button className="bids-add-group-btn" onClick={addGroup}>
                                    + Add output group
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="bids-path-preview">
                    <div className="bids-preview-header">Resolved paths ({resolvedPaths.length} files)</div>
                    <div className="bids-preview-list">
                        {resolvedPaths.slice(0, 50).map((p, i) => (
                            <div key={i} className="bids-preview-path">
                                <span style={{ color: 'var(--color-info)' }}>[{p.group}]</span> {p.path}
                            </div>
                        ))}
                        {resolvedPaths.length > 50 && (
                            <div className="bids-preview-more">...and {resolvedPaths.length - 50} more</div>
                        )}
                        {resolvedPaths.length === 0 && (
                            <div className="bids-preview-path" style={{ fontStyle: 'italic' }}>
                                No files match current selections
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bids-data-panel-footer">
                <Button className="btn-cancel" onClick={onCancel}>
                    Cancel
                </Button>
                <Button className="btn-save" onClick={handleSave} disabled={outputGroups.length === 0}>
                    Save ({outputGroups.length} output{outputGroups.length !== 1 ? 's' : ''})
                </Button>
            </div>
        </div>
    );
});

export default BIDSDataPanel;
