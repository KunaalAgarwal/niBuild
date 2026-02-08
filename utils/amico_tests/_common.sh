#!/usr/bin/env bash
# Shared infrastructure for AMICO CWL test scripts.
# Source this file at the top of every test_*.sh script.

# Chain to the structural MRI common infrastructure
source "$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}"}")/../structural_mri_tests" && pwd)/_common.sh"

# Docker image
AMICO_IMAGE="${AMICO_DOCKER_IMAGE:-cookpa/amico-noddi:latest}"

docker_amico() {
  _docker_run "$AMICO_IMAGE" "$@"
}

# ── Synthetic multi-shell DWI data generation ──────────────────

prepare_amico_data() {
  local amico_data="${DERIVED_DIR}"
  local dwi="${amico_data}/dwi.nii.gz"
  local bvals="${amico_data}/dwi.bval"
  local bvecs="${amico_data}/dwi.bvec"
  local mask="${amico_data}/mask.nii.gz"

  if [[ -f "$dwi" && -f "$bvals" && -f "$bvecs" && -f "$mask" ]]; then
    AMICO_DWI="$dwi"
    AMICO_BVALS="$bvals"
    AMICO_BVECS="$bvecs"
    AMICO_MASK="$mask"
    return 0
  fi

  echo "Generating synthetic multi-shell DWI data for AMICO..."

  python3 - "$amico_data" <<'PY'
import sys
import os
import numpy as np

outdir = sys.argv[1]
os.makedirs(outdir, exist_ok=True)

# Volume dimensions: 16x16x8, 35 directions
# b-values: 5x b=0, 15x b=1000, 15x b=2000
nx, ny, nz = 16, 16, 8
nb0, nb1, nb2 = 5, 15, 15
nvols = nb0 + nb1 + nb2

# Generate b-values
bvals = [0]*nb0 + [1000]*nb1 + [2000]*nb2

# Generate b-vectors (zero for b=0, random unit vectors for others)
bvecs = np.zeros((3, nvols))
for i in range(nb0, nvols):
    v = np.random.randn(3)
    v /= np.linalg.norm(v)
    bvecs[:, i] = v

# Generate DWI signal: S = S0 * exp(-b * D)
D = 0.001  # diffusion coefficient
S0 = 1000.0
data = np.zeros((nx, ny, nz, nvols), dtype=np.float32)
for v in range(nvols):
    signal = S0 * np.exp(-bvals[v] * D)
    # Add some spatial variation and noise
    base = np.random.normal(signal, signal * 0.05, (nx, ny, nz)).astype(np.float32)
    base = np.clip(base, 0, None)
    data[:, :, :, v] = base

# Create mask (all ones)
mask = np.ones((nx, ny, nz), dtype=np.uint8)

# Save using nibabel
try:
    import nibabel as nib
    affine = np.eye(4) * 2.0
    affine[3, 3] = 1.0

    dwi_img = nib.Nifti1Image(data, affine)
    nib.save(dwi_img, os.path.join(outdir, "dwi.nii.gz"))

    mask_img = nib.Nifti1Image(mask, affine)
    nib.save(mask_img, os.path.join(outdir, "mask.nii.gz"))

    # Save bvals (space-separated, single line)
    with open(os.path.join(outdir, "dwi.bval"), "w") as f:
        f.write(" ".join(str(b) for b in bvals) + "\n")

    # Save bvecs (3 rows)
    with open(os.path.join(outdir, "dwi.bvec"), "w") as f:
        for row in range(3):
            f.write(" ".join(f"{bvecs[row, i]:.6f}" for i in range(nvols)) + "\n")

    print(f"  Created DWI: {nx}x{ny}x{nz}x{nvols}")
    print(f"  b-values: {nb0}x b=0, {nb1}x b=1000, {nb2}x b=2000")

except ImportError:
    print("ERROR: nibabel is required for AMICO test data generation")
    sys.exit(1)
PY

  AMICO_DWI="$dwi"
  AMICO_BVALS="$bvals"
  AMICO_BVECS="$bvecs"
  AMICO_MASK="$mask"
}
