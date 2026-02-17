#!/usr/bin/env bash
# Test: FSL run_first_all (FIRST — Subcortical Structure Segmentation)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="run_first_all"
LIB="fsl"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

prepare_fsl_data

# Generate template for reference
make_template "$CWL" "$TOOL"

# Use brain-extracted 2mm T1 with -b flag so FIRST skips its internal BET.
# Segment only L_Hipp to keep runtime manageable (~5 min vs ~30 min for all).
# Note: MNI152 is a template average, so segmentation quality is not
# meaningful — this test verifies the CWL wiring produces output files.
FIRST_INPUT="$T1W_2MM_BRAIN"
if [[ ! -f "$FIRST_INPUT" ]]; then
  echo "Brain-extracted 2mm T1 not found, running BET..."
  docker_fsl bet "$T1W_2MM" "${DERIVED_DIR}/bet_2mm_out" -R
  FIRST_INPUT="${DERIVED_DIR}/bet_2mm_out.nii.gz"
fi
[[ -f "$FIRST_INPUT" ]] || die "Missing brain-extracted input for run_first_all"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
input:
  class: File
  path: "${FIRST_INPUT}"
output: "first_out"
brain_extracted: true
structures: "L_Hipp"
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"
