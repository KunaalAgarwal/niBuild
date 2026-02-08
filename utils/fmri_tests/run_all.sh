#!/usr/bin/env bash
# Run all fMRI CWL test scripts in dependency order.
# Usage: utils/fmri_tests/run_all.sh [--rerun-passed]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUMMARY_FILE="${SCRIPT_DIR}/summary.tsv"
PASS=0
FAIL=0
SKIP=0

echo -e "tool\tstatus" > "$SUMMARY_FILE"
echo "=========================================="
echo " fMRI CWL Test Suite"
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

# ── Phase 1: Independent tools (no dependencies) ────────────────

echo "── Phase 1: Independent tools ──"
echo ""

# FSL - preprocessing & registration basics
run_test "${SCRIPT_DIR}/test_mcflirt.sh" "$@"
run_test "${SCRIPT_DIR}/test_slicetimer.sh" "$@"
run_test "${SCRIPT_DIR}/test_fugue.sh" "$@"
run_test "${SCRIPT_DIR}/test_topup.sh" "$@"
run_test "${SCRIPT_DIR}/test_applytopup.sh" "$@"
run_test "${SCRIPT_DIR}/test_prelude.sh" "$@"
run_test "${SCRIPT_DIR}/test_fsl_prepare_fieldmap.sh" "$@"
run_test "${SCRIPT_DIR}/test_susan.sh" "$@"
run_test "${SCRIPT_DIR}/test_bet.sh" "$@"
run_test "${SCRIPT_DIR}/test_flirt.sh" "$@"
run_test "${SCRIPT_DIR}/test_fsl_anat.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslmaths.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslstats.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslmeants.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslroi.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslsplit.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslreorient2std.sh" "$@"
run_test "${SCRIPT_DIR}/test_melodic.sh" "$@"
run_test "${SCRIPT_DIR}/test_film_gls.sh" "$@"

# AFNI - preprocessing
run_test "${SCRIPT_DIR}/test_3dvolreg.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dTshift.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dDespike.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dBandpass.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dBlurToFWHM.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dmerge.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dSkullStrip.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dAutomask.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dUnifize.sh" "$@"

# AFNI - registration
run_test "${SCRIPT_DIR}/test_3dAllineate.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dQwarp.sh" "$@"
run_test "${SCRIPT_DIR}/test_auto_tlrc.sh" "$@"
run_test "${SCRIPT_DIR}/test_SSwarper.sh" "$@"
run_test "${SCRIPT_DIR}/test_align_epi_anat.sh" "$@"

# AFNI - statistics
run_test "${SCRIPT_DIR}/test_3dDeconvolve.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dttest++.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dMEMA.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dANOVA.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dANOVA2.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dANOVA3.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dMVM.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dLME.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dLMEr.sh" "$@"

# AFNI - QC & connectivity
run_test "${SCRIPT_DIR}/test_3dClustSim.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dFWHMx.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dNetCorr.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dTcorr1D.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dTcorrMap.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dRSFC.sh" "$@"

# AFNI - ROI & utilities
run_test "${SCRIPT_DIR}/test_3dROIstats.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dmaskave.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dcalc.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dTstat.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dinfo.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dZeropad.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dTcat.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dresample.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dfractionize.sh" "$@"

# ANTs
run_test "${SCRIPT_DIR}/test_antsMotionCorr.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsBrainExtraction.sh" "$@"
run_test "${SCRIPT_DIR}/test_N4BiasFieldCorrection.sh" "$@"
run_test "${SCRIPT_DIR}/test_DenoiseImage.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistration.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistrationSyN.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsRegistrationSyNQuick.sh" "$@"
run_test "${SCRIPT_DIR}/test_antsIntermodalityIntrasubject.sh" "$@"
run_test "${SCRIPT_DIR}/test_ImageMath.sh" "$@"
run_test "${SCRIPT_DIR}/test_ThresholdImage.sh" "$@"

# FreeSurfer
run_test "${SCRIPT_DIR}/test_bbregister.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_convert.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_vol2surf.sh" "$@"
run_test "${SCRIPT_DIR}/test_mris_preproc.sh" "$@"

# ── Phase 2: Depends on Phase 1 ─────────────────────────────────

echo "── Phase 2: Dependent tools ──"
echo ""

# FSL
run_test "${SCRIPT_DIR}/test_fast.sh" "$@"
run_test "${SCRIPT_DIR}/test_fnirt.sh" "$@"
run_test "${SCRIPT_DIR}/test_fslmerge.sh" "$@"

# AFNI
run_test "${SCRIPT_DIR}/test_3dREMLfit.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dNwarpApply.sh" "$@"
run_test "${SCRIPT_DIR}/test_3dNwarpCat.sh" "$@"

# ANTs
run_test "${SCRIPT_DIR}/test_antsApplyTransforms.sh" "$@"

# FreeSurfer
run_test "${SCRIPT_DIR}/test_mri_surf2vol.sh" "$@"
run_test "${SCRIPT_DIR}/test_mri_glmfit.sh" "$@"

# ── Phase 3: Depends on Phase 2 ─────────────────────────────────

echo "── Phase 3: Pipeline tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_convertwarp.sh" "$@"
run_test "${SCRIPT_DIR}/test_dual_regression.sh" "$@"
run_test "${SCRIPT_DIR}/test_invwarp.sh" "$@"
run_test "${SCRIPT_DIR}/test_randomise.sh" "$@"
run_test "${SCRIPT_DIR}/test_flameo.sh" "$@"

# ── Phase 4: Depends on Phase 3 ─────────────────────────────────

echo "── Phase 4: Final tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_applywarp.sh" "$@"
run_test "${SCRIPT_DIR}/test_cluster.sh" "$@"

# ── Summary ──────────────────────────────────────────────────────

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
