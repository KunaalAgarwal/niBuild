import YAML from 'js-yaml';
import { getToolConfigSync } from './toolRegistry.js';

/**
 * CWL Importer — Phase 1: directory ingestion + validation.
 *
 * Consumes a browser FileList (from <input webkitdirectory>) and produces a
 * validated ImportManifest describing what was found. No graph construction
 * happens here; that is Phase 2 (`buildGraphFromManifest` in cwlGraphBuilder.js).
 *
 * Manifest shape:
 *   {
 *     workflowFile:     { path, name, parsed },
 *     jobFile:          { path, name, parsed } | null,
 *     toolFiles:        Map<resolvedPath, { path, name, parsed }>,
 *     additionalInputs: Array<{ path, name, size }>,
 *     metadata:         { roCrateMetadata, hasResolveBids },
 *     stepResolutions:  Map<stepId, StepResolution>,
 *     rootDir:          string,
 *     errors:           Array<Issue>,
 *     warnings:         Array<Issue>,
 *   }
 *
 * StepResolution = {
 *   resolution: 'directory' | 'library' | 'inline' | 'unknown',
 *   toolName?, toolFilePath?, inlineRun?, rawRun?,
 * }
 *
 * Issue = { severity: 'error'|'warning', code, message, path? }
 */

// ── Constants ────────────────────────────────────────────────────────────

const MAX_PARSE_BYTES = 5 * 1024 * 1024;
const PARSEABLE_EXTS = ['.cwl', '.yml', '.yaml', '.json'];
const NIBUILD_SCAFFOLDING = new Set([
    'Dockerfile',
    'Singularity.def',
    'run.sh',
    'README.md',
    'WORKFLOW.md',
    '.gitignore',
]);

// ── Path helpers ─────────────────────────────────────────────────────────

function dirname(path) {
    const idx = path.lastIndexOf('/');
    return idx === -1 ? '' : path.slice(0, idx);
}

function basename(path, ext) {
    const slash = path.lastIndexOf('/');
    const name = slash === -1 ? path : path.slice(slash + 1);
    if (ext && name.toLowerCase().endsWith(ext.toLowerCase())) {
        return name.slice(0, -ext.length);
    }
    return name;
}

function hasExt(path, exts) {
    const lower = path.toLowerCase();
    return exts.some((e) => lower.endsWith(e));
}

/**
 * POSIX-style path resolver. Returns the resolved path, or null if the
 * relative reference escapes above the file tree (PATH_ESCAPE).
 */
function resolveRelative(fromDir, rel) {
    if (rel.startsWith('/')) return null;
    const combined = fromDir ? `${fromDir}/${rel}` : rel;
    const stack = [];
    for (const part of combined.split('/')) {
        if (part === '' || part === '.') continue;
        if (part === '..') {
            if (stack.length === 0) return null;
            stack.pop();
        } else {
            stack.push(part);
        }
    }
    return stack.join('/');
}

function computeRootDir(fileList) {
    if (!fileList || fileList.length === 0) return '';
    const firstPath = relativePathOf(fileList[0]);
    const idx = firstPath.indexOf('/');
    return idx === -1 ? '' : firstPath.slice(0, idx);
}

function relativePathOf(file) {
    return file.webkitRelativePath || file.name;
}

// ── Issue constructors ───────────────────────────────────────────────────

const err = (code, message, path) => ({ severity: 'error', code, message, path });
const warn = (code, message, path) => ({ severity: 'warning', code, message, path });

// ── Phase 1.3: read + parse + classify ──────────────────────────────────

