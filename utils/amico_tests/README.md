# AMICO CWL Test Suite

CWL test script for AMICO NODDI (Neurite Orientation Dispersion and Density Imaging).

## Prerequisites

| Dependency | Install |
|-----------|---------|
| `cwltool` | `pip install cwltool` |
| `python3` + `nibabel` + `numpy` | `pip install nibabel numpy` |
| `docker` | [docs.docker.com](https://docs.docker.com/get-docker/) |

Docker images are pulled automatically on first run:
- `cookpa/amico-noddi:latest`

## Test Data

Synthetic multi-shell DWI data is generated automatically on first run:
- **DWI**: 16x16x8 volume, 35 directions (5x b=0, 15x b=1000, 15x b=2000)
- **bvals/bvecs**: Matching b-value and b-vector files
- **Mask**: All-ones brain mask

No manual downloads are required. Data generation uses nibabel and numpy.

## Running Tests

```bash
bash utils/amico_tests/test_amico_noddi.sh
```

## What the Test Does

1. Sources `_common.sh` (shared functions, data prep)
2. Generates synthetic multi-shell DWI data (if not present)
3. Generates a YAML template via `cwltool --make-template`
4. Writes a job YAML with concrete parameter values
5. Validates the CWL file (`cwltool --validate`)
6. Runs AMICO NODDI via Docker (`cwltool --outdir`)
7. Verifies expected outputs: `FIT_ICVF.nii.gz`, `FIT_OD.nii.gz`, `FIT_ISOVF.nii.gz`

## Output Structure

All runtime artifacts are gitignored:

```
utils/amico_tests/
├── jobs/           # Generated YAML files (templates + job inputs)
├── out/amico_noddi/# Tool outputs + outputs.json
├── logs/           # cwltool stderr
├── derived/        # Synthetic DWI data (dwi.nii.gz, bvals, bvecs, mask)
└── summary.tsv     # PASS/FAIL results
```

## Expected Outputs

| File | Description |
|------|-------------|
| `FIT_ICVF.nii.gz` | Neurite Density Index (intracellular volume fraction) |
| `FIT_OD.nii.gz` | Orientation Dispersion Index |
| `FIT_ISOVF.nii.gz` | Isotropic Volume Fraction (CSF compartment) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AMICO_DOCKER_IMAGE` | `cookpa/amico-noddi:latest` | AMICO Docker image |
| `DOCKER_PLATFORM` | *(empty)* | Docker platform override |
| `CWLTOOL_BIN` | `cwltool` | Path to cwltool binary |
