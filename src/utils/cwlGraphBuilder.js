import { MarkerType } from 'reactflow';
import { getToolConfigSync } from './toolRegistry.js';
import { layoutGraph } from './layoutGraph.js';

/**
 * CWL Importer — Phase 2: ImportManifest → ReactFlow graph.
 *
 * Consumes the validated ImportManifest produced by `cwlImporter.js` (Phase 1)
 * and builds a niBuild canvas graph (`{ nodes, edges }`) that `handleImportCWL`
 * loads into a new workspace.
 *
 * Each CWL workflow step becomes a node:
 *   - a step resolving to a built-in tool (`getToolConfigSync`) becomes a real,
 *     fully-configured tool node — that takes nothing more than `data.label`;
 *   - every other step becomes a dummy "placeholder" node that preserves the
 *     graph shape but must be swapped for a real tool before re-export.
 * Workflow-level File/Directory inputs become Input nodes; all workflow outputs
 * are aggregated into a single Output node. Scatter, parameter values,
 * expressions, and job-file data are intentionally not imported.
 *
 * Connection detail lives entirely in `edge.data.mappings` (`{ sourceOutput,
 * targetInput }`) — niBuild nodes have a single unnamed IN/OUT handle. A dummy
 * node exposes exactly one port named 'data', so any edge endpoint that is a
 * dummy node uses 'data' as its port name.
 */

const EDGE_ARROW = { type: MarkerType.ArrowClosed, width: 10, height: 10 };

// ── CWL shape helpers ────────────────────────────────────────────────────

/**
 * Reduce a CWL type to its base class/scalar name, unwrapping the nullable
 * union (`['null', X]`), the array form (`{ type: 'array', items: X }`), and
 * the `?` / `[]` string shorthands.
 */
function baseTypeOf(cwlType) {
    if (cwlType == null) return null;
    if (typeof cwlType === 'string') {
        return cwlType.replace(/\?$/, '').replace(/\[\]$/, '');
    }
    if (Array.isArray(cwlType)) {
        const nonNull = cwlType.find((t) => t !== 'null');
        return nonNull == null ? null : baseTypeOf(nonNull);
    }
    if (typeof cwlType === 'object') {
        return baseTypeOf(cwlType.type === 'array' ? cwlType.items : cwlType.type);
    }
    return null;
}

/**
 * Normalize a CWL inputs/outputs/`in` collection — which may be a mapping
 * (`{ name: def }`) or an array (`[{ id, ... }]`) — into `[[name, def], ...]`.
 */
function normalizeEntries(coll) {
    if (!coll) return [];
    if (Array.isArray(coll)) {
        return coll.filter((e) => e && typeof (e.id ?? e.name) === 'string').map((e) => [e.id ?? e.name, e]);
    }
    if (typeof coll === 'object') return Object.entries(coll);
    return [];
}

/** The declared CWL type of an input/output def (a bare string or `{ type }`). */
function defType(def) {
    return typeof def === 'string' ? def : def?.type;
}

/**
 * Flatten a CWL source reference (a `step.in` value or an `outputSource`) to a
 * list of source strings. Accepts a string, an array, or an object with a
 * `source` field; literal defaults / valueFrom-only entries yield `[]`.
 */
function normalizeSources(raw) {
    if (typeof raw === 'string') return [raw];
    if (Array.isArray(raw)) return raw.filter((s) => typeof s === 'string');
    if (raw && typeof raw === 'object') {
        if (typeof raw.source === 'string') return [raw.source];
        if (Array.isArray(raw.source)) return raw.source.filter((s) => typeof s === 'string');
    }
    return [];
}

/**
 * A CWL source string is either `"stepId/outputName"` or a bare workflow-input
 * name. CWL identifiers contain no `/`, so the first slash splits the two.
 */
function parseSource(str) {
    const slash = str.indexOf('/');
    if (slash === -1) return { kind: 'wfinput', name: str };
    return { kind: 'step', stepId: str.slice(0, slash), outputName: str.slice(slash + 1) };
}

// ── Node factory ─────────────────────────────────────────────────────────

/**
 * Build a canvas node. `data` mirrors the default block from
 * `useCanvasDrop.createNodeAt` so the node behaves like a dragged one.
 * Callbacks are deliberately omitted — `workflowCanvas` reattaches them on
 * load by inspecting the `isDummy` / `isOutputNode` flags.
 */
function makeNode(label, isDummy, extra = {}) {
    return {
        id: crypto.randomUUID(),
        type: 'default',
        position: { x: 0, y: 0 },
        data: {
            label,
            isDummy,
            parameters: '',
            dockerVersion: 'latest',
            linkMergeOverrides: {},
            whenExpression: '',
            expressions: {},
            notes: '',
            ...extra,
        },
    };
}

// ── Public entry point ───────────────────────────────────────────────────

/**
 * Convert a Phase-1 ImportManifest into a niBuild canvas graph.
 *
 * @param {object} manifest - the ImportManifest from `readImportDirectory`.
 * @returns {{
 *   nodes: Array, edges: Array, warnings: string[],
 *   stats: { toolCount: number, placeholderCount: number },
 * }}
 * @throws if the manifest carries no parsed workflow.
 */