async function readAndParseFiles(fileList) {
    const parsedFiles = []; // { path, name, parsed, raw, size }
    const additionalInputs = [];
    const metadata = { roCrateMetadata: null, hasResolveBids: false };
    const errors = [];
    const warnings = [];

    for (const file of fileList) {
        const path = relativePathOf(file);
        const name = basename(path);
        const size = file.size;

        if (path.includes('/additional_inputs/')) {
            additionalInputs.push({ path, name, size });
            continue;
        }

        if (name === 'resolve_bids.py') {
            metadata.hasResolveBids = true;
            continue;
        }

        if (NIBUILD_SCAFFOLDING.has(name)) continue;

        if (!hasExt(path, PARSEABLE_EXTS)) {
            warnings.push(warn('UNRECOGNIZED_FILE', `Skipped unrecognized file: ${name}`, path));
            continue;
        }

        if (size > MAX_PARSE_BYTES) {
            errors.push(err('FILE_TOO_LARGE', `File exceeds ${MAX_PARSE_BYTES / 1024 / 1024} MB cap: ${name}`, path));
            continue;
        }

        let text;
        try {
            text = await file.text();
        } catch (e) {
            errors.push(err('READ_FAILED', `Could not read ${name}: ${e.message}`, path));
            continue;
        }

        const isJson = path.toLowerCase().endsWith('.json');
        let parsed;
        try {
            parsed = isJson ? JSON.parse(text) : YAML.load(text);
        } catch (e) {
            errors.push(err('PARSE_FAILED', `Could not parse ${name}: ${e.message}`, path));
            continue;
        }

        if (parsed === null || parsed === undefined) {
            warnings.push(warn('EMPTY_FILE', `File parsed to nothing: ${name}`, path));
            continue;
        }

        if (isJson && name === 'ro-crate-metadata.json') {
            metadata.roCrateMetadata = parsed;
            continue;
        }

        if (isJson) {
            warnings.push(warn('UNRECOGNIZED_JSON', `Skipped JSON file: ${name}`, path));
            continue;
        }

        parsedFiles.push({ path, name, parsed, size });
    }

    return { parsedFiles, additionalInputs, metadata, errors, warnings };
}

// ── Phase 1.3 classification + 1.5 workflow selection ───────────────────

function classifyFiles(parsedFiles) {
    const workflowCandidates = [];
    const toolFiles = new Map();
    const jobCandidates = [];
    const warnings = [];

    for (const file of parsedFiles) {
        const cls = file.parsed?.class;
        if (cls === 'Workflow') {
            workflowCandidates.push(file);
        } else if (cls === 'CommandLineTool' || cls === 'ExpressionTool') {
            if (toolFiles.has(file.path)) {
                warnings.push(warn('DUPLICATE_TOOL', `Duplicate tool path: ${file.path}`, file.path));
            }
            toolFiles.set(file.path, file);
        } else if (file.name.toLowerCase().endsWith('_job.yml') || file.name.toLowerCase().endsWith('_job.yaml')) {
            jobCandidates.push(file);
        } else if (cls === undefined || cls === null) {
            // Could be a job file matched by basename later; defer to matchJobFile.
            jobCandidates.push(file);
        } else {
            warnings.push(warn('UNKNOWN_CLASS', `Unrecognized CWL class "${cls}" in ${file.name}`, file.path));
        }
    }

    return { workflowCandidates, toolFiles, jobCandidates, warnings };
}

/**
 * If multiple Workflow files exist, prefer one that is NOT referenced by
 * `run:` from another (i.e. the entry point, not a sub-workflow). Sub-workflow
 * support proper is out of scope for v1; this is just to disambiguate the
 * common case where a user includes nested workflows.
 */
function selectWorkflowFile(workflowCandidates) {
    if (workflowCandidates.length === 0) {
        return {
            workflowFile: null,
            errors: [err('NO_WORKFLOW', 'No CWL Workflow file found in the uploaded directory.')],
        };
    }
    if (workflowCandidates.length === 1) {
        return { workflowFile: workflowCandidates[0], errors: [] };
    }

    const referenced = new Set();
    for (const wf of workflowCandidates) {
        const wfDir = dirname(wf.path);
        const steps = wf.parsed?.steps;
        if (!steps || typeof steps !== 'object') continue;
        for (const step of Object.values(steps)) {
            const run = step?.run;
            if (typeof run !== 'string') continue;
            const resolved = resolveRelative(wfDir, run);
            if (resolved) referenced.add(resolved);
        }
    }

    const unreferenced = workflowCandidates.filter((wf) => !referenced.has(wf.path));
    if (unreferenced.length === 1) {
        return { workflowFile: unreferenced[0], errors: [] };
    }

    return {
        workflowFile: null,
        errors: [
            err(
                'MULTIPLE_WORKFLOWS',
                `Found ${workflowCandidates.length} Workflow files; cannot determine the entry point. Candidates: ${workflowCandidates.map((w) => w.path).join(', ')}`,
            ),
        ],
    };
}

