#!/usr/bin/env bash
# Test: AMICO NODDI (Neurite Orientation Dispersion and Density Imaging)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="amico_noddi"
LIB="amico"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_amico_data

make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
dwi:
  class: File
  path: ${AMICO_DWI}
bvals:
  class: File
  path: ${AMICO_BVALS}
bvecs:
  class: File
  path: ${AMICO_BVECS}
mask:
  class: File
  path: ${AMICO_MASK}
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
expected_outputs=("FIT_ICVF.nii.gz" "FIT_OD.nii.gz" "FIT_ISOVF.nii.gz")

for expected in "${expected_outputs[@]}"; do
  # Check in both AMICO/NODDI/ subdirectory and top-level
  found_file=""
  for candidate in "${dir}/AMICO/NODDI/${expected}" "${dir}/${expected}"; do
    if [[ -f "$candidate" ]]; then
      found_file="$candidate"
      break
    fi
  done

  if [[ -n "$found_file" ]]; then
    if [[ ! -s "$found_file" ]]; then
      echo "  FAIL: zero-byte output: $found_file"; exit 1
    fi
    echo "  OK: ${expected} ($(wc -c < "$found_file") bytes)"
  else
    echo "  WARN: ${expected} not found"
  fi
done