export function buildGraphFromManifest(manifest) {
    const wf = manifest?.workflowFile?.parsed;
    if (!wf || typeof wf !== 'object') {
        throw new Error('Import manifest has no parsed workflow.');
    }

    const nodes = [];
    const warnings = [];
    const stats = { toolCount: 0, placeholderCount: 0 };

    const nodeById = new Map(); // node id → node (for isDummy lookups)
    const stepNodeId = new Map(); // CWL stepId → node id
    const wfInputNodeId = new Map(); // workflow input name → node id (File/Directory only)
    const edgeGroups = new Map(); // "srcId->tgtId" → { source, target, mappings }

    const addNode = (node) => {
        nodes.push(node);
        nodeById.set(node.id, node);
        return node.id;
    };
    const isDummy = (id) => !!nodeById.get(id)?.data?.isDummy;
    const addMapping = (source, target, sourceOutput, targetInput) => {
        const key = `${source}->${target}`;
        let group = edgeGroups.get(key);
        if (!group) {
            group = { source, target, mappings: [] };
            edgeGroups.set(key, group);
        }
        const exists = group.mappings.some((m) => m.sourceOutput === sourceOutput && m.targetInput === targetInput);
        if (!exists) group.mappings.push({ sourceOutput, targetInput });
    };

    /* 1. Input nodes — only for File/Directory-typed workflow inputs. Scalar
       inputs need no node; they surface as unconfigured tool parameters. */
    for (const [name, def] of normalizeEntries(wf.inputs)) {
        const base = baseTypeOf(defType(def));
        if (base === 'File' || base === 'Directory') {
            wfInputNodeId.set(name, addNode(makeNode(name, true)));
        }
    }

    /* 2. Step nodes — one per CWL step. */
    const stepEntries = normalizeEntries(wf.steps);
    for (const [stepId] of stepEntries) {
        const res = manifest.stepResolutions?.get(stepId) || { resolution: 'unknown' };
        const matchesLibrary =
            res.resolution === 'library' ||
            (res.resolution === 'directory' && !!res.toolName && !!getToolConfigSync(res.toolName));

        if (matchesLibrary) {
            stepNodeId.set(stepId, addNode(makeNode(res.toolName, false)));
            stats.toolCount++;
        } else {
            let label;
            if (res.resolution === 'directory') label = `${res.toolName || stepId} (placeholder)`;
            else if (res.resolution === 'inline') label = `${stepId} (inline tool)`;
            else label = `${stepId} (unresolved)`;
            const runDesc = res.resolution === 'inline' ? 'inline tool definition' : res.rawRun || 'unknown';
            const notes =
                `Imported CWL step "${stepId}" (run: ${runDesc}). Not a recognized niBuild ` +
                `tool — replace this placeholder with a real tool before exporting.`;
            stepNodeId.set(stepId, addNode(makeNode(label, true, { notes })));
            stats.placeholderCount++;
        }
    }

    /* 3. Step edges — reconstruct connections from each step's `in`. */
    for (const [stepId, step] of stepEntries) {
        const targetId = stepNodeId.get(stepId);
        if (!targetId) continue;
        const targetIsDummy = isDummy(targetId);
        for (const [inputName, rawSource] of normalizeEntries(step?.in)) {
            for (const srcStr of normalizeSources(rawSource)) {
                const parsed = parseSource(srcStr);
                if (parsed.kind === 'step') {
                    const sourceId = stepNodeId.get(parsed.stepId);
                    if (!sourceId) {
                        warnings.push(
                            `Step "${stepId}" input "${inputName}" references unknown step "${parsed.stepId}".`,
                        );
                        continue;
                    }
                    addMapping(
                        sourceId,
                        targetId,
                        isDummy(sourceId) ? 'data' : parsed.outputName,
                        targetIsDummy ? 'data' : inputName,
                    );
                } else {
                    const sourceId = wfInputNodeId.get(parsed.name);
                    // No node ⇒ scalar workflow input: leave the tool input unwired.
                    if (sourceId) {
                        addMapping(sourceId, targetId, 'data', targetIsDummy ? 'data' : inputName);
                    }
                }
            }
        }
    }

    /* 4. Output node — aggregate every workflow output into one Output node. */
    const outputEntries = normalizeEntries(wf.outputs);
    if (outputEntries.length > 0) {
        const outputId = addNode(makeNode('Output', true, { isOutputNode: true, selectedOutputs: null }));
        for (const [outName, outDef] of outputEntries) {
            const outputSource = outDef && typeof outDef === 'object' ? outDef.outputSource : undefined;
            for (const srcStr of normalizeSources(outputSource)) {
                const parsed = parseSource(srcStr);
                if (parsed.kind !== 'step') continue;
                const sourceId = stepNodeId.get(parsed.stepId);
                if (!sourceId) {
                    warnings.push(`Workflow output "${outName}" references unknown step "${parsed.stepId}".`);
                    continue;
                }
                addMapping(sourceId, outputId, isDummy(sourceId) ? 'data' : parsed.outputName, 'data');
            }
        }
    }

    /* 5. Materialize one edge per (source, target) pair. */
    const edges = [];
    for (const group of edgeGroups.values()) {
        edges.push({
            id: crypto.randomUUID(),
            source: group.source,
            target: group.target,
            animated: true,
            markerEnd: EDGE_ARROW,
            style: { strokeWidth: 2 },
            data: { mappings: group.mappings },
        });
    }

    /* 6. Lay the graph out left-to-right (a no-op for ≤1 node or on cycles). */
    return { nodes: layoutGraph(nodes, edges), edges, warnings, stats };
}
