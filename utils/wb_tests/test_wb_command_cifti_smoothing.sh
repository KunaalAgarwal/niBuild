#!/usr/bin/env bash
# Test: wb_command -cifti-smoothing (Smooth CIFTI on Surfaces and Volumes)
# Depends on: cifti_create_dense_timeseries output
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="wb_command_cifti_smoothing"
LIB="connectome_workbench"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_wb_data

# ── Ensure CIFTI input exists ─────────────────────────────────
CIFTI_PATH=""
if [[ -f "${DERIVED_DIR}/cifti_dtseries_path.txt" ]]; then
  CIFTI_PATH="$(cat "${DERIVED_DIR}/cifti_dtseries_path.txt")"
fi
if [[ -z "$CIFTI_PATH" || ! -f "$CIFTI_PATH" ]]; then
  echo "Running cifti_create_dense_timeseries first..."
  bash "${SCRIPT_DIR}/test_wb_command_cifti_create_dense_timeseries.sh"
  if [[ -f "${DERIVED_DIR}/cifti_dtseries_path.txt" ]]; then
    CIFTI_PATH="$(cat "${DERIVED_DIR}/cifti_dtseries_path.txt")"
  fi
fi
if [[ -z "$CIFTI_PATH" || ! -f "$CIFTI_PATH" ]]; then
  echo "  SKIP: No CIFTI input available"
  echo -e "${TOOL}\tSKIP" >>"$SUMMARY_FILE"
  exit 0
fi

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
cifti_in:
  class: File
  path: ${CIFTI_PATH}
surface_kernel: 2.0
volume_kernel: 2.0
direction: COLUMN
cifti_out: smoothed.dtseries.nii
fwhm: true
left_surface:
  class: File
  path: ${WB_SPHERE_L}
right_surface:
  class: File
  path: ${WB_SPHERE_R}
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/smoothed.dtseries*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  OK: $(basename "$f") ($(wc -c < "$f") bytes)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no smoothed CIFTI output found"
fi
