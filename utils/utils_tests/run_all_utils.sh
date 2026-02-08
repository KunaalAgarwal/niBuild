#!/usr/bin/env bash
# Run all utils tests and report pass/fail summary
set -uo pipefail
export PATH="/home/kunaal/.local/bin:$PATH"
export FS_LICENSE="${FS_LICENSE:-/mnt/c/Users/kuna8/personal_projects/neuro-analysis-frontend/tests/data/freesurfer/license.txt}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Clean summary
rm -f summary.tsv

PASS=0
FAIL=0
ERRORS=""

run_test() {
  local script="$1"
  echo "=== $script ==="
  if bash "$script" 2>&1 | grep -q "Result: FAIL"; then
    FAIL=$((FAIL + 1))
    ERRORS="${ERRORS}  FAIL: ${script}\n"
    echo "  => FAIL"
  else
    PASS=$((PASS + 1))
    echo "  => PASS"
  fi
}

# Phase 1: No dependencies
for s in test_fslmaths.sh test_fslstats.sh test_fslroi.sh \
         test_fslreorient2std.sh test_fslmerge.sh test_cluster.sh \
         test_robustfov.sh \
         test_3dcalc.sh test_3dinfo.sh test_3dcopy.sh \
         test_3dZeropad.sh test_3dresample.sh test_3dfractionize.sh \
         test_3dUndump.sh test_whereami.sh \
         test_N4BiasFieldCorrection.sh test_DenoiseImage.sh \
         test_ImageMath.sh test_ThresholdImage.sh \
         test_mri_convert.sh; do
  run_test "$s"
done

# Phase 2: Needs 4D data
for s in test_fslsplit.sh test_fslmeants.sh \
         test_3dTstat.sh test_3dTcat.sh; do
  run_test "$s"
done

# Phase 3: Needs precomputed transforms
for s in test_applywarp.sh test_invwarp.sh test_convertwarp.sh \
         test_3dNwarpApply.sh test_3dNwarpCat.sh \
         test_antsApplyTransforms.sh test_antsJointLabelFusion.sh; do
  run_test "$s"
done

echo ""
echo "=============================="
echo "TOTAL: $((PASS + FAIL)) tests"
echo "PASS:  $PASS"
echo "FAIL:  $FAIL"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  echo "Failures:"
  echo -e "$ERRORS"
fi
echo "=============================="
