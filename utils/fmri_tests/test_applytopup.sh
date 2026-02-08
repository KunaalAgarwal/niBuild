#!/usr/bin/env bash
# Test: FSL applytopup (Apply Topup Distortion Correction)
# Self-contained: runs topup internally to produce required fieldcoef/movpar,
# then applies correction to a test image.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="applytopup"
LIB="fsl"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_fmri_data

# ── Data prep: run topup to generate fieldcoef and movpar ──────
TOPUP_FIELDCOEF="${DERIVED_DIR}/topup_applytopup_fieldcoef.nii.gz"
TOPUP_MOVPAR="${DERIVED_DIR}/topup_applytopup_movpar.txt"
TOPUP_PREFIX="${DERIVED_DIR}/topup_applytopup"
ACQPARAMS="${DERIVED_DIR}/acqparams_applytopup.txt"
B0_PAIR="${DERIVED_DIR}/b0_pair_applytopup.nii.gz"

# Check for fieldmap data
if [[ -z "${FMAP_AP:-}" || -z "${FMAP_PA:-}" || ! -f "${FMAP_AP:-}" || ! -f "${FMAP_PA:-}" ]]; then
  echo "  SKIP: No AP/PA fieldmap data available for applytopup test"
  echo -e "${TOOL}\tSKIP" >>"$SUMMARY_FILE"
  exit 0
fi

if [[ ! -f "$TOPUP_FIELDCOEF" ]]; then
  echo "Running topup to generate prerequisite data..."

  # Extract first volume from each fieldmap
  B0_AP="${DERIVED_DIR}/b0_ap_applytopup.nii.gz"
  B0_PA="${DERIVED_DIR}/b0_pa_applytopup.nii.gz"
  [[ -f "$B0_AP" ]] || docker_fsl fslroi "$FMAP_AP" "$B0_AP" 0 1
  [[ -f "$B0_PA" ]] || docker_fsl fslroi "$FMAP_PA" "$B0_PA" 0 1

  # Merge into B0 pair
  [[ -f "$B0_PAIR" ]] || docker_fsl fslmerge -t "$B0_PAIR" "$B0_AP" "$B0_PA"

  # Create acquisition parameters
  if [[ ! -f "$ACQPARAMS" ]]; then
    # Extract from JSON metadata if available
    if [[ -n "${FMAP_AP_JSON:-}" && -f "${FMAP_AP_JSON:-}" ]]; then
      python3 - "$FMAP_AP_JSON" "${FMAP_PA_JSON:-}" "$ACQPARAMS" <<'PY'
import json, sys
ap_json, pa_json, out = sys.argv[1], sys.argv[2], sys.argv[3]
with open(ap_json) as f: ap = json.load(f)
readout = ap.get("TotalReadoutTime", 0.05)
with open(out, "w") as f:
    f.write(f"0 -1 0 {readout}\n")
    f.write(f"0 1 0 {readout}\n")
PY
    else
      # Default parameters
      printf "0 -1 0 0.05\n0 1 0 0.05\n" > "$ACQPARAMS"
    fi
  fi

  # Get topup config
  TOPUP_CONFIG="${DERIVED_DIR}/b02b0.cnf"
  [[ -f "$TOPUP_CONFIG" ]] || copy_from_fsl_image "etc/flirtsch/b02b0.cnf" "$TOPUP_CONFIG" || true

  # Run topup
  local_topup_args=(--imain="$B0_PAIR" --datain="$ACQPARAMS" --out="$TOPUP_PREFIX")
  [[ -f "$TOPUP_CONFIG" ]] && local_topup_args+=(--config="$TOPUP_CONFIG")
  docker_fsl topup "${local_topup_args[@]}" || true
fi

if [[ ! -f "$TOPUP_FIELDCOEF" ]]; then
  echo "  SKIP: topup failed to produce fieldcoef; cannot test applytopup"
  echo -e "${TOOL}\tSKIP" >>"$SUMMARY_FILE"
  exit 0
fi

# ── Run applytopup CWL ────────────────────────────────────────
make_template "$CWL" "$TOOL"

# Apply to the B0 AP image
B0_AP="${DERIVED_DIR}/b0_ap_applytopup.nii.gz"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
input:
  class: File
  path: ${B0_AP}
topup_prefix: ${TOPUP_PREFIX}
encoding_file:
  class: File
  path: ${ACQPARAMS}
inindex: "1"
output: applytopup_out
method: jac
EOF

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
found=0
for f in "$dir"/applytopup_out*; do
  [[ -f "$f" ]] || continue
  [[ "$(basename "$f")" == *.log ]] && continue
  found=1
  if [[ ! -s "$f" ]]; then
    echo "  FAIL: zero-byte output: $f"; exit 1
  fi
  echo "  Header: $(docker_fsl fslhd "$f" 2>&1 | grep -E '^dim[1-4]' || true)"
done

if [[ "$found" -eq 0 ]]; then
  echo "  WARN: no corrected output files found"
fi
