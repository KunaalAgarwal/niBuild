#!/usr/bin/env bash
# Test: wb_command -cifti-create-dense-timeseries (Create CIFTI from Volume Data)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="wb_command_cifti_create_dense_timeseries"
LIB="connectome_workbench"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_wb_data

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
cifti_out: test.dtseries.nii
volume_data:
  class: File
  path: ${WB_TINY_VOL}
structure_label_volume:
  class: File
  path: ${WB_LABEL_VOL}
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
CIFTI_OUT="${dir}/test.dtseries.nii"
found=0
for f in "$dir"/test.dtseries*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  OK: $(basename "$f") ($(wc -c < "$f") bytes)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no CIFTI output found"
fi

# Save CIFTI path for dependent tests
if [[ -f "$CIFTI_OUT" ]]; then
  echo "$CIFTI_OUT" > "${DERIVED_DIR}/cifti_dtseries_path.txt"
fi
