#!/usr/bin/env bash
# Test: FSL PRELUDE (Phase Unwrapping)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="prelude"
LIB="fsl"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs

# ── Data prep: use MNI152 2mm brain as magnitude, create synthetic phase ──
STANDARD_BRAIN="${DERIVED_DIR}/MNI152_T1_2mm_brain.nii.gz"
SYNTH_PHASE="${DERIVED_DIR}/synth_phase.nii.gz"

if [[ ! -f "$STANDARD_BRAIN" ]]; then
  copy_from_fsl_image "data/standard/MNI152_T1_2mm_brain.nii.gz" "$STANDARD_BRAIN" || \
  copy_from_fsl_image "data/standard/MNI152_T1_2mm.nii.gz" "$STANDARD_BRAIN"
fi

if [[ ! -f "$SYNTH_PHASE" ]]; then
  echo "Creating synthetic wrapped phase image..."
  docker_fsl fslmaths "$STANDARD_BRAIN" -mul 0 -add 1.5 "$SYNTH_PHASE"
fi

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
phase:
  class: File
  path: ${SYNTH_PHASE}
output: unwrapped_phase
magnitude:
  class: File
  path: ${STANDARD_BRAIN}
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/unwrapped_phase*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  Header: $(docker_fsl fslhd "$f" 2>&1 | grep -E '^dim[1-4]' || true)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no output files found"
fi
