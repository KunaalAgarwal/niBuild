import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import YAML from 'js-yaml';
import { buildCWLWorkflowObject, buildJobTemplate } from './buildWorkflow.js';
import { getToolConfigSync } from '../utils/toolRegistry.js';
import { useToast } from '../context/ToastContext.jsx';

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
        const nonNull = cwlType.find(t => t !== 'null');
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
        if (!seen.has(tag)) { seen.add(tag); images.push(tag); }
    }
    return images.sort();
};

/* ---------- template generators ---------- */

const generateDockerfile = (safeWorkflowName) =>
`FROM python:3.11-slim

# Install cwltool (pinned for reproducibility)
RUN pip install --no-cache-dir cwltool==3.1.20240508115724

# Install docker CLI (needed for cwltool to invoke per-tool containers)
RUN apt-get update && \\
    apt-get install -y --no-install-recommends docker.io && \\
    rm -rf /var/lib/apt/lists/*

# Copy workflow files
WORKDIR /workflow
COPY workflows/ ./workflows/
COPY cwl/ ./cwl/
COPY workflows/${safeWorkflowName}_job.yml ./job.yml
COPY run.sh .
RUN chmod +x run.sh

ENTRYPOINT ["./run.sh"]
`;

const generateRunSh = (safeWorkflowName, runtimeInputs) => {
    const inputSection = runtimeInputs.length > 0
        ? [
            '  echo "File inputs (edit job.yml before running):"',
            ...runtimeInputs.map(({ name, type, isArray }) => {
                const typeLabel = isArray ? `${type}[]` : type;
                return `  echo "  ${name}  (${typeLabel})"`;
            }),
        ].join('\n')
        : '  echo "All inputs are pre-configured. No file arguments needed."';

    return `#!/bin/bash
set -euo pipefail

# If --help is passed, show usage
if [ "\${1:-}" = "--help" ] || [ "\${1:-}" = "-h" ]; then
  echo "=== niBuild Workflow Runner ==="
  echo ""
  echo "Usage: docker run -v /path/to/data:/data -v /path/to/output:/output <image>"
  echo ""
${inputSection}
  echo ""
  echo "All scalar parameters are pre-configured in job.yml."
  echo "Edit job.yml to set file paths before running."
  echo ""
  echo "Extra arguments are passed to cwltool (e.g. --verbose, --cachedir /cache)."
  exit 0
fi

cwltool --outdir /output "$@" \\
  workflows/${safeWorkflowName}.cwl \\
  job.yml
`;
};

const generatePrefetchSh = (dockerImages) => {
    const pullLines = dockerImages.map(img => `docker pull ${img}`).join('\n');
    return `#!/bin/bash
# Pre-download all tool container images used by this workflow.
# Run this before 'docker build' to speed up the first workflow execution.
echo "Pulling neuroimaging tool images..."
${pullLines}
echo "All images pulled successfully."
`;
};

