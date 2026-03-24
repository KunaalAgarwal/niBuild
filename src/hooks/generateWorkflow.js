import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import YAML from 'js-yaml';
import { buildCWLWorkflowObject, buildJobTemplate, expandCustomWorkflowNodes } from './buildWorkflow.js';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { FIXED_POSITION_PARAMS } from '../utils/toolAnnotations.js';
import { buildROCrateMetadata } from '../utils/buildROCrateMetadata.js';
import { useToast } from '../context/ToastContext.jsx';
import {
    generateDockerfile,
    generateRunSh,
    generatePrefetchSh,
    generateSingularityDef,
    generateRunSingularitySh,
    generatePrefetchSingularitySh,
    generateReadme,
} from '../utils/workflowTemplates.js';

/* ====================================================================
 *  Operation order helpers (fslmaths etc.)
 * ==================================================================== */

/**
 * Rewrite inputBinding.position values in a parsed CWL document
 * according to the user's desired operation order.
 */
function rewriteInputPositions(cwlDoc, operationOrder) {
    if (!cwlDoc.inputs || !operationOrder.length) return;

    let pos = 2; // Start after input (position 1)
    for (const paramName of operationOrder) {
        if (FIXED_POSITION_PARAMS.has(paramName)) continue;
        const input = cwlDoc.inputs[paramName];
        if (!input?.inputBinding) continue;
        input.inputBinding.position = pos;
        // Keep kernel_size adjacent to kernel_type
        if (paramName === 'kernel_type' && cwlDoc.inputs.kernel_size?.inputBinding) {
            cwlDoc.inputs.kernel_size.inputBinding.position = pos + 1;
            pos += 2;
        } else {
            pos++;
        }
    }
    // Assign remaining non-fixed, non-ordered params after the ordered ones
    for (const [name, input] of Object.entries(cwlDoc.inputs)) {
        if (FIXED_POSITION_PARAMS.has(name)) continue;
        if (operationOrder.includes(name)) continue;
        if (!input?.inputBinding) continue;
        input.inputBinding.position = pos++;
    }
}

/* ====================================================================
 *  Docker export helpers
 * ==================================================================== */

/**
 * Determine if a CWL type definition represents a File or Directory type.
 * Returns { type, isArray, nullable } or null for scalar types.
 */
const resolveFileType = (cwlType) => {
    if (cwlType === 'File') return { type: 'File', isArray: false, nullable: false };
    if (cwlType === 'Directory') return { type: 'Directory', isArray: false, nullable: false };

    // Nullable: ['null', 'File'] or ['null', { type: 'array', items: 'File' }]
    if (Array.isArray(cwlType)) {
        const nonNull = cwlType.find((t) => t !== 'null');
        if (!nonNull) return null;
        const inner = resolveFileType(nonNull);
        return inner ? { ...inner, nullable: true } : null;
    }

    // Array: { type: 'array', items: 'File' }
    if (typeof cwlType === 'object' && cwlType?.type === 'array') {
        const inner = resolveFileType(cwlType.items);
        return inner ? { ...inner, isArray: true } : null;
    }

    return null;
};

/**
 * Extract workflow inputs that are File/Directory types requiring runtime values.
 * These are inputs NOT covered by jobDefaults (which contain scalar parameters).
 */
const extractRuntimeFileInputs = (wf, jobDefaults) => {
    const runtimeInputs = [];
    for (const [name, def] of Object.entries(wf.inputs)) {
        if (jobDefaults[name] !== undefined) continue;
        const info = resolveFileType(def.type);
        if (info) runtimeInputs.push({ name, ...info });
    }
    return runtimeInputs;
};

/**
 * Collect unique Docker image:tag strings from the dockerVersionMap.
 */
const collectUniqueDockerImages = (dockerVersionMap) => {
    const seen = new Set();
    const images = [];
    for (const { dockerImage, dockerVersion } of Object.values(dockerVersionMap)) {
        const tag = `${dockerImage}:${dockerVersion}`;
        if (!seen.has(tag)) {
            seen.add(tag);
            images.push(tag);
        }
    }
    return images.sort();
};

