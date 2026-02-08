#!/usr/bin/env bash
# Test: wb_command -surface-sphere-project-unproject (Spherical Registration)
# Uses the same sphere for all 3 inputs (identity transform)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="wb_command_surface_sphere_project_unproject"
LIB="connectome_workbench"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_wb_data

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
sphere_in:
  class: File
  path: ${WB_SPHERE_L}
sphere_project_to:
  class: File
  path: ${WB_SPHERE_L}
sphere_unproject_from:
  class: File
  path: ${WB_SPHERE_L}
sphere_out: output_sphere.surf.gii
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/output_sphere*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  OK: $(basename "$f") ($(wc -c < "$f") bytes)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no output sphere found"
fi
