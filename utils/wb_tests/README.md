# Connectome Workbench CWL Test Suite

Individual CWL test scripts for 5 Connectome Workbench (`wb_command`) tools.

## Prerequisites

| Dependency | Install |
|-----------|---------|
| `cwltool` | `pip install cwltool` |
| `python3` + `nibabel` | `pip install nibabel` |
| `docker` | [docs.docker.com](https://docs.docker.com/get-docker/) |

Docker images are pulled automatically on first run:
- `khanlab/connectome-workbench:latest`

## Test Data

Synthetic test data is generated automatically on first run:
- **Sphere surfaces**: 642-vertex icospheres (`.surf.gii`) for left and right hemispheres
- **Metric file**: Random vertex data (`.func.gii`) for smoothing tests
- **Volume data**: Tiny 10x10x10 NIfTI volumes for CIFTI volume operations
- **Label volume**: Integer structure labels for CIFTI creation

No manual downloads are required.

## Running Tests

### Run all 5 tests

```bash
bash utils/wb_tests/run_all.sh
```

### Run a single tool test

```bash
bash utils/wb_tests/test_wb_command_metric_smoothing.sh
```

### Re-run previously passed tests

```bash
bash utils/wb_tests/run_all.sh --rerun-passed
```

## Tool Dependency Graph

```
Phase 1 (independent):
  wb_command_metric_smoothing
  wb_command_surface_sphere_project_unproject
  wb_command_cifti_create_dense_timeseries ──┐
                                             │
Phase 2 (needs CIFTI):                       │
  wb_command_cifti_separate ─────────────────┘
  wb_command_cifti_smoothing ────────────────┘
```

Phase 2 tests depend on CIFTI output from `cifti_create_dense_timeseries` and will run that test automatically if needed.

## What Each Script Does

1. Sources `_common.sh` (shared functions, data prep, Docker helpers)
2. Generates a YAML template via `cwltool --make-template`
3. Writes a job YAML with concrete parameter values
4. Validates the CWL file (`cwltool --validate`)
5. Runs the tool (`cwltool --outdir`)
6. Verifies that expected output files exist and are non-empty

## Output Structure

All runtime artifacts are gitignored:

```
utils/wb_tests/
├── jobs/           # Generated YAML files (templates + job inputs)
├── out/<tool>/     # Tool outputs + outputs.json per tool
├── logs/<tool>.log # cwltool stderr per tool
├── data/           # Test data (if any)
├── derived/        # Synthetic surfaces, metrics, volumes
└── summary.tsv     # PASS/FAIL/SKIP results table
```

## Tools Covered

| # | Script | Tool |
|---|--------|------|
| 1 | `test_wb_command_metric_smoothing.sh` | wb_command -metric-smoothing |
| 2 | `test_wb_command_surface_sphere_project_unproject.sh` | wb_command -surface-sphere-project-unproject |
| 3 | `test_wb_command_cifti_create_dense_timeseries.sh` | wb_command -cifti-create-dense-timeseries |
| 4 | `test_wb_command_cifti_separate.sh` | wb_command -cifti-separate |
| 5 | `test_wb_command_cifti_smoothing.sh` | wb_command -cifti-smoothing |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WB_DOCKER_IMAGE` | `khanlab/connectome-workbench:latest` | Workbench Docker image |
| `DOCKER_PLATFORM` | *(empty)* | Docker platform override |
| `CWLTOOL_BIN` | `cwltool` | Path to cwltool binary |
