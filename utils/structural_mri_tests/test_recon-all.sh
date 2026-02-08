#!/usr/bin/env bash
# Test: FreeSurfer recon-all (Complete Cortical Reconstruction Pipeline)
#
# STANDALONE TEST — NOT included in run_all.sh
# Runtime: 6-24 hours depending on hardware.
#
# Usage:
#   bash utils/structural_mri_tests/test_recon-all.sh
#
# This test runs the full recon-all pipeline (autorecon1 + autorecon2 + autorecon3)
# on MNI152 2mm data. It requires a valid FreeSurfer license.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/_common.sh"

TOOL="recon-all"
LIB="freesurfer"
CWL="${CWL_DIR}/${LIB}/${TOOL}.cwl"

setup_dirs
prepare_fsl_data
prepare_freesurfer_data

CWLTOOL_ARGS+=(--no-read-only)

# ── Data prep: create empty subjects directory for new subject ──
RECON_SUBJECTS="${DERIVED_DIR}/recon_subjects"
mkdir -p "$RECON_SUBJECTS"

# ── Run recon-all CWL ────────────────────────────────────────
make_template "$CWL" "$TOOL"

cat > "${JOB_DIR}/${TOOL}.yml" <<EOF
subjects_dir:
  class: Directory
  path: ${RECON_SUBJECTS}
fs_license:
  class: File
  path: ${FS_LICENSE}
subject_id: test_recon
input_t1:
  class: File
  path: ${T1W_2MM}
run_all: true
openmp: 2
EOF

echo "WARNING: recon-all takes 6-24 hours to complete."
echo "Started at: $(date)"

run_tool "$TOOL" "${JOB_DIR}/${TOOL}.yml" "$CWL"

echo "Finished at: $(date)"

# ── Verify outputs ─────────────────────────────────────────────
dir="${OUT_DIR}/${TOOL}"
if [[ -d "${dir}/test_recon" ]]; then
  echo "  Subject directory found: ${dir}/test_recon"
  for subdir in mri surf label stats; do
    if [[ -d "${dir}/test_recon/${subdir}" ]]; then
      echo "  OK: ${subdir}/ exists"
    else
      echo "  WARN: ${subdir}/ not found"
    fi
  done
else
  echo "  WARN: subject output directory not found"
fi