function matchJobFile(jobCandidates, workflowFile) {
    if (!workflowFile || jobCandidates.length === 0) return null;
    const wfBase = basename(workflowFile.path, '.cwl');

    const explicit = jobCandidates.find(
        (f) =>
            f.name.toLowerCase() === `${wfBase.toLowerCase()}_job.yml` ||
            f.name.toLowerCase() === `${wfBase.toLowerCase()}_job.yaml`,
    );
    if (explicit) return explicit;

    const generic = jobCandidates.find(
        (f) => f.name.toLowerCase().endsWith('_job.yml') || f.name.toLowerCase().endsWith('_job.yaml'),
    );
    return generic || null;
}

// ── Phase 1.4: resolve step `run:` references ────────────────────────────

function resolveSteps(workflowFile, toolFiles, rootDir) {
    const stepResolutions = new Map();
    const errors = [];
    const warnings = [];

    const steps = workflowFile.parsed?.steps;
    if (!steps || typeof steps !== 'object') return { stepResolutions, errors, warnings };

    const wfDir = dirname(workflowFile.path);

    for (const [stepId, step] of Object.entries(steps)) {
        const run = step?.run;

        if (run && typeof run === 'object') {
            stepResolutions.set(stepId, { resolution: 'inline', inlineRun: run });
            warnings.push(
                warn(
                    'INLINE_TOOL',
                    `Step "${stepId}" uses an inline tool definition; will import as a placeholder.`,
                    workflowFile.path,
                ),
            );
            continue;
        }

        if (typeof run !== 'string' || !run) {
            stepResolutions.set(stepId, { resolution: 'unknown', rawRun: run });
            warnings.push(
                warn(
                    'MISSING_RUN',
                    `Step "${stepId}" has no run reference; will import as a placeholder.`,
                    workflowFile.path,
                ),
            );
            continue;
        }

        const resolvedPath = resolveRelative(wfDir, run);
        if (resolvedPath === null) {
            errors.push(
                err('PATH_ESCAPE', `Step "${stepId}" run path escapes the upload root: ${run}`, workflowFile.path),
            );
            continue;
        }
        if (rootDir && !resolvedPath.startsWith(`${rootDir}/`) && resolvedPath !== rootDir) {
            errors.push(
                err('PATH_ESCAPE', `Step "${stepId}" run path leaves the upload root: ${run}`, workflowFile.path),
            );
            continue;
        }

        if (toolFiles.has(resolvedPath)) {
            const toolFile = toolFiles.get(resolvedPath);
            stepResolutions.set(stepId, {
                resolution: 'directory',
                toolName: basename(resolvedPath, '.cwl'),
                toolFilePath: resolvedPath,
                rawRun: run,
            });
            // Warn if the tool's class is Workflow (sub-workflow); v1 placeholders only.
            if (toolFile.parsed?.class === 'Workflow') {
                warnings.push(
                    warn(
                        'SUB_WORKFLOW',
                        `Step "${stepId}" references a sub-workflow; will import as a placeholder.`,
                        workflowFile.path,
                    ),
                );
                stepResolutions.set(stepId, { resolution: 'inline', inlineRun: toolFile.parsed, rawRun: run });
            }
            continue;
        }

        const toolName = basename(run, '.cwl');
        if (getToolConfigSync(toolName)) {
            stepResolutions.set(stepId, { resolution: 'library', toolName, rawRun: run });
            continue;
        }

        stepResolutions.set(stepId, { resolution: 'unknown', rawRun: run });
        warnings.push(warn('UNKNOWN_TOOL', `Step "${stepId}" references an unknown tool: ${run}`, workflowFile.path));
    }

    return { stepResolutions, errors, warnings };
}

