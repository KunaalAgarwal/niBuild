#!/usr/bin/env bash
# Test: wb_command -metric-smoothing (Geodesic Gaussian Surface Smoothing)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="wb_command_metric_smoothing"
LIB="connectome_workbench"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_wb_data

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
surface:
  class: File
  path: ${WB_SPHERE_L}
metric_in:
  class: File
  path: ${WB_METRIC_L}
smoothing_kernel: 2.0
metric_out: smoothed.func.gii
fwhm: true
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/smoothed*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  OK: $(basename "$f") ($(wc -c < "$f") bytes)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no smoothed metric output found"
fi
