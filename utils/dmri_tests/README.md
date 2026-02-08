# dMRI CWL Tool Tests

Validation tests for all 19 diffusion MRI CWL tool definitions across FSL, MRtrix3, and FreeSurfer.

## Prerequisites

- **cwltool** - CWL runner (`pip install cwltool`)
- **python3** + **nibabel** (`pip install nibabel`)
- **docker** - Required for containerized tool execution

## Setup

Generate synthetic test data before running any tests:

```bash
bash setup_test_data.sh
```

This creates `test_data/` containing:
- `dwi.nii.gz` / `dwi.bval` / `dwi.bvec` - Synthetic 4D DWI (32x32x16, 33 volumes)
- `dwi.mif` - Same DWI in MRtrix MIF format with embedded gradients
- `mask.nii.gz` - Binary brain mask
- `acqparams.txt` / `index.txt` - Acquisition parameters for eddy
- `b0_pair.nii.gz` / `topup_acqparams.txt` - Reversed phase-encode pair for topup
- `fa_sub01.nii.gz` / `fa_sub02.nii.gz` - Synthetic FA maps for TBSS
- `bedpostx_input/` - Directory structured for bedpostx
- `wm_response.txt` / `gm_response.txt` / `csf_response.txt` - Response functions for dwi2fod
- `parcellation.nii.gz` - 4-region atlas for tck2connectome
- `freesurfer_subjects/` / `fs_license.txt` - Minimal FreeSurfer environment for dmri_postreg

## Running Tests

### Run a single tool test

```bash
bash test_dtifit.sh
```

### Run all standalone tools (no dependencies)

```bash
for script in test_eddy.sh test_dtifit.sh test_topup.sh test_dwidenoise.sh test_mrdegibbs.sh; do
    bash "$script"
done
```

### Run MRtrix3 pipeline in order

```bash
bash test_dwi2tensor.sh      # standalone
bash test_tensor2metric.sh    # depends on dwi2tensor
bash test_dwi2fod.sh          # standalone
bash test_tckgen.sh           # depends on dwi2fod
bash test_tcksift.sh          # depends on tckgen + dwi2fod
bash test_tck2connectome.sh   # depends on tckgen
```

### Run TBSS pipeline in order

```bash
bash test_tbss_1_preproc.sh   # standalone
bash test_tbss_2_reg.sh       # depends on tbss_1
bash test_tbss_3_postreg.sh   # depends on tbss_2
bash test_tbss_4_prestats.sh  # depends on tbss_3
bash test_tbss_non_FA.sh      # depends on tbss_4 (projects non-FA data onto skeleton)
```

### Run FSL diffusion pipeline in order

```bash
bash test_topup.sh            # standalone
bash test_eddy.sh             # standalone
bash test_dtifit.sh           # standalone
bash test_bedpostx.sh         # standalone (SLOW)
bash test_probtrackx2.sh      # depends on bedpostx
```

## Tool Dependency Graph

```
FSL Diffusion:
  topup ─────────┐
  eddy ──────────┤ (independent)
  dtifit ────────┘
  bedpostx ──────> probtrackx2

FSL TBSS:
  tbss_1_preproc > tbss_2_reg > tbss_3_postreg > tbss_4_prestats > tbss_non_FA

MRtrix3:
  dwidenoise ────┐
  mrdegibbs ─────┤ (independent)
  dwi2tensor ────> tensor2metric
  dwi2fod ───────> tckgen ──> tcksift
                       └─────> tck2connectome

FreeSurfer:
  dmri_postreg (standalone)
```

Scripts that depend on other tools will automatically run their prerequisites if the intermediate outputs are not found.

## What Each Test Does

Every test script follows this sequence:

1. **CWL Validation** - `cwltool --validate` checks the CWL syntax
2. **Template Generation** - `cwltool --make-template` generates a YAML template (saved for reference)
3. **Job Creation** - A filled-in job YAML is created with paths to test data
4. **Tool Execution** - `cwltool --outdir` runs the tool via Docker
5. **Output Existence** - Checks that all expected output files were produced
6. **Non-null Check** - Verifies output files have size > 0
7. **Header Check** - Reads NIfTI headers (nibabel) or MIF headers (mrinfo) to confirm validity

## Output Structure

All outputs are saved to `outputs/` (gitignored):

```
outputs/
├── <tool_name>/
│   ├── results.txt       # Test results log
│   ├── template.yml      # CWL-generated input template
│   ├── job.yml           # Filled-in job file used for the run
│   └── <tool outputs>    # Actual tool output files
└── intermediates/        # Shared outputs for pipeline dependencies
    ├── tensor.mif
    ├── wm_fod.mif
    ├── tracks.tck
    └── tbss_FA_step*/
```

## Notes

- **bedpostx** is computationally intensive and may take a very long time on synthetic data. Consider running it separately or with reduced parameters.
- **dmri_postreg** requires a valid FreeSurfer license. The dummy license in test data may cause the tool to fail; replace `fs_license.txt` with a real license if available.
- **MRtrix3 tools** that need gradient information (dwi2tensor, dwi2fod) require the `.mif` input created by `setup_test_data.sh` via Docker. If Docker was unavailable during setup, these tests will fail.
- Test data and outputs are excluded from version control via `.gitignore`.