// ── Phase 1.5: structural validation ─────────────────────────────────────

function validateWorkflow(workflowFile, jobFile) {
    const errors = [];
    const warnings = [];
    const wf = workflowFile.parsed;

    if (!wf.cwlVersion) {
        warnings.push(warn('NO_CWL_VERSION', `Workflow has no cwlVersion field; assuming v1.2.`, workflowFile.path));
    }

    const steps = wf.steps;
    if (!steps || typeof steps !== 'object' || Object.keys(steps).length === 0) {
        errors.push(err('NO_STEPS', 'Workflow has no steps.', workflowFile.path));
        return { errors, warnings };
    }

    // Validate outputSource references point at known step outputs.
    const stepIds = new Set(Object.keys(steps));
    const outputs = wf.outputs;
    if (outputs && typeof outputs === 'object') {
        for (const [outName, outDef] of Object.entries(outputs)) {
            const sources = outDef?.outputSource;
            const list = Array.isArray(sources) ? sources : sources ? [sources] : [];
            for (const src of list) {
                if (typeof src !== 'string') continue;
                const slash = src.indexOf('/');
                if (slash === -1) continue;
                const stepId = src.slice(0, slash);
                if (!stepIds.has(stepId)) {
                    warnings.push(
                        warn(
                            'DANGLING_OUTPUT_SOURCE',
                            `Workflow output "${outName}" references unknown step "${stepId}".`,
                            workflowFile.path,
                        ),
                    );
                }
            }
        }
    }

    // Validate job file alignment if present.
    if (jobFile && jobFile.parsed && typeof jobFile.parsed === 'object') {
        const wfInputKeys = new Set(Object.keys(wf.inputs || {}));
        for (const key of Object.keys(jobFile.parsed)) {
            if (!wfInputKeys.has(key)) {
                warnings.push(
                    warn('JOB_KEY_UNMATCHED', `Job file key "${key}" does not match any workflow input.`, jobFile.path),
                );
            }
        }
    }

    return { errors, warnings };
}

// ── Public entry point ───────────────────────────────────────────────────

export async function readImportDirectory(fileList) {
    const manifest = {
        workflowFile: null,
        jobFile: null,
        toolFiles: new Map(),
        additionalInputs: [],
        metadata: { roCrateMetadata: null, hasResolveBids: false },
        stepResolutions: new Map(),
        rootDir: '',
        errors: [],
        warnings: [],
    };

    if (!fileList || fileList.length === 0) {
        manifest.errors.push(err('EMPTY_UPLOAD', 'No files were selected.'));
        return manifest;
    }

    manifest.rootDir = computeRootDir(fileList);

    const readResult = await readAndParseFiles(fileList);
    manifest.additionalInputs = readResult.additionalInputs;
    manifest.metadata = readResult.metadata;
    manifest.errors.push(...readResult.errors);
    manifest.warnings.push(...readResult.warnings);

    const classified = classifyFiles(readResult.parsedFiles);
    manifest.toolFiles = classified.toolFiles;
    manifest.warnings.push(...classified.warnings);

    const { workflowFile, errors: selectionErrors } = selectWorkflowFile(classified.workflowCandidates);
    manifest.errors.push(...selectionErrors);
    if (!workflowFile) return manifest;
    manifest.workflowFile = workflowFile;

    manifest.jobFile = matchJobFile(classified.jobCandidates, workflowFile);

    const stepResult = resolveSteps(workflowFile, manifest.toolFiles, manifest.rootDir);
    manifest.stepResolutions = stepResult.stepResolutions;
    manifest.errors.push(...stepResult.errors);
    manifest.warnings.push(...stepResult.warnings);

    const validation = validateWorkflow(workflowFile, manifest.jobFile);
    manifest.errors.push(...validation.errors);
    manifest.warnings.push(...validation.warnings);

    return manifest;
}
