#!/usr/bin/env bash
# Test 05: Different resolution input pair (T1 6mm + T1 2mm as cross-modal stand-in)
# Validates the tool handles inputs with mismatched voxel grids.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="antsIntermodalityIntrasubject"
NAME="${TOOL}_diff_modality"
LIB="ants"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"
PREFIX="test_diffmod_"

prepare_mm_data

# Generate template for reference
make_template "$CWL" "$TOOL"

# Create job YAML — use T1_2mm (different resolution) as input modality
cat > "${JOB_DIR}/${NAME}.yml" <<EOF
dimensionality: 3
input_image:
  class: File
  path: "${MM_T1_2MM}"
reference_image:
  class: File
  path: "${MM_T1}"
output_prefix: "${PREFIX}"
transform_type: "1"
brain_mask:
  class: File
  path: "${MM_MASK}"
EOF

run_tool "$NAME" "${JOB_DIR}/${NAME}.yml" "$CWL"

# Extra checks
TOOL_OUT="${OUT_DIR}/${NAME}"
if [[ -d "$TOOL_OUT" ]]; then
  echo "  Extra checks:"
  check_nonempty "${TOOL_OUT}/${PREFIX}anatomical.nii.gz" "warped_image" || true
  check_nonempty "${TOOL_OUT}/${PREFIX}0GenericAffine.mat" "affine_transform" || true
  check_nifti_header "${TOOL_OUT}/${PREFIX}anatomical.nii.gz" "warped_image" || true
fi
