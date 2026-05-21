/**
 * fMRIPrep pipeline definition — constituent CLI invocations.
 *
 * Encodes fMRIPrep ~24.x as a graph of CLI-backed nodes that niBuild can
 * splatter onto the canvas when a user expands an fMRIPrep PipelineNode.
 *
 * Source-of-truth: fMRIPrep/sMRIPrep/SDCFlows/niworkflows master sources
 * (see plan file for full source URLs). ICA-AROMA was removed in
 * fMRIPrep 24.0.0 and is not represented here.
 *
 * Encoding rules:
 *   - Only CLI-backed steps are nodes. Python-only Nipype utilities
 *     (ValidateImage, Conform, ConcatenateXFMs, RobustAverage, etc.) are
 *     elided; edges connect upstream CLI producer directly to downstream
 *     CLI consumer.
 *   - `_gap: true` on a node flags it as a real CLI invocation that
 *     niBuild does not yet have a CWL wrapper for (e.g. mri_robust_template,
 *     antsAI, wb_command -create-signed-distance-volume). These render
 *     with a distinct badge but are kept so the pipeline shape is faithful.
 *   - `conditional` on a node gates it on a pipeline option (e.g.
 *     `{ option: 'freesurfer', equals: true }`). When the user expands
 *     with that option flipped, the node and its connected edges are
 *     filtered out.
 *   - Node `parameters` are seeded with fMRIPrep's actual defaults where
 *     reasonable. Users can edit per-instance after expansion.
 *
 * Stage labels (`stage` field) come from the sMRIPrep/fMRIPrep workflow
 * decomposition: Stage 1-15 anatomical (sMRIPrep), plus BOLD fit/SDC/
 * skullstrip/coreg/resample/surface/CIFTI/confounds.
 */

// Layout grid — positions are computed deterministically by stage / column / row.
// Each stage occupies one column band; nodes within a stage stack vertically.
const COL_WIDTH = 260;
const ROW_HEIGHT = 110;

// Position helper — convert (col, row) to a {x, y}.
const at = (col, row) => ({ x: 80 + col * COL_WIDTH, y: 80 + row * ROW_HEIGHT });

// Standard arrayed-input "scatter over subjects/runs" config — used on
// per-T1w MapNodes (Stage 1) and per-BOLD-run MapNodes (BOLD fit).
const SUBJECT_SCATTER = {
    scatterInputs: ['input_image'],
    scatterMethod: 'dotproduct',
};

const RUN_SCATTER = {
    scatterInputs: ['in_file'],
    scatterMethod: 'dotproduct',
};

/**
 * Pipeline-level options — these gate `conditional` flags on nodes.
 * Values shown to the user in the PipelineOptionsPanel after dropping the
 * PipelineNode on the canvas.
 */
const OPTIONS = {
    freesurfer: {
        type: 'boolean',
        default: true,
        label: 'Run FreeSurfer surface reconstruction',
        description: 'Disable with --fs-no-reconall. When off, FSL FLIRT BBR replaces bbregister for coregistration.',
    },
    cifti_output: {
        type: 'enum',
        symbols: [null, '91k', '170k'],
        default: null,
        label: 'CIFTI grayordinate output',
        description: 'Produces dtseries.nii at 91k or 170k grayordinates (requires --freesurfer).',
    },
    use_msmsulc: {
        type: 'boolean',
        default: false,
        label: 'Use MSM-Sulc registration to fsLR',
        description: 'Replaces fsLR spherical project-unproject with MSM sulc-based registration.',
    },
    skull_strip_mode: {
        type: 'enum',
        symbols: ['force', 'auto', 'skip'],
        default: 'auto',
        label: 'Skull-strip mode',
        description: 'force = always run ANTs BrainExtraction; skip = T1w already stripped; auto = detect.',
    },
    slice_timing: {
        type: 'boolean',
        default: true,
        label: 'Slice timing correction',
        description: 'Runs AFNI 3dTshift on BOLD if SliceTiming metadata present.',
    },
    sdc_method: {
        type: 'enum',
        symbols: ['none', 'pepolar', 'phasediff', 'syn'],
        default: 'pepolar',
        label: 'Susceptibility distortion correction method',
        description: 'pepolar uses TOPUP; phasediff uses PRELUDE; syn is fieldmap-less (antsRegistration).',
    },
    have_t2w: {
        type: 'boolean',
        default: false,
        label: 'T2w image available',
        description: 'When true, also processes T2w and coregisters it to T1w via bbregister.',
    },
    output_spaces: {
        type: 'string[]',
        default: ['MNI152NLin2009cAsym'],
        label: 'Output spaces',
        description: 'Templates for spatial normalization. Each adds one antsRegistration invocation.',
    },
};

/* ── Anatomical workflow nodes (Stages 1-7) ────────────────────────── */