export function useGenerateWorkflow() {
    const { showError, showWarning } = useToast();
    /**
     * Sanitize workflow name for safe use as a filename.
     * Security: Prevents path traversal, code injection, and special characters.
     * - Only allows alphanumeric, underscore, and hyphen
     * - Removes path separators (/, \, ..)
     * - Limits length to prevent filesystem issues
     * - Falls back to 'main' for empty/invalid input
     */
    const sanitizeFilename = (name) => {
        if (!name || typeof name !== 'string') return 'main';

        const sanitized = name
            .trim()
            .toLowerCase()
            // Remove any path traversal attempts
            .replace(/\.\./g, '')
            .replace(/[/\\]/g, '')
            // Only allow alphanumeric, underscore, hyphen
            .replace(/[^a-z0-9_-]/g, '_')
            // Collapse multiple underscores
            .replace(/_+/g, '_')
            // Remove leading/trailing underscores
            .replace(/^_|_$/g, '')
            // Limit length to 50 characters
            .slice(0, 50);

        return sanitized || 'main';
    };

    /**
     * Builds main.cwl, pulls tool CWL files, zips, and downloads.
     * Works both in `npm run dev` (BASE_URL = "/") and on GitHub Pages
     * (BASE_URL = "/niBuild/").
     */
    const generateWorkflow = async (getWorkflowData, workflowName = '') => {
        if (typeof getWorkflowData !== 'function') {
            console.error('generateWorkflow expects a function');
            return;
        }

        const graph = getWorkflowData();
        if (!graph || !graph.nodes || graph.nodes.length === 0) {
            showWarning('Empty workflow — nothing to export.');
            return;
        }

        const safeWorkflowName = sanitizeFilename(workflowName);

        /* ---------- build CWL workflow + job template ---------- */
        let mainCWL;
        let jobYml;
        let runtimeInputs;
        let positionOverrides = [];
        try {
            const result = buildCWLWorkflowObject(graph);
            const { wf, jobDefaults, cwlDefaultKeys } = result;
            positionOverrides = result.positionOverrides || [];
            mainCWL = YAML.dump(wf, { noRefs: true });
            jobYml = buildJobTemplate(wf, jobDefaults, cwlDefaultKeys);
            runtimeInputs = extractRuntimeFileInputs(wf, jobDefaults);
        } catch (err) {
            showError(`Workflow build failed: ${err.message}`);
            return;
        }

        // Add shebang to make it executable
        const shebang = '#!/usr/bin/env cwl-runner\n\n';
        mainCWL = shebang + mainCWL;

        /* ---------- prepare ZIP ---------- */
        const zip = new JSZip();
        zip.file(`workflows/${safeWorkflowName}.cwl`, mainCWL);
        zip.file(`workflows/${safeWorkflowName}_job.yml`, jobYml);

        // baseURL ends in "/", ensure single slash join
        const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');

        /* ---------- build Docker version map for each tool path ---------- */
        // Expand custom workflow nodes so their internal tools are visible
        const expandedGraph = expandCustomWorkflowNodes(graph);
        // Filter dummy nodes — they have no tool definitions
        const realNodes = expandedGraph.nodes.filter((n) => !n.data?.isDummy);
        // Maps cwlPath -> { dockerImage, dockerVersion }
        const dockerVersionMap = {};
        const versionConflicts = [];
        realNodes.forEach((node) => {
            const tool = getToolConfigSync(node.data.label);
            if (tool?.cwlPath && tool?.dockerImage) {
                const version = node.data.dockerVersion || 'latest';
                const existing = dockerVersionMap[tool.cwlPath];
                if (existing) {
                    // Detect conflicting non-latest versions
                    if (
                        existing.dockerVersion !== version &&
                        existing.dockerVersion !== 'latest' &&
                        version !== 'latest'
                    ) {
                        versionConflicts.push(`${node.data.label}: "${existing.dockerVersion}" vs "${version}"`);
                    }
                    // Prefer non-latest over latest
                    if (existing.dockerVersion === 'latest' && version !== 'latest') {
                        dockerVersionMap[tool.cwlPath] = { dockerImage: tool.dockerImage, dockerVersion: version };
                    }
                } else {
                    dockerVersionMap[tool.cwlPath] = { dockerImage: tool.dockerImage, dockerVersion: version };
                }
            }
        });
        if (versionConflicts.length > 0) {
            showWarning(`Docker version conflict (first version used): ${versionConflicts.join('; ')}`);
        }

        /* ---------- collect unique Docker images ---------- */
        const dockerImages = collectUniqueDockerImages(dockerVersionMap);

        /* ---------- fetch each unique tool file and inject Docker version ---------- */
        const uniquePaths = [
            ...new Set(realNodes.map((n) => getToolConfigSync(n.data.label)?.cwlPath).filter(Boolean)),
        ];

        const results = await Promise.allSettled(
            uniquePaths.map(async (p) => {
                const res = await fetch(`${base}${p}`);
                if (!res.ok) throw new Error(`${p}: ${res.status} ${res.statusText}`);
                return { path: p, text: await res.text() };
            }),
        );

        const failedPaths = results.map((r, i) => (r.status === 'rejected' ? uniquePaths[i] : null)).filter(Boolean);
        if (uniquePaths.length > 0 && failedPaths.length === uniquePaths.length) {
            showError(`Unable to fetch any tool files. Check network connectivity.`);
            return;
        }
        if (failedPaths.length > 0) {
            showWarning(`Could not fetch ${failedPaths.length} tool file(s): ${failedPaths.join(', ')}`);
        }

        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            const { path: p, text } = result.value;
            let cwlContent = text;

            // Inject Docker version if we have one for this tool
            const dockerInfo = dockerVersionMap[p];
            if (dockerInfo) {
                try {
                    const cwlDoc = YAML.load(cwlContent);
                    if (!cwlDoc.hints) cwlDoc.hints = {};
                    cwlDoc.hints.DockerRequirement = {
                        dockerPull: `${dockerInfo.dockerImage}:${dockerInfo.dockerVersion}`,
                    };
                    const hasShebang = cwlContent.startsWith('#!/');
                    const shebangLine = hasShebang ? cwlContent.split('\n')[0] + '\n\n' : '';
                    cwlContent = shebangLine + YAML.dump(cwlDoc, { noRefs: true, lineWidth: -1 });
                } catch (parseErr) {
                    showWarning(`Could not inject Docker version into ${p}: ${parseErr.message}`);
                }
            }

            zip.file(p, cwlContent);
        }

        /* ---------- generate per-node CWL variants for order-sensitive tools ---------- */
        const fetchedCWLMap = new Map(
            results.filter((r) => r.status === 'fulfilled').map((r) => [r.value.path, r.value.text]),
        );
        for (const override of positionOverrides) {
            const baseText = fetchedCWLMap.get(override.cwlPath);
            if (!baseText) continue;
            try {
                const cwlDoc = YAML.load(baseText);
                rewriteInputPositions(cwlDoc, override.operationOrder);
                // Also inject Docker version
                const dockerInfo = dockerVersionMap[override.cwlPath];
                if (dockerInfo) {
                    if (!cwlDoc.hints) cwlDoc.hints = {};
                    cwlDoc.hints.DockerRequirement = {
                        dockerPull: `${dockerInfo.dockerImage}:${dockerInfo.dockerVersion}`,
                    };
                }
                const hasShebang = baseText.startsWith('#!/');
                const shebangLine = hasShebang ? baseText.split('\n')[0] + '\n\n' : '';
                zip.file(override.customCwlPath, shebangLine + YAML.dump(cwlDoc, { noRefs: true, lineWidth: -1 }));
            } catch (parseErr) {
                showWarning(`Could not generate CWL variant for ${override.customCwlPath}: ${parseErr.message}`);
            }
        }

        /* ---------- detect BIDS nodes ---------- */
        const bidsNodes = graph.nodes.filter((n) => n.data?.isBIDS && n.data?.bidsSelections);
        const hasBIDS = bidsNodes.length > 0;

        if (hasBIDS) {
            // Serialize BIDS query from the first BIDS node's selections
            const bidsQuery = {
                bids_version: bidsNodes[0].data.bidsSelections.bidsVersion || '1.9.0',
                dataset_name: bidsNodes[0].data.bidsSelections.datasetName || '',
                selections: bidsNodes[0].data.bidsSelections.selections,
            };
            zip.file('bids_query.json', JSON.stringify(bidsQuery, null, 2));

            // Fetch and include resolve_bids.py from public/scripts/
            try {
                const resolverRes = await fetch(`${base}scripts/resolve_bids.py`);
                if (resolverRes.ok) {
                    zip.file('resolve_bids.py', await resolverRes.text());
                } else {
                    showWarning('Could not fetch resolve_bids.py — BIDS resolver not included in bundle.');
                }
            } catch (err) {
                showWarning(`Could not fetch resolve_bids.py: ${err.message}`);
            }
        }

        /* ---------- generate Docker support files ---------- */
        zip.file('Dockerfile', generateDockerfile(safeWorkflowName, hasBIDS));
        zip.file('run.sh', generateRunSh(safeWorkflowName, runtimeInputs, hasBIDS));
        zip.file('prefetch_images.sh', generatePrefetchSh(dockerImages));

        /* ---------- generate Singularity/Apptainer support files ---------- */
        zip.file('Singularity.def', generateSingularityDef(safeWorkflowName));
        zip.file('run_singularity.sh', generateRunSingularitySh(safeWorkflowName, runtimeInputs));
        zip.file('prefetch_images_singularity.sh', generatePrefetchSingularitySh(dockerImages));

        /* ---------- generate README ---------- */
        zip.file('README.md', generateReadme(safeWorkflowName, runtimeInputs, dockerImages, hasBIDS));

        /* ---------- generate RO-Crate metadata (Workflow RO-Crate 1.0) ---------- */
        const toolMeta = {};
        for (const p of uniquePaths) {
            const node = realNodes.find((n) => getToolConfigSync(n.data.label)?.cwlPath === p);
            if (node) {
                const tool = getToolConfigSync(node.data.label);
                toolMeta[p] = {
                    fullName: tool?.fullName || node.data.label,
                    docUrl: tool?.docUrl || null,
                };
            }
        }
        zip.file(
            'ro-crate-metadata.json',
            buildROCrateMetadata({
                workflowName: safeWorkflowName,
                mainWorkflowPath: `workflows/${safeWorkflowName}.cwl`,
                jobTemplatePath: `workflows/${safeWorkflowName}_job.yml`,
                toolCWLPaths: uniquePaths,
                toolMetadata: toolMeta,
                hasBIDS,
                dockerImages,
                singularityFiles: ['Singularity.def', 'run_singularity.sh', 'prefetch_images_singularity.sh'],
            }),
        );

        zip.folder('additional_inputs');

        /* ---------- download ---------- */
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, `${safeWorkflowName}.crate.zip`);
    };

    return { generateWorkflow };
}
