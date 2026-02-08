#!/usr/bin/env bash
# Run all Connectome Workbench CWL test scripts in dependency order.
# Usage: utils/wb_tests/run_all.sh [--rerun-passed]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SUMMARY_FILE="${SCRIPT_DIR}/summary.tsv"
PASS=0
FAIL=0
SKIP=0

echo -e "tool\tstatus" > "$SUMMARY_FILE"
echo "=========================================="
echo " Connectome Workbench CWL Test Suite"
echo "=========================================="
echo ""

run_test() {
  local script="$1"
  local before_lines
  before_lines=$(wc -l < "$SUMMARY_FILE")

  bash "$script" "$@" 2>&1 || true

  local new_lines=$(( $(wc -l < "$SUMMARY_FILE") - before_lines ))
  if [[ $new_lines -gt 0 ]]; then
    ((PASS += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tPASS$' || true) )) || true
    ((FAIL += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tFAIL$' || true) )) || true
    ((SKIP += $(tail -n "$new_lines" "$SUMMARY_FILE" | grep -cP '\tSKIP$' || true) )) || true
  fi
  echo ""
}

# ── Phase 1: Independent tools ──────────────────────────────
echo "── Phase 1: Independent tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_wb_command_metric_smoothing.sh" "$@"
run_test "${SCRIPT_DIR}/test_wb_command_surface_sphere_project_unproject.sh" "$@"
run_test "${SCRIPT_DIR}/test_wb_command_cifti_create_dense_timeseries.sh" "$@"

# ── Phase 2: Depends on Phase 1 (needs CIFTI from create_dense_timeseries) ──
echo "── Phase 2: Dependent tools ──"
echo ""

run_test "${SCRIPT_DIR}/test_wb_command_cifti_separate.sh" "$@"
run_test "${SCRIPT_DIR}/test_wb_command_cifti_smoothing.sh" "$@"

# ── Summary ──────────────────────────────────────────────────
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
