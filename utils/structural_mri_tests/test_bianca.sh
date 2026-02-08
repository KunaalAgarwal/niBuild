#!/usr/bin/env bash
# Test: FSL BIANCA (Brain Intensity AbNormality Classification Algorithm)
# Uses synthetic training data (thresholded MNI152 as pseudo-lesion mask)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="bianca"
LIB="fsl"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_fsl_data

# ── Data prep: create synthetic training data ─────────────────
SYNTH_LESION="${DERIVED_DIR}/synth_lesion_mask.nii.gz"
IDENTITY_MAT="${DERIVED_DIR}/identity.mat"
MASTERFILE="${DERIVED_DIR}/bianca_masterfile.txt"

# Create synthetic lesion mask by thresholding the brain image high
if [[ ! -f "$SYNTH_LESION" ]]; then
  echo "Creating synthetic lesion mask..."
  docker_fsl fslmaths "$T1W_2MM_BRAIN" -thr 8000 -bin "$SYNTH_LESION"
fi

# Create identity transformation matrix
if [[ ! -f "$IDENTITY_MAT" ]]; then
  printf "1 0 0 0\n0 1 0 0\n0 0 1 0\n0 0 0 1\n" > "$IDENTITY_MAT"
fi

# Create master file: each line is space-separated paths
# Format: T1_image brain_mask lesion_mask transformation_matrix
if [[ ! -f "$MASTERFILE" ]]; then
  echo "${T1W_2MM} ${T1W_2MM_BRAIN} ${SYNTH_LESION} ${IDENTITY_MAT}" > "$MASTERFILE"
fi

# ── Run BIANCA CWL ───────────────────────────────────────────
make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
singlefile:
  class: File
  path: ${MASTERFILE}
querysubjectnum: 1
brainmaskfeaturenum: 2
labelfeaturenum: 3
trainingnums: all
output_name: bianca_output
matfeaturenum: 4
featuresubset: "1,2"
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/bianca_output*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  Header: $(docker_fsl fslhd "$f" 2>&1 | grep -E '^dim[1-4]' || true)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no output WMH map files found"
fi
