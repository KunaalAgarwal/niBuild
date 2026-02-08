#!/usr/bin/env bash
# Shared infrastructure for Connectome Workbench CWL test scripts.
# Source this file at the top of every test_*.sh script.

# Chain to the structural MRI common infrastructure
source "$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}")")/../structural_mri_tests" && pwd)/_common.sh"

# Docker image
WB_IMAGE="${WB_DOCKER_IMAGE:-khanlab/connectome-workbench:latest}"

docker_wb() {
  _docker_run "$WB_IMAGE" "$@"
}

# ── Synthetic data generation ──────────────────────────────────

prepare_wb_data() {
  local wb_data="${DERIVED_DIR}"
  local sphere_l="${wb_data}/sphere.L.surf.gii"
  local sphere_r="${wb_data}/sphere.R.surf.gii"
  local metric_l="${wb_data}/random_metric.L.func.gii"
  local label_vol="${wb_data}/label_vol.nii.gz"
  local tiny_vol="${wb_data}/tiny_vol.nii.gz"

  # Create sphere surface (642 vertices = icosahedron subdivision 3)
  if [[ ! -f "$sphere_l" ]]; then
    echo "Creating synthetic sphere surface..."
    docker_wb wb_command -surface-create-sphere 642 "$sphere_l"
  fi

  # Copy for right hemisphere
  if [[ ! -f "$sphere_r" ]]; then
    cp "$sphere_l" "$sphere_r"
  fi

  # Create random metric file using Python + nibabel
  if [[ ! -f "$metric_l" ]]; then
    echo "Creating synthetic metric file..."
    python3 - "$metric_l" <<'PY'
import sys
import numpy as np
try:
    import nibabel as nib
    coords = np.zeros((642, 3), dtype=np.float32)
    data = np.random.rand(642).astype(np.float32)
    darray = nib.gifti.GiftiDataArray(data, intent='NIFTI_INTENT_SHAPE',
                                       datatype='NIFTI_TYPE_FLOAT32')
    gii = nib.gifti.GiftiImage(darrays=[darray])
    nib.save(gii, sys.argv[1])
    print("  Created metric file with 642 vertices")
except ImportError:
    # Fallback: create metric via wb_command
    print("  nibabel not available; will create metric via wb_command")
    sys.exit(1)
PY
    if [[ $? -ne 0 ]]; then
      # Fallback: create a metric from the sphere using wb_command
      docker_wb wb_command -surface-coordinates-to-metric "$sphere_l" "$metric_l"
    fi
  fi

  # Create tiny NIfTI volume (10x10x10) for CIFTI volume operations
  if [[ ! -f "$tiny_vol" ]]; then
    echo "Creating tiny NIfTI volume..."
    python3 - "$tiny_vol" <<'PY'
import sys
import numpy as np
try:
    import nibabel as nib
    data = np.random.rand(10, 10, 10, 3).astype(np.float32)
    affine = np.eye(4) * 2.0
    affine[3, 3] = 1.0
    img = nib.Nifti1Image(data, affine)
    nib.save(img, sys.argv[1])
    print("  Created 10x10x10x3 volume")
except ImportError:
    print("  nibabel not available")
    sys.exit(1)
PY
  fi

  # Create label volume (integer labels for CIFTI structure identification)
  if [[ ! -f "$label_vol" ]]; then
    echo "Creating label volume..."
    python3 - "$label_vol" <<'PY'
import sys
import numpy as np
try:
    import nibabel as nib
    # Label volume: all voxels labeled as CIFTI_STRUCTURE_OTHER (value 1)
    data = np.ones((10, 10, 10), dtype=np.int16)
    affine = np.eye(4) * 2.0
    affine[3, 3] = 1.0
    img = nib.Nifti1Image(data, affine)
    nib.save(img, sys.argv[1])
    print("  Created 10x10x10 label volume")
except ImportError:
    print("  nibabel not available")
    sys.exit(1)
PY
  fi

  # Export paths
  WB_SPHERE_L="$sphere_l"
  WB_SPHERE_R="$sphere_r"
  WB_METRIC_L="$metric_l"
  WB_TINY_VOL="$tiny_vol"
  WB_LABEL_VOL="$label_vol"
}
