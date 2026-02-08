# Structural MRI CWL Test Suite

Individual CWL test scripts for 37 structural MRI tools across FSL, ANTs, FreeSurfer, and AFNI, plus a standalone recon-all test.

## Prerequisites

| Dependency | Install |
|-----------|---------|
| `cwltool` | `pip install cwltool` |
| `python3` | System package manager |
| `docker` | [docs.docker.com](https://docs.docker.com/get-docker/) |

Docker images are pulled automatically on first run:
- `brainlife/fsl:latest`
- `fnndsc/ants:latest`
- `freesurfer/freesurfer:7.4.1`
- `brainlife/afni:latest`

### FreeSurfer License

FreeSurfer tools require a license file. Either:
- Set `FS_LICENSE=/path/to/license.txt`, or
- Place `license.txt` at `tests/data/freesurfer/license.txt`

### Test Data

- **FSL / ANTs / AFNI**: MNI152 templates are copied from Docker containers automatically (no downloads needed).
- **FreeSurfer**: The pre-reconstructed `bert` subject is downloaded via `utils/download_freesurfer_test_data.sh` on first run.

## Running Tests

### Run all 37 tests

```bash
bash utils/structural_mri_tests/run_all.sh
```

### Run a single tool test

```bash
bash utils/structural_mri_tests/test_bet.sh
```

Scripts with dependencies (e.g. `test_fast.sh` needs `bet` output) will automatically run their prerequisites if the required output files are missing.

### Re-run previously passed tests

```bash
bash utils/structural_mri_tests/run_all.sh --rerun-passed
```

## What Each Script Does

1. Sources `_common.sh` (shared functions and data prep)
2. Generates a YAML template via `cwltool --make-template` (saved to `jobs/<tool>_template.yml`)
3. Writes a job YAML with concrete parameter values (saved to `jobs/<tool>.yml`)
4. Validates the CWL file (`cwltool --validate`)
5. Runs the tool (`cwltool --outdir`)
6. Verifies that expected output files exist and are non-empty

## Output Structure

All runtime artifacts are gitignored:

```
utils/structural_mri_tests/
├── jobs/           # Generated YAML files (templates + job inputs)
├── out/<tool>/     # Tool outputs + outputs.json per tool
├── logs/<tool>.log # cwltool stderr per tool
├── data/           # Test data copied from containers
├── derived/        # Intermediate files (masks, downsampled images, priors)
└── summary.tsv     # PASS/FAIL/SKIP results table
```

## Tools Covered

| # | Library | Script | Tool |
|---|---------|--------|------|
| 1 | FSL | `test_bet.sh` | bet |
| 2 | FSL | `test_fast.sh` | fast |
| 3 | FSL | `test_flirt.sh` | flirt |
| 4 | FSL | `test_fnirt.sh` | fnirt |
| 5 | FSL | `test_run_first_all.sh` | run_first_all |
| 6 | FSL | `test_fsl_anat.sh` | fsl_anat |
| 7 | FSL | `test_siena.sh` | siena |
| 8 | FSL | `test_sienax.sh` | sienax |
| 9 | ANTs | `test_antsBrainExtraction.sh` | antsBrainExtraction.sh |
| 10 | ANTs | `test_Atropos.sh` | Atropos |
| 11 | ANTs | `test_antsAtroposN4.sh` | antsAtroposN4.sh |
| 12 | ANTs | `test_antsRegistration.sh` | antsRegistration |
| 13 | ANTs | `test_antsRegistrationSyN.sh` | antsRegistrationSyN.sh |
| 14 | ANTs | `test_antsRegistrationSyNQuick.sh` | antsRegistrationSyNQuick.sh |
| 15 | ANTs | `test_antsCorticalThickness.sh` | antsCorticalThickness.sh |
| 16 | ANTs | `test_KellyKapowski.sh` | KellyKapowski |
| 17 | FreeSurfer | `test_mri_convert.sh` | mri_convert |
| 18 | FreeSurfer | `test_mri_watershed.sh` | mri_watershed |
| 19 | FreeSurfer | `test_mri_normalize.sh` | mri_normalize |
| 20 | FreeSurfer | `test_mri_segment.sh` | mri_segment |
| 21 | FreeSurfer | `test_mris_inflate.sh` | mris_inflate |
| 22 | FreeSurfer | `test_mris_sphere.sh` | mris_sphere |
| 23 | FreeSurfer | `test_mri_aparc2aseg.sh` | mri_aparc2aseg |
| 24 | FreeSurfer | `test_mri_annotation2label.sh` | mri_annotation2label |
| 25 | FreeSurfer | `test_mris_ca_label.sh` | mris_ca_label |
| 26 | FreeSurfer | `test_mri_label2vol.sh` | mri_label2vol |
| 27 | FreeSurfer | `test_mris_anatomical_stats.sh` | mris_anatomical_stats |
| 28 | FreeSurfer | `test_mri_segstats.sh` | mri_segstats |
| 29 | FreeSurfer | `test_aparcstats2table.sh` | aparcstats2table |
| 30 | FreeSurfer | `test_asegstats2table.sh` | asegstats2table |
| 31 | AFNI | `test_3dSkullStrip.sh` | 3dSkullStrip |
| 32 | AFNI | `test_SSwarper.sh` | @SSwarper |
| 33 | AFNI | `test_3dUnifize.sh` | 3dUnifize |
| 34 | AFNI | `test_3dAllineate.sh` | 3dAllineate |
| 35 | AFNI | `test_3dQwarp.sh` | 3dQwarp |
| 36 | AFNI | `test_auto_tlrc.sh` | auto_tlrc |
| 37 | FSL | `test_bianca.sh` | bianca |

## Standalone Tests (Not in run_all.sh)

### recon-all

The FreeSurfer `recon-all` pipeline (full cortical reconstruction) takes 6-24 hours to complete and is therefore **not included in `run_all.sh`**. Run it separately:

```bash
bash utils/structural_mri_tests/test_recon-all.sh
```

This runs the full `recon-all -all` pipeline (autorecon1 + autorecon2 + autorecon3) on MNI152 2mm data. It requires:
- A valid FreeSurfer license (set `FS_LICENSE` or place at `tests/data/freesurfer/license.txt`)
- Sufficient disk space (~1GB per subject)
- Patience (6-24 hours depending on hardware)

The test verifies that the subject output directory is created with expected subdirectories (`mri/`, `surf/`, `label/`, `stats/`).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FSL_DOCKER_IMAGE` | `brainlife/fsl:latest` | FSL Docker image |
| `ANTS_DOCKER_IMAGE` | `fnndsc/ants:latest` | ANTs Docker image |
| `FREESURFER_DOCKER_IMAGE` | `freesurfer/freesurfer:7.4.1` | FreeSurfer Docker image |
| `AFNI_DOCKER_IMAGE` | `brainlife/afni:latest` | AFNI Docker image |
| `DOCKER_PLATFORM` | *(empty)* | Docker platform override (e.g. `linux/amd64`) |
| `FS_LICENSE` | *(empty)* | Path to FreeSurfer license file |
| `ANTS_TEST_RES_MM` | `6` | ANTs test image resolution in mm |
| `ANTS_NUM_THREADS` | `1` | ANTs thread count |
| `CWLTOOL_BIN` | `cwltool` | Path to cwltool binary |