const ANAT_NODES = [
    /* ─── Stage 1: anatomical reference (T1w averaging) ─── */
    {
        id: 'anat_denoise_t1w',
        label: 'DenoiseImage',
        stage: 'Stage 1: T1w template',
        parameters: { noise_model: 'Rician' },
        ...SUBJECT_SCATTER,
        position: at(0, 0),
    },
    {
        id: 'anat_n4_initial_t1w',
        label: 'N4BiasFieldCorrection',
        stage: 'Stage 1: T1w template',
        parameters: { dimension: 3, copy_header: true },
        ...SUBJECT_SCATTER,
        position: at(1, 0),
    },
    {
        id: 'anat_robust_template_t1w',
        label: 'mri_robust_template',
        stage: 'Stage 1: T1w template',
        parameters: {
            auto_detect_sensitivity: true,
            intensity_scaling: true,
            fixed_timepoint: true,
            no_iteration: true,
            subsample_threshold: 200,
        },
        position: at(2, 0),
        _gap: true,
    },

    /* ─── Stage 2: brain extraction (ANTs atlas-based) ─── */
    {
        id: 'anat_truncate_intensity',
        label: 'ImageMath',
        stage: 'Stage 2: Brain extraction',
        parameters: { operation: 'TruncateImageIntensity', op2: '0.01 0.999 256' },
        position: at(3, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_n4_brain_extraction',
        label: 'N4BiasFieldCorrection',
        stage: 'Stage 2: Brain extraction',
        parameters: {
            dimension: 3,
            n_iterations: '50x50x50x50',
            convergence_threshold: '1e-7',
            shrink_factor: 4,
            bspline_fitting_distance: 200,
        },
        position: at(4, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_ai_init',
        label: 'antsAI',
        stage: 'Stage 2: Brain extraction',
        parameters: {
            metric: 'Mattes[32, Regular, 0.25]',
            transform: 'Affine[0.1]',
            search_factor: '15x0.1',
            convergence: '10x1e-6x10',
        },
        position: at(5, 0),
        conditional: { option: 'skull_strip_mode', equals: 'force' },
        _gap: true,
    },
    {
        id: 'anat_register_template_be',
        label: 'antsRegistration',
        stage: 'Stage 2: Brain extraction',
        parameters: { float: true },
        notes: 'Uses antsBrainExtraction_precise.json (rigid Mattes → affine Mattes → SyN CC)',
        position: at(6, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_apply_brain_prob_mask',
        label: 'antsApplyTransforms',
        stage: 'Stage 2: Brain extraction',
        parameters: { interpolation: 'Gaussian' },
        position: at(7, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_threshold_brain_mask',
        label: 'ThresholdImage',
        stage: 'Stage 2: Brain extraction',
        parameters: { dimension: 3, th_low: 0.5, th_high: 1.0, inside_value: 1, outside_value: 0 },
        position: at(8, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_atropos_dilate',
        label: 'ImageMath',
        stage: 'Stage 2: Brain extraction',
        parameters: { operation: 'MD', op2: '2' },
        position: at(8, 1),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_atropos_segment',
        label: 'Atropos',
        stage: 'Stage 2: Brain extraction',
        parameters: {
            number_of_tissue_classes: 3,
            initialization: 'KMeans',
            likelihood_model: 'Gaussian',
            mrf_smoothing_factor: 0.1,
            n_iterations: 3,
            save_posteriors: true,
        },
        position: at(9, 1),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },
    {
        id: 'anat_atropos_n4_refine',
        label: 'N4BiasFieldCorrection',
        stage: 'Stage 2: Brain extraction',
        parameters: {
            dimension: 3,
            save_bias: true,
            n_iterations: '50x50x50x50x50',
            convergence_threshold: '1e-7',
            shrink_factor: 4,
            rescale_intensities: true,
            bspline_fitting_distance: 200,
        },
        position: at(10, 0),
        conditional: { option: 'skull_strip_mode', notEquals: 'skip' },
    },

    /* ─── Stage 3: tissue segmentation ─── */
    {
        id: 'anat_fast_seg',
        label: 'fast',
        stage: 'Stage 3: Tissue segmentation',
        parameters: { segments: true, no_bias: true, probability_maps: true, bias_iters: 0 },
        position: at(11, 0),
    },

    /* ─── Stage 4: spatial normalization (per template in output_spaces) ─── */
    {
        id: 'anat_template_truncate',
        label: 'ImageMath',
        stage: 'Stage 4: Spatial normalization',
        parameters: { operation: 'TruncateImageIntensity', op2: '0.01 0.999 256' },
        position: at(12, 0),
    },
    {
        id: 'anat_register_template',
        label: 'antsRegistration',
        stage: 'Stage 4: Spatial normalization',
        parameters: { float: true },
        notes: 'Uses t1w-mni_registration_precise_000.json (rigid → affine → SyN CC, winsorize 0.005-0.995)',
        scatterInputs: [],
        position: at(13, 0),
    },

    /* ─── Stage 5: FreeSurfer surface reconstruction ─── */
    {
        id: 'anat_recon_autorecon1',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { directive: 'autorecon1', flags: '-noskullstrip -noT2pial -noFLAIRpial' },
        position: at(11, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_inject_mask',
        label: 'mri_convert',
        stage: 'Stage 5: Surface reconstruction',
        notes: 'Injects ANTs brain mask as brainmask.auto.mgz / brainmask.mgz',
        position: at(12, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_gcareg',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { steps: 'gcareg' },
        position: at(13, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_autorecon2_vol',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { directive: 'autorecon2-volonly' },
        position: at(14, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_autorecon_hemi',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: {
            directive: 'autorecon-hemi',
            flags: '-noparcstats -noparcstats2 -noparcstats3 -nohyporelabel -nobalabels',
        },
        scatterInputs: ['hemi'],
        scatterMethod: 'dotproduct',
        position: at(15, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_cortribbon',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { steps: 'cortribbon', parallel: true },
        position: at(16, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_autorecon_hemi_parcstats',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { directive: 'autorecon-hemi', flags: '-nohyporelabel' },
        scatterInputs: ['hemi'],
        scatterMethod: 'dotproduct',
        position: at(17, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_recon_autorecon3',
        label: 'recon-all',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { directive: 'autorecon3' },
        position: at(18, 2),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'anat_make_midthickness',
        label: 'mris_expand',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { thickness: true, distance: 0.5, out_name: 'midthickness' },
        scatterInputs: ['in_file'],
        scatterMethod: 'dotproduct',
        position: at(19, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_fsnative_to_anat',
        label: 'mri_robust_register',
        stage: 'Stage 5: Surface reconstruction',
        parameters: { auto_sens: true, est_int_scale: true },
        position: at(20, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },

    /* ─── Stage 6: brain mask refinement (FS-aware) ─── */
    {
        id: 'anat_aseg_to_native',
        label: 'mri_vol2vol',
        stage: 'Stage 6: Mask refinement',
        parameters: { interp: 'nearest', transformed_file: 'seg.nii.gz' },
        position: at(21, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_refined_apply_mask',
        label: 'fslmaths',
        stage: 'Stage 6: Mask refinement',
        parameters: { operation: 'mas' },
        notes: 'Apply refined brain mask (FS-aware)',
        position: at(22, 2),
        conditional: { option: 'freesurfer', equals: true },
    },

    /* ─── Stage 7: T2w branch (if T2w available) ─── */
    {
        id: 'anat_denoise_t2w',
        label: 'DenoiseImage',
        stage: 'Stage 7: T2w',
        parameters: { noise_model: 'Rician' },
        position: at(0, 4),
        conditional: { option: 'have_t2w', equals: true },
    },
    {
        id: 'anat_n4_t2w',
        label: 'N4BiasFieldCorrection',
        stage: 'Stage 7: T2w',
        parameters: { dimension: 3, copy_header: true },
        position: at(1, 4),
        conditional: { option: 'have_t2w', equals: true },
    },
    {
        id: 'anat_robust_template_t2w',
        label: 'mri_robust_template',
        stage: 'Stage 7: T2w',
        parameters: { auto_detect_sensitivity: true, intensity_scaling: true, fixed_timepoint: true },
        position: at(2, 4),
        conditional: { option: 'have_t2w', equals: true },
        _gap: true,
    },
    {
        id: 'anat_bbregister_t2w',
        label: 'bbregister',
        stage: 'Stage 7: T2w',
        parameters: { contrast_type: 't2', init: 'coreg', dof: 6, out_lta_file: true },
        notes: '--gm-proj-abs 2 --wm-proj-abs 1',
        position: at(3, 4),
        conditional: { option: 'have_t2w', equals: true },
    },
    {
        id: 'anat_apply_t2w_to_t1w',
        label: 'antsApplyTransforms',
        stage: 'Stage 7: T2w',
        parameters: { dimension: 3, default_value: 0, float: true, interpolation: 'LanczosWindowedSinc' },
        position: at(4, 4),
        conditional: { option: 'have_t2w', equals: true },
    },

    /* ─── Stage 8: surface conversion and morphometrics ─── */
    {
        id: 'anat_signed_dist_white',
        label: 'wb_command_create_signed_distance_volume',
        stage: 'Stage 8: Surfaces',
        scatterInputs: ['surface'],
        scatterMethod: 'dotproduct',
        position: at(23, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_signed_dist_pial',
        label: 'wb_command_create_signed_distance_volume',
        stage: 'Stage 8: Surfaces',
        scatterInputs: ['surface'],
        scatterMethod: 'dotproduct',
        position: at(23, 3),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_mris_convert_surfaces',
        label: 'mris_convert',
        stage: 'Stage 8: Surfaces',
        parameters: { out_datatype: 'gii', to_scanner: true },
        notes: 'Converts white, pial, midthickness, inflated, sphere, sphere.reg to GIFTI',
        scatterInputs: ['in_file'],
        scatterMethod: 'dotproduct',
        position: at(24, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_mris_convert_data',
        label: 'mris_convert',
        stage: 'Stage 8: Surfaces',
        parameters: { out_datatype: 'gii', curvature_mode: true },
        notes: 'Converts thickness, curv, sulc scalars (mris_convert -c)',
        scatterInputs: ['in_file'],
        scatterMethod: 'dotproduct',
        position: at(25, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },

    /* ─── Stage 9: fsLR sphere registration ─── */
    {
        id: 'anat_fslr_sphere_project',
        label: 'wb_command_surface_sphere_project_unproject',
        stage: 'Stage 9: fsLR registration',
        scatterInputs: ['sphere_in'],
        scatterMethod: 'dotproduct',
        position: at(26, 2),
        conditional: { option: 'freesurfer', equals: true },
    },

    /* ─── Stage 10: MSM-Sulc registration ─── */
    {
        id: 'anat_msm_affine_regression',
        label: 'wb_command_surface_affine_regression',
        stage: 'Stage 10: MSM-Sulc',
        position: at(27, 2),
        conditional: { option: 'use_msmsulc', equals: true },
        _gap: true,
    },
    {
        id: 'anat_msm_apply_affine',
        label: 'wb_command_surface_apply_affine',
        stage: 'Stage 10: MSM-Sulc',
        position: at(28, 2),
        conditional: { option: 'use_msmsulc', equals: true },
        _gap: true,
    },
    {
        id: 'anat_msm_modify_sphere',
        label: 'wb_command_surface_modify_sphere',
        stage: 'Stage 10: MSM-Sulc',
        parameters: { radius: 100 },
        position: at(29, 2),
        conditional: { option: 'use_msmsulc', equals: true },
        _gap: true,
    },
    {
        id: 'anat_msm_metric_invert',
        label: 'wb_command_metric_math',
        stage: 'Stage 10: MSM-Sulc',
        parameters: { operation: 'invert', metric: 'sulc' },
        position: at(30, 2),
        conditional: { option: 'use_msmsulc', equals: true },
        _gap: true,
    },
    {
        id: 'anat_msm_run',
        label: 'newmsm',
        stage: 'Stage 10: MSM-Sulc',
        parameters: { verbose: true },
        position: at(31, 2),
        conditional: { option: 'use_msmsulc', equals: true },
        _gap: true,
    },

    /* ─── Stage 11: cortex masks ─── */
    {
        id: 'anat_cortex_thickness_abs',
        label: 'wb_command_metric_math',
        stage: 'Stage 11: Cortex masks',
        parameters: { operation: 'abs', metric: 'thickness' },
        position: at(32, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_cortex_metric_bin',
        label: 'wb_command_metric_math',
        stage: 'Stage 11: Cortex masks',
        parameters: { operation: 'bin', metric: 'roi' },
        position: at(33, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_cortex_fill_holes',
        label: 'wb_command_metric_fill_holes',
        stage: 'Stage 11: Cortex masks',
        position: at(34, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'anat_cortex_remove_islands',
        label: 'wb_command_metric_remove_islands',
        stage: 'Stage 11: Cortex masks',
        position: at(35, 2),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },

    /* ─── Stages 12-14: CIFTI grayordinates (optional) ─── */
    {
        id: 'anat_hcp_metric_dilate',
        label: 'wb_command_metric_dilate',
        stage: 'Stage 12: CIFTI morphometrics',
        parameters: { distance: 10, nearest: true },
        position: at(32, 3),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'anat_resample_surfaces',
        label: 'wb_command_surface_resample',
        stage: 'Stage 13: Surface resample',
        parameters: { method: 'BARYCENTRIC' },
        position: at(33, 3),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'anat_metric_resample_grayords',
        label: 'wb_command_metric_resample',
        stage: 'Stage 14: Grayordinate metrics',
        parameters: { method: 'ADAP_BARY_AREA', area_surfs: true },
        position: at(34, 3),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'anat_metric_mask_grayords',
        label: 'wb_command_metric_mask',
        stage: 'Stage 14: Grayordinate metrics',
        position: at(35, 3),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'anat_cifti_dscalar',
        label: 'wb_command_cifti_create_dense_scalar',
        stage: 'Stage 14: Grayordinate metrics',
        parameters: { grayordinates: '91k' },
        position: at(36, 3),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
];

/* ── BOLD workflow nodes ───────────────────────────────────────────── */

const BOLD_NODES = [
    /* ─── BOLD fit: HMC, STC ─── */
    {
        id: 'bold_mcflirt',
        label: 'mcflirt',
        stage: 'BOLD: Head motion correction',
        parameters: { save_mats: true },
        ...RUN_SCATTER,
        position: at(0, 8),
    },
    {
        id: 'bold_tshift',
        label: '3dTshift',
        stage: 'BOLD: Slice timing',
        parameters: { outputtype: 'NIFTI_GZ' },
        ...RUN_SCATTER,
        position: at(1, 8),
        conditional: { option: 'slice_timing', equals: true },
    },

    /* ─── SDC: PEPOLAR / phasediff / SyN (mutually exclusive) ─── */
    {
        id: 'bold_topup',
        label: 'topup',
        stage: 'BOLD: SDC (PEPOLAR)',
        parameters: { config: 'b02b0.cnf' },
        position: at(2, 7),
        conditional: { option: 'sdc_method', equals: 'pepolar' },
    },
    {
        id: 'bold_prelude',
        label: 'prelude',
        stage: 'BOLD: SDC (PhaseDiff)',
        position: at(2, 8),
        conditional: { option: 'sdc_method', equals: 'phasediff' },
        _gap: true,
    },
    {
        id: 'bold_syn_register',
        label: 'antsRegistration',
        stage: 'BOLD: SDC (SyN)',
        parameters: { float: true },
        notes: 'sd_syn.json — restrict_deformation along PE axis',
        position: at(2, 9),
        conditional: { option: 'sdc_method', equals: 'syn' },
    },

    /* ─── BOLD enhance + skull strip ─── */
    {
        id: 'bold_n4',
        label: 'N4BiasFieldCorrection',
        stage: 'BOLD: Skull strip',
        parameters: {
            dimension: 3,
            copy_header: true,
            bspline_fitting_distance: 200,
            rescale_intensities: true,
            shrink_factor: 2,
        },
        ...RUN_SCATTER,
        position: at(3, 8),
    },
    {
        id: 'bold_bet',
        label: 'bet',
        stage: 'BOLD: Skull strip',
        parameters: { frac: 0.2, mask: true },
        ...RUN_SCATTER,
        position: at(4, 8),
    },
    {
        id: 'bold_unifize',
        label: '3dUnifize',
        stage: 'BOLD: Skull strip',
        parameters: { t2: true, outputtype: 'NIFTI_GZ' },
        notes: '-clfrac 0.2 -rbt 18.3 65.0 90.0',
        ...RUN_SCATTER,
        position: at(5, 8),
    },
    {
        id: 'bold_automask',
        label: '3dAutomask',
        stage: 'BOLD: Skull strip',
        parameters: { dilate: 1, outputtype: 'NIFTI_GZ' },
        ...RUN_SCATTER,
        position: at(6, 8),
    },
    {
        id: 'bold_mask_intersect',
        label: 'fslmaths',
        stage: 'BOLD: Skull strip',
        parameters: { operation: 'mul' },
        notes: 'Intersect bet mask × 3dAutomask',
        ...RUN_SCATTER,
        position: at(7, 8),
    },

    /* ─── Fieldmap-to-EPI registration ─── */
    {
        id: 'bold_coeff2epi',
        label: 'antsRegistration',
        stage: 'BOLD: Fieldmap→EPI',
        parameters: { float: true },
        position: at(8, 8),
        conditional: { option: 'sdc_method', notEquals: 'none' },
    },

    /* ─── BOLD → T1w coregistration ─── */
    {
        id: 'bold_mri_coreg',
        label: 'mri_coreg',
        stage: 'BOLD: Coregistration',
        parameters: { dof: 6, sep: 4, ftol: 0.0001, linmintol: 0.01 },
        ...RUN_SCATTER,
        position: at(9, 8),
        conditional: { option: 'freesurfer', equals: true },
        _gap: true,
    },
    {
        id: 'bold_bbregister',
        label: 'bbregister',
        stage: 'BOLD: Coregistration',
        parameters: { dof: 6, contrast_type: 't2', out_lta_file: true },
        ...RUN_SCATTER,
        position: at(10, 8),
        conditional: { option: 'freesurfer', equals: true },
    },
    {
        id: 'bold_flirt_bbr',
        label: 'flirt',
        stage: 'BOLD: Coregistration (FSL)',
        parameters: { cost_func: 'bbr', dof: 6 },
        notes: '-basescale 1; schedule=$FSLDIR/etc/flirtsch/bbr.sch',
        ...RUN_SCATTER,
        position: at(10, 9),
        conditional: { option: 'freesurfer', equals: false },
    },
    {
        id: 'bold_lta_convert',
        label: 'lta_convert',
        stage: 'BOLD: Coregistration (FSL)',
        parameters: { out_fsl: true, out_lta: true },
        ...RUN_SCATTER,
        position: at(11, 9),
        conditional: { option: 'freesurfer', equals: false },
        _gap: true,
    },

    /* ─── Confounds: mostly Python, but antsApplyTransforms transfers masks ─── */
    {
        id: 'bold_confounds_apply_xfm',
        label: 'antsApplyTransforms',
        stage: 'BOLD: Confound masks',
        parameters: { interpolation: 'MultiLabel' },
        notes: 'Resamples T1w tissue masks/labels into BOLD space',
        ...RUN_SCATTER,
        position: at(12, 8),
    },

    /* ─── BOLD → surface (FreeSurfer only) ─── */
    {
        id: 'bold_vol2surf',
        label: 'mri_vol2surf',
        stage: 'BOLD: Surface sampling',
        parameters: {
            interp_method: 'trilinear',
            out_type: 'gii',
            sampling_method: 'average',
            sampling_range: '0,1,0.2',
            sampling_units: 'frac',
        },
        scatterInputs: ['source_file'],
        scatterMethod: 'dotproduct',
        position: at(13, 8),
        conditional: { option: 'freesurfer', equals: true },
    },

    /* ─── Goodvoxels mask (CIFTI path) ─── */
    {
        id: 'bold_goodvoxels_tstd',
        label: 'fslmaths',
        stage: 'BOLD: Goodvoxels',
        parameters: { operation: 'Tstd' },
        ...RUN_SCATTER,
        position: at(14, 8),
        conditional: { option: 'cifti_output', notEquals: null },
    },
    {
        id: 'bold_goodvoxels_tmean',
        label: 'fslmaths',
        stage: 'BOLD: Goodvoxels',
        parameters: { operation: 'Tmean' },
        ...RUN_SCATTER,
        position: at(15, 8),
        conditional: { option: 'cifti_output', notEquals: null },
    },
    {
        id: 'bold_goodvoxels_stats',
        label: 'fslstats',
        stage: 'BOLD: Goodvoxels',
        parameters: { op_string: '-M -S' },
        ...RUN_SCATTER,
        position: at(16, 8),
        conditional: { option: 'cifti_output', notEquals: null },
    },

    /* ─── CIFTI: volume-to-surface and resampling ─── */
    {
        id: 'bold_vol_to_surf_wb',
        label: 'wb_command_volume_to_surface_mapping',
        stage: 'BOLD: CIFTI sampling',
        parameters: { method: 'ribbon-constrained' },
        scatterInputs: ['volume_file'],
        scatterMethod: 'dotproduct',
        position: at(17, 8),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'bold_metric_dilate',
        label: 'wb_command_metric_dilate',
        stage: 'BOLD: CIFTI sampling',
        parameters: { distance: 10, nearest: true },
        scatterInputs: ['metric_in'],
        scatterMethod: 'dotproduct',
        position: at(18, 8),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'bold_metric_resample',
        label: 'wb_command_metric_resample',
        stage: 'BOLD: CIFTI sampling',
        parameters: { method: 'ADAP_BARY_AREA', area_surfs: true },
        scatterInputs: ['metric_in'],
        scatterMethod: 'dotproduct',
        position: at(19, 8),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
    {
        id: 'bold_metric_mask',
        label: 'wb_command_metric_mask',
        stage: 'BOLD: CIFTI sampling',
        scatterInputs: ['metric_in'],
        scatterMethod: 'dotproduct',
        position: at(20, 8),
        conditional: { option: 'cifti_output', notEquals: null },
        _gap: true,
    },
];

const ALL_NODES = [...ANAT_NODES, ...BOLD_NODES];

/* ── Edges: CLI-to-CLI data flow ───────────────────────────────────── */

// Helper: build an edge with a single sourceOutput → targetInput mapping.
const edge = (id, source, target, sourceOutput, targetInput) => ({
    id,
    source,
    target,
    data: { mappings: [{ sourceOutput, targetInput }] },
});

const ANAT_EDGES = [
    // Stage 1: denoise → N4 → robust template
    edge('e_anat_1', 'anat_denoise_t1w', 'anat_n4_initial_t1w', 'output_image', 'input_image'),
    edge('e_anat_2', 'anat_n4_initial_t1w', 'anat_robust_template_t1w', 'output_image', 'in_files'),

    // Stage 2 brain-extraction chain
    edge('e_anat_3', 'anat_robust_template_t1w', 'anat_truncate_intensity', 'out_file', 'op1'),
    edge('e_anat_4', 'anat_truncate_intensity', 'anat_n4_brain_extraction', 'output_image', 'input_image'),
    edge('e_anat_5', 'anat_n4_brain_extraction', 'anat_register_template_be', 'output_image', 'moving_image'),
    edge('e_anat_6', 'anat_n4_brain_extraction', 'anat_ai_init', 'output_image', 'moving_image'),
    edge('e_anat_7', 'anat_ai_init', 'anat_register_template_be', 'output_transform', 'initial_moving_transform'),
    edge(
        'e_anat_8',
        'anat_register_template_be',
        'anat_apply_brain_prob_mask',
        'inverse_composite_transform',
        'transforms',
    ),
    edge('e_anat_9', 'anat_apply_brain_prob_mask', 'anat_threshold_brain_mask', 'output_image', 'input_image'),
    edge('e_anat_10', 'anat_threshold_brain_mask', 'anat_atropos_dilate', 'output_image', 'op1'),
    edge('e_anat_11', 'anat_atropos_dilate', 'anat_atropos_segment', 'output_image', 'mask_image'),
    edge('e_anat_12', 'anat_n4_brain_extraction', 'anat_atropos_segment', 'output_image', 'intensity_images'),
    edge('e_anat_13', 'anat_atropos_segment', 'anat_atropos_n4_refine', 'output_posteriors', 'weight_image'),
    edge('e_anat_14', 'anat_n4_brain_extraction', 'anat_atropos_n4_refine', 'output_image', 'input_image'),

    // Stage 3: refined N4 → FAST
    edge('e_anat_15', 'anat_atropos_n4_refine', 'anat_fast_seg', 'output_image', 'in_files'),

    // Stage 4: spatial normalization
    edge('e_anat_16', 'anat_atropos_n4_refine', 'anat_template_truncate', 'output_image', 'op1'),
    edge('e_anat_17', 'anat_template_truncate', 'anat_register_template', 'output_image', 'moving_image'),

    // Stage 5: FreeSurfer chain
    edge('e_anat_18', 'anat_robust_template_t1w', 'anat_recon_autorecon1', 'out_file', 'T1_files'),
    edge('e_anat_19', 'anat_threshold_brain_mask', 'anat_recon_inject_mask', 'output_image', 'in_file'),
    edge('e_anat_20', 'anat_recon_inject_mask', 'anat_recon_gcareg', 'out_file', 'subjects_dir'),
    edge('e_anat_21', 'anat_recon_gcareg', 'anat_recon_autorecon2_vol', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_22', 'anat_recon_autorecon2_vol', 'anat_recon_autorecon_hemi', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_23', 'anat_recon_autorecon_hemi', 'anat_recon_cortribbon', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_24', 'anat_recon_cortribbon', 'anat_recon_autorecon_hemi_parcstats', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_25', 'anat_recon_autorecon_hemi_parcstats', 'anat_recon_autorecon3', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_26', 'anat_recon_autorecon3', 'anat_make_midthickness', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_27', 'anat_recon_autorecon3', 'anat_fsnative_to_anat', 'orig_file', 'source_file'),
    edge('e_anat_28', 'anat_robust_template_t1w', 'anat_fsnative_to_anat', 'out_file', 'target_file'),

    // Stage 6: refinement
    edge('e_anat_29', 'anat_recon_autorecon3', 'anat_aseg_to_native', 'aseg', 'source_file'),
    edge('e_anat_30', 'anat_fsnative_to_anat', 'anat_aseg_to_native', 'out_reg_file', 'lta_file'),
    edge('e_anat_31', 'anat_aseg_to_native', 'anat_refined_apply_mask', 'transformed_file', 'mask_file'),
    edge('e_anat_32', 'anat_atropos_n4_refine', 'anat_refined_apply_mask', 'output_image', 'in_file'),

    // Stage 7: T2w
    edge('e_anat_33', 'anat_denoise_t2w', 'anat_n4_t2w', 'output_image', 'input_image'),
    edge('e_anat_34', 'anat_n4_t2w', 'anat_robust_template_t2w', 'output_image', 'in_files'),
    edge('e_anat_35', 'anat_robust_template_t2w', 'anat_bbregister_t2w', 'out_file', 'source_file'),
    edge('e_anat_36', 'anat_recon_autorecon3', 'anat_bbregister_t2w', 'subjects_dir', 'subjects_dir'),
    edge('e_anat_37', 'anat_robust_template_t2w', 'anat_apply_t2w_to_t1w', 'out_file', 'input_image'),
    edge('e_anat_38', 'anat_bbregister_t2w', 'anat_apply_t2w_to_t1w', 'out_lta_file', 'transforms'),
    edge('e_anat_39', 'anat_robust_template_t1w', 'anat_apply_t2w_to_t1w', 'out_file', 'reference_image'),

    // Stage 8: surfaces
    edge('e_anat_40', 'anat_recon_autorecon3', 'anat_signed_dist_white', 'white_surface', 'surface'),
    edge('e_anat_41', 'anat_recon_autorecon3', 'anat_signed_dist_pial', 'pial_surface', 'surface'),
    edge('e_anat_42', 'anat_recon_autorecon3', 'anat_mris_convert_surfaces', 'surfaces', 'in_file'),
    edge('e_anat_43', 'anat_recon_autorecon3', 'anat_mris_convert_data', 'morphometrics', 'in_file'),

    // Stage 9-10: fsLR + MSM
    edge('e_anat_44', 'anat_mris_convert_surfaces', 'anat_fslr_sphere_project', 'converted', 'sphere_in'),
    edge('e_anat_45', 'anat_fslr_sphere_project', 'anat_msm_affine_regression', 'sphere_out', 'source_surface'),
    edge('e_anat_46', 'anat_msm_affine_regression', 'anat_msm_apply_affine', 'affine_transform', 'transform'),
    edge('e_anat_47', 'anat_msm_apply_affine', 'anat_msm_modify_sphere', 'out_surface', 'sphere_in'),
    edge('e_anat_48', 'anat_msm_modify_sphere', 'anat_msm_metric_invert', 'modified_surface', 'metric_surface'),
    edge('e_anat_49', 'anat_msm_metric_invert', 'anat_msm_run', 'output_metric', 'subject_data'),

    // Stage 11: cortex masks
    edge('e_anat_50', 'anat_mris_convert_data', 'anat_cortex_thickness_abs', 'converted', 'metric_in'),
    edge('e_anat_51', 'anat_cortex_thickness_abs', 'anat_cortex_metric_bin', 'output_metric', 'metric_in'),
    edge('e_anat_52', 'anat_cortex_metric_bin', 'anat_cortex_fill_holes', 'output_metric', 'metric_in'),
    edge('e_anat_53', 'anat_cortex_fill_holes', 'anat_cortex_remove_islands', 'output_metric', 'metric_in'),

    // Stages 12-14: CIFTI grayordinates
    edge('e_anat_54', 'anat_mris_convert_data', 'anat_hcp_metric_dilate', 'converted', 'metric_in'),
    edge('e_anat_55', 'anat_hcp_metric_dilate', 'anat_resample_surfaces', 'output_metric', 'surface_in'),
    edge('e_anat_56', 'anat_resample_surfaces', 'anat_metric_resample_grayords', 'resampled', 'metric_in'),
    edge('e_anat_57', 'anat_metric_resample_grayords', 'anat_metric_mask_grayords', 'output_metric', 'metric_in'),
    edge('e_anat_58', 'anat_metric_mask_grayords', 'anat_cifti_dscalar', 'output_metric', 'left_metric'),
];

const BOLD_EDGES = [
    // BOLD fit: HMC → STC
    edge('e_bold_1', 'bold_mcflirt', 'bold_tshift', 'out_file', 'in_file'),

    // SDC dispatch (all three branches feed into coeff2epi)
    edge('e_bold_2', 'bold_topup', 'bold_coeff2epi', 'out_field', 'moving_image'),
    edge('e_bold_3', 'bold_prelude', 'bold_coeff2epi', 'unwrapped_phase_file', 'moving_image'),
    edge('e_bold_4', 'bold_syn_register', 'bold_coeff2epi', 'forward_warp_field', 'moving_image'),

    // Skull-strip chain: N4 → BET → Unifize → Automask → mask intersect
    edge('e_bold_5', 'bold_mcflirt', 'bold_n4', 'out_file', 'input_image'),
    edge('e_bold_6', 'bold_n4', 'bold_bet', 'output_image', 'in_file'),
    edge('e_bold_7', 'bold_bet', 'bold_unifize', 'out_file', 'in_file'),
    edge('e_bold_8', 'bold_unifize', 'bold_automask', 'out_file', 'in_file'),
    edge('e_bold_9', 'bold_bet', 'bold_mask_intersect', 'mask_file', 'in_file'),
    edge('e_bold_10', 'bold_automask', 'bold_mask_intersect', 'out_file', 'operand_file'),

    // Coreg: mri_coreg → bbregister (FS path)
    edge('e_bold_11', 'bold_mask_intersect', 'bold_mri_coreg', 'out_file', 'source_file'),
    edge('e_bold_12', 'bold_mri_coreg', 'bold_bbregister', 'out_reg_file', 'init_reg_file'),

    // FSL BBR path (when freesurfer off)
    edge('e_bold_13', 'bold_mask_intersect', 'bold_flirt_bbr', 'out_file', 'in_file'),
    edge('e_bold_14', 'bold_flirt_bbr', 'bold_lta_convert', 'out_matrix_file', 'in_fsl'),

    // Confounds: apply T1w transforms to mask BOLD
    edge('e_bold_15', 'bold_bbregister', 'bold_confounds_apply_xfm', 'out_lta_file', 'transforms'),
    edge('e_bold_16', 'bold_tshift', 'bold_confounds_apply_xfm', 'out_file', 'reference_image'),

    // Surface sampling (FS)
    edge('e_bold_17', 'bold_tshift', 'bold_vol2surf', 'out_file', 'source_file'),
    edge('e_bold_18', 'bold_bbregister', 'bold_vol2surf', 'out_lta_file', 'reg_file'),

    // Goodvoxels chain
    edge('e_bold_19', 'bold_tshift', 'bold_goodvoxels_tstd', 'out_file', 'in_file'),
    edge('e_bold_20', 'bold_tshift', 'bold_goodvoxels_tmean', 'out_file', 'in_file'),
    edge('e_bold_21', 'bold_goodvoxels_tstd', 'bold_goodvoxels_stats', 'out_file', 'in_file'),

    // CIFTI sampling
    edge('e_bold_22', 'bold_tshift', 'bold_vol_to_surf_wb', 'out_file', 'volume_file'),
    edge('e_bold_23', 'bold_vol_to_surf_wb', 'bold_metric_dilate', 'metric_out', 'metric_in'),
    edge('e_bold_24', 'bold_metric_dilate', 'bold_metric_resample', 'output_metric', 'metric_in'),
    edge('e_bold_25', 'bold_metric_resample', 'bold_metric_mask', 'output_metric', 'metric_in'),
];

// Cross-workflow edges (anatomical → BOLD)
const CROSS_EDGES = [
    edge('e_cross_1', 'anat_register_template', 'bold_confounds_apply_xfm', 'composite_transform', 'transforms'),
    edge('e_cross_2', 'anat_atropos_n4_refine', 'bold_confounds_apply_xfm', 'output_image', 'reference_image'),
    edge('e_cross_3', 'anat_recon_autorecon3', 'bold_bbregister', 'subjects_dir', 'subjects_dir'),
    edge('e_cross_4', 'anat_recon_autorecon3', 'bold_mri_coreg', 'subjects_dir', 'subjects_dir'),
    edge('e_cross_5', 'anat_recon_autorecon3', 'bold_vol2surf', 'subjects_dir', 'subjects_dir'),
];

const ALL_EDGES = [...ANAT_EDGES, ...BOLD_EDGES, ...CROSS_EDGES];

/* ── Public export ─────────────────────────────────────────────────── */

export const FMRIPREP_PIPELINE = {
    id: 'fmriprep',
    name: 'fMRIPrep',
    version: '24.x',
    description: 'Robust fMRI preprocessing pipeline (sMRIPrep + SDCFlows + fMRIPrep BOLD)',
    docUrl: 'https://fmriprep.org/en/stable/workflows.html',
    citation: 'Esteban O et al., Nat Methods (2019)',
    options: OPTIONS,
    nodes: ALL_NODES,
    edges: ALL_EDGES,
    // Boundary nodes are looked up by ID (not label) because labels are CWL tool
    // names and can repeat across stages (e.g. multiple antsRegistration calls).
    boundaryNodes: {
        firstNonDummy: 'anat_denoise_t1w',
        lastNonDummy: 'bold_confounds_apply_xfm',
    },
};