const generateReadme = (safeWorkflowName, runtimeInputs, dockerImages) => {
    const inputListMd = runtimeInputs.length > 0
        ? runtimeInputs.map(({ name, type, isArray }) => {
            const typeLabel = isArray ? `${type}[]` : type;
            return `- \`${name}\` — ${typeLabel}`;
        }).join('\n')
        : '- *(No runtime file inputs — all inputs are scalar parameters)*';

    const imageListMd = dockerImages.map(img => `docker pull ${img}`).join('\n');

    return `# niBuild Workflow Bundle

This bundle contains a CWL (Common Workflow Language) workflow generated by [niBuild](https://github.com/KunaalAgarwal/niBuild).

## Contents

- \`workflows/${safeWorkflowName}.cwl\` — Main workflow file
- \`workflows/${safeWorkflowName}_job.yml\` — Job file with pre-configured parameters
- \`cwl/\` — Tool definitions used by the workflow
- \`Dockerfile\` — Orchestration container for Docker-based execution
- \`run.sh\` — Entrypoint script with usage help
- \`prefetch_images.sh\` — Pre-pull tool Docker images

## Runtime File Inputs

These inputs must be supplied by editing the job file before running:

${inputListMd}

All scalar parameters (thresholds, flags, etc.) are pre-configured in the job file.

---

## Option 1: Run with Docker (Recommended)

Only Docker is required. No Python or cwltool installation needed.

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/)

### Setup

\`\`\`bash
unzip workflow_bundle.zip -d my_workflow
cd my_workflow

# Optional: pre-pull tool images
bash prefetch_images.sh
\`\`\`

### Edit the Job File

Open \`workflows/${safeWorkflowName}_job.yml\` and replace file path placeholders with your actual data paths (use \`/data/...\` paths that match your volume mount below).

### Build the Container

\`\`\`bash
docker build -t my-pipeline .
\`\`\`

### Run the Workflow

\`\`\`bash
docker run --rm \\
  -v /var/run/docker.sock:/var/run/docker.sock \\
  -v /path/to/data:/data \\
  -v /path/to/output:/output \\
  my-pipeline
\`\`\`

Pass \`--help\` to see usage info, or add cwltool flags (e.g. \`--verbose\`):

\`\`\`bash
docker run my-pipeline --help
docker run --rm -v ... my-pipeline --verbose
\`\`\`

---

## Option 2: Run with cwltool Directly

### Prerequisites

- Python 3 with pip
- [cwltool](https://github.com/common-workflow-language/cwltool): \`pip install cwltool\`
- [Docker](https://docs.docker.com/get-docker/) (for tool containers)

### Windows Users

CWL requires a Unix-like environment. Use WSL (Windows Subsystem for Linux):

1. Install WSL: \`wsl --install\` (then restart)
2. In WSL: \`sudo apt update && sudo apt install python3 python3-pip\`
3. \`pip install cwltool\`

### Setup

\`\`\`bash
unzip workflow_bundle.zip -d my_workflow
cd my_workflow
chmod +x workflows/${safeWorkflowName}.cwl
\`\`\`

### Edit the Job File

Open \`workflows/${safeWorkflowName}_job.yml\` and replace file path placeholders with your actual data paths.

### Run

\`\`\`bash
cwltool workflows/${safeWorkflowName}.cwl workflows/${safeWorkflowName}_job.yml
\`\`\`

With a specific output directory:

\`\`\`bash
cwltool --outdir ./results workflows/${safeWorkflowName}.cwl workflows/${safeWorkflowName}_job.yml
\`\`\`

---

## Tool Docker Images

This workflow uses the following container images:

\`\`\`bash
${imageListMd}
\`\`\`

## Troubleshooting

### Docker not found
Ensure Docker is running: \`docker --version\`

### Permission denied on Docker
Add your user to the docker group: \`sudo usermod -aG docker $USER\` (log out and back in)

### Validation errors
Validate the workflow: \`cwltool --validate workflows/${safeWorkflowName}.cwl\`

## Resources

- [CWL User Guide](https://www.commonwl.org/user_guide/)
- [cwltool Documentation](https://github.com/common-workflow-language/cwltool)
- [niBuild GitHub](https://github.com/KunaalAgarwal/niBuild)
`;
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
        try {
            const { wf, jobDefaults } = buildCWLWorkflowObject(graph);
            mainCWL = YAML.dump(wf, { noRefs: true });
            jobYml = buildJobTemplate(wf, jobDefaults);
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
        // Filter dummy nodes — they have no tool definitions
        const realNodes = graph.nodes.filter(n => !n.data?.isDummy);
        // Maps cwlPath -> { dockerImage, dockerVersion }
        const dockerVersionMap = {};
        realNodes.forEach(node => {
            const tool = getToolConfigSync(node.data.label);
            if (tool?.cwlPath && tool?.dockerImage) {
                // Use the node's dockerVersion, defaulting to 'latest'
                const version = node.data.dockerVersion || 'latest';
                // If multiple nodes use the same tool, use the first non-'latest' version,
                // or the last specified version if all are 'latest'
                if (!dockerVersionMap[tool.cwlPath] ||
                    (dockerVersionMap[tool.cwlPath].dockerVersion === 'latest' && version !== 'latest')) {
                    dockerVersionMap[tool.cwlPath] = {
                        dockerImage: tool.dockerImage,
                        dockerVersion: version
                    };
                }
            }
        });

        /* ---------- collect unique Docker images ---------- */
        const dockerImages = collectUniqueDockerImages(dockerVersionMap);

        /* ---------- fetch each unique tool file and inject Docker version ---------- */
        const uniquePaths = [
            ...new Set(realNodes.map(n => getToolConfigSync(n.data.label)?.cwlPath).filter(Boolean))
        ];

        try {
            for (const p of uniquePaths) {
                const res = await fetch(`${base}${p}`);
                if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

                let cwlContent = await res.text();

                // Inject Docker version if we have one for this tool
                const dockerInfo = dockerVersionMap[p];
                if (dockerInfo) {
                    try {
                        // Parse the CWL YAML
                        const cwlDoc = YAML.load(cwlContent);

                        // Update or create the DockerRequirement hint
                        if (!cwlDoc.hints) {
                            cwlDoc.hints = {};
                        }
                        cwlDoc.hints.DockerRequirement = {
                            dockerPull: `${dockerInfo.dockerImage}:${dockerInfo.dockerVersion}`
                        };

                        // Re-serialize to YAML, preserving the shebang if present
                        const hasShebang = cwlContent.startsWith('#!/');
                        const shebangLine = hasShebang ? cwlContent.split('\n')[0] + '\n\n' : '';
                        cwlContent = shebangLine + YAML.dump(cwlDoc, { noRefs: true, lineWidth: -1 });
                    } catch (parseErr) {
                        console.warn(`Could not parse CWL file ${p} for Docker injection:`, parseErr.message);
                        // Keep original content if parsing fails
                    }
                }

                zip.file(p, cwlContent);
            }
        } catch (err) {
            showError(`Unable to fetch tool file: ${err.message}`);
            return;
        }

        /* ---------- generate Docker support files + README ---------- */
        zip.file('Dockerfile', generateDockerfile(safeWorkflowName));
        zip.file('run.sh', generateRunSh(safeWorkflowName, runtimeInputs));
        zip.file('prefetch_images.sh', generatePrefetchSh(dockerImages));
        zip.file('README.md', generateReadme(safeWorkflowName, runtimeInputs, dockerImages));

        /* ---------- download ---------- */
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'workflow_bundle.zip');
    };

    return { generateWorkflow };
}