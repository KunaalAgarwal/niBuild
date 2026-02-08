#!/usr/bin/env bash
# Test: FSL robustfov (Field of View Reduction)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/../structural_mri_tests/_common.sh"

TOOL="robustfov"
LIB="fsl"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

prepare_fsl_data
make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
input:
  class: File
  path: ${T1W}
output: robustfov_out
matrix_output: robustfov_xform.mat
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/robustfov_out*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  [[ "$(basename "$f")" == *.mat ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  Header: $(docker_fsl fslhd "$f" 2>&1 | grep -E '^dim[1-4]' || true)"
done

# Verify transformation matrix
if [[ -f "${dir}/robustfov_xform.mat" ]]; then
  if [[ ! -s "${dir}/robustfov_xform.mat" ]]; then
    echo "  FAIL: zero-byte transformation matrix"; exit 1
  fi
  echo "  Matrix: $(wc -l < "${dir}/robustfov_xform.mat") lines"
else
  echo "  WARN: transformation matrix not found"
fi

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no output image files found"
fi
