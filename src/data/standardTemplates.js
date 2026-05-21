/**
 * Curated registry of standard neuroimaging reference templates.
 *
 * Each entry describes a canonical template variant (MNI152, fsaverage, etc.)
 * that a user can drop onto the canvas via a Standard Template I/O node. The
 * picker UI groups by `family`. At export, the resolved blob is staged into
 * the RO-Crate's `additional_inputs/` directory and the job template input
 * for the wired tool input becomes `{ class: File, path: ../additional_inputs/<filename> }`.
 *
 * Sourcing model:
 *   All files are served from `public/templates/` (same-origin) because
 *   TemplateFlow's S3 bucket sets no Access-Control-Allow-Origin header
 *   and the browser cannot fetch it directly. The `source.url` field
 *   records the upstream provenance and is the URL that
 *   `scripts/downloadStandardTemplates.mjs` pulls from at build time
 *   (Node `fetch` is exempt from CORS). `public/templates/` is gitignored;
 *   `npm run prebuild` re-populates it before each deploy.
 *
 * Adding a new entry: ensure the `filename` is unique across the registry
 * (used as the path inside `additional_inputs/`) and that `license` /
 * `citation` accurately reflect the origin — both flow into the RO-Crate
 * metadata so downstream consumers can attribute correctly. After adding,
 * run `npm run templates:download` to fetch the file locally.
 */

export const STANDARD_TEMPLATES = [
    {
        id: 'mni152_t1_1mm',
        label: 'MNI152 T1 (1 mm)',
        family: 'MNI152',
        modality: 'T1w',
        resolution: '1mm',
        brainExtracted: false,
        filename: 'MNI152_T1_1mm.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/tpl-MNI152NLin6Asym_res-01_T1w.nii.gz',
        },
        sizeBytes: 12_500_000,
        license: 'PDDL-1.0',
        citation: 'Evans AC et al., NeuroImage (2012) — ICBM 152 Nonlinear Asymmetric template',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_t1_1mm_brain',
        label: 'MNI152 T1 (1 mm, brain-extracted)',
        family: 'MNI152',
        modality: 'T1w',
        resolution: '1mm',
        brainExtracted: true,
        filename: 'MNI152_T1_1mm_brain.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/tpl-MNI152NLin6Asym_res-01_desc-brain_T1w.nii.gz',
        },
        sizeBytes: 7_800_000,
        license: 'PDDL-1.0',
        citation: 'Evans AC et al., NeuroImage (2012) — ICBM 152 Nonlinear Asymmetric template',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_t1_2mm',
        label: 'MNI152 T1 (2 mm)',
        family: 'MNI152',
        modality: 'T1w',
        resolution: '2mm',
        brainExtracted: false,
        filename: 'MNI152_T1_2mm.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/tpl-MNI152NLin6Asym_res-02_T1w.nii.gz',
        },
        sizeBytes: 1_900_000,
        license: 'PDDL-1.0',
        citation: 'Evans AC et al., NeuroImage (2012) — ICBM 152 Nonlinear Asymmetric template',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_t1_2mm_brain',
        label: 'MNI152 T1 (2 mm, brain-extracted)',
        family: 'MNI152',
        modality: 'T1w',
        resolution: '2mm',
        brainExtracted: true,
        filename: 'MNI152_T1_2mm_brain.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/tpl-MNI152NLin6Asym_res-02_desc-brain_T1w.nii.gz',
        },
        sizeBytes: 1_200_000,
        license: 'PDDL-1.0',
        citation: 'Evans AC et al., NeuroImage (2012) — ICBM 152 Nonlinear Asymmetric template',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_t1_2mm_brain_mask',
        label: 'MNI152 T1 (2 mm, brain mask)',
        family: 'MNI152',
        modality: 'mask',
        resolution: '2mm',
        brainExtracted: true,
        filename: 'MNI152_T1_2mm_brain_mask.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin6Asym/tpl-MNI152NLin6Asym_res-02_desc-brain_mask.nii.gz',
        },
        sizeBytes: 200_000,
        license: 'PDDL-1.0',
        citation: 'Evans AC et al., NeuroImage (2012) — ICBM 152 Nonlinear Asymmetric template',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_nlin2009casym_t1_1mm',
        label: 'MNI152NLin2009cAsym T1 (1 mm)',
        family: 'MNI152NLin2009cAsym',
        modality: 'T1w',
        resolution: '1mm',
        brainExtracted: false,
        filename: 'MNI152NLin2009cAsym_T1_1mm.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009cAsym/tpl-MNI152NLin2009cAsym_res-01_T1w.nii.gz',
        },
        sizeBytes: 13_500_000,
        license: 'PDDL-1.0',
        citation: 'Fonov V et al., NeuroImage (2011) — ICBM 152 2009c Nonlinear Asymmetric (fMRIPrep default)',
        acceptedBy: ['File'],
    },
    {
        id: 'mni152_nlin2009casym_t1_1mm_brain',
        label: 'MNI152NLin2009cAsym T1 (1 mm, brain-extracted)',
        family: 'MNI152NLin2009cAsym',
        modality: 'T1w',
        resolution: '1mm',
        brainExtracted: true,
        filename: 'MNI152NLin2009cAsym_T1_1mm_brain.nii.gz',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-MNI152NLin2009cAsym/tpl-MNI152NLin2009cAsym_res-01_desc-brain_T1w.nii.gz',
        },
        sizeBytes: 8_400_000,
        license: 'PDDL-1.0',
        citation: 'Fonov V et al., NeuroImage (2011) — ICBM 152 2009c Nonlinear Asymmetric (fMRIPrep default)',
        acceptedBy: ['File'],
    },
    {
        id: 'fsaverage_pial_lh',
        label: 'fsaverage pial surface (left hemisphere)',
        family: 'fsaverage',
        modality: 'surface',
        resolution: 'fsaverage',
        brainExtracted: false,
        filename: 'fsaverage_lh.pial.surf.gii',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-fsaverage/tpl-fsaverage_hemi-L_den-164k_pial.surf.gii',
        },
        sizeBytes: 4_900_000,
        license: 'FreeSurfer Software License',
        citation: 'Fischl B, NeuroImage (2012) — FreeSurfer fsaverage template surface',
        acceptedBy: ['File'],
    },
    {
        id: 'fsaverage_pial_rh',
        label: 'fsaverage pial surface (right hemisphere)',
        family: 'fsaverage',
        modality: 'surface',
        resolution: 'fsaverage',
        brainExtracted: false,
        filename: 'fsaverage_rh.pial.surf.gii',
        source: {
            kind: 'bundled',
            url: 'https://templateflow.s3.amazonaws.com/tpl-fsaverage/tpl-fsaverage_hemi-R_den-164k_pial.surf.gii',
        },
        sizeBytes: 4_900_000,
        license: 'FreeSurfer Software License',
        citation: 'Fischl B, NeuroImage (2012) — FreeSurfer fsaverage template surface',
        acceptedBy: ['File'],
    },
];

const TEMPLATES_BY_ID = new Map(STANDARD_TEMPLATES.map((t) => [t.id, t]));

export function getTemplateById(id) {
    return TEMPLATES_BY_ID.get(id) || null;
}

export function getTemplatesGroupedByFamily() {
    const groups = new Map();
    for (const tpl of STANDARD_TEMPLATES) {
        if (!groups.has(tpl.family)) groups.set(tpl.family, []);
        groups.get(tpl.family).push(tpl);
    }
    return groups;
}
