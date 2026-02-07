#!/usr/bin/env bash
# Run all structural MRI CWL test scripts in dependency order.
# Usage: utils/structural_mri_tests/run_all.sh [--rerun-passed]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUMMARY_FILE="${SCRIPT_DIR}/summary.tsv"
PASS=0
FAIL=0
SKIP=0

echo -e "tool\tstatus" > "$SUMMARY_FILE"
echo "=========================================="
echo " Structural MRI CWL Test Suite"
echo "=========================================="
echo ""

run_test() {
  local script="$1"
  local before_lines
  before_lines=$(wc -l < "$SUMMARY_FILE")

  bash "$script" "$@" 2>&1 || true

  # Count results from summary.tsv (run_tool writes PASS/FAIL/SKIP there)
  local new_lines=$(( $(wc -l < "$SUMMARY_FILE") - before_lines ))
  if [[ $new_lines -gt 0 ]]; then
    ((PASS += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tPASS$' || true) )) || true
    ((FAIL += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tFAIL$' || true) )) || true
    ((SKIP += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tSKIP$' || true) )) || true
  fi
  echo ""
}

# ── Phase 1: No dependencies ──────────────────────────────────────

echo "── Phase 1: Independent tools ──"
echo ""

# FSL
run_test "${SCRIPT_DIR}/test_bet.sh" "$@"
run_test "${SCRIPT_DIR}/test_flirt.sh" "$@"
run_test "${SCRIPT_DIR}/test_run_first_all.sh" "$@"
run_test "${SCRIPT_DIR}/test_fsl_anat.sh" "$@"
run_test "${SCRIPT_DIR}/test_sienax.sh" "$@"

# ANTs
run_test "${SCRIPT_DIR}/test_antsBrainExtraction.sh" "$@"
run_test "${SCRIPT_DIR}/test_Atropos.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsAtroposN4.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistration.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistrationSyN.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistrationSyNQuick.sh" "$@"

# FreeSurfer
run_test "${SCRIPT_DIR}/test_mri_convert.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_watershed.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_normalize.sh" "$@"
run_test "${SCRIPT_DIR}/test_mris_inflate.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_aparc2aseg.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_annotation2label.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_label2vol.sh" "$@"
run_test "${SCRIPT_DIR}/test_mris_anatomical_stats.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_segstats.sh" "$@"
run_test "${SCRIPT_DIR}/test_aparcstats2table.sh" "$@"
run_test "${SCRIPT_DIR}/test_asegstats2table.sh" "$@"

# AFNI
run_test "${SCRIPT_DIR}/test_3dSkullStrip.sh" "$@"
run_test "${SCRIPT_DIR}/test_SSwarper.sh" "$@"

# ── Phase 2: Depends on Phase 1 ───────────────────────────────────

echo "── Phase 2: Dependent tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_fast.sh" "$@"
run_test "${SCRIPT_DIR}/test_fnirt.sh" "$@"
run_test "${SCRIPT_DIR}/test_siena.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_segment.sh" "$@"
run_test "${SCRIPT_DIR}/test_mris_sphere.sh" "$@"
run_test "${SCRIPT_DIR}/test_mris_ca_label.sh" "$@"

# ── Phase 3: Depends on Phase 2 ───────────────────────────────────

echo "── Phase 3: Pipeline tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_antsCorticalThickness.sh" "$@"
run_test "${SCRIPT_DIR}/test_KellyKapowski.sh" "$@"

# ── Summary ────────────────────────────────────────────────────────

echo "=========================================="
echo " Summary"
echo "=========================================="
echo "  PASS: ${PASS}"
echo "  FAIL: ${FAIL}"
echo "  SKIP: ${SKIP}"
echo ""
echo "  Details: ${SUMMARY_FILE}"
echo "=========================================="

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
