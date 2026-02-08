#!/usr/bin/env bash
set -euo pipefail

# Test: FSL tbss_non_FA - TBSS Step 5: Project non-FA data onto FA skeleton
# CWL: public/cwl/fsl/tbss_non_FA.cwl
# DEPENDS: tbss_4_prestats output (FA/ and stats/ directories)

source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

check_prerequisites
check_test_data

TOOL_NAME="tbss_non_FA"
CWL_FILE="$CWL_DIR/fsl/tbss_non_FA.cwl"
OUTPUT_DIR="$(setup_output_dir "$TOOL_NAME")"
RESULTS_FILE="$OUTPUT_DIR/results.txt"

echo "=== Testing $TOOL_NAME ===" | tee "$RESULTS_FILE"
echo "Date: $(date)" | tee -a "$RESULTS_FILE"

# Ensure tbss_4 output exists (FA and stats directories with skeleton)
FA_INPUT="$INTERMEDIATE_DIR/tbss_FA_step4"
STATS_INPUT="$INTERMEDIATE_DIR/tbss_stats_step4"
if [[ ! -d "$FA_INPUT" ]]; then
    FA_INPUT="$OUTPUT_BASE/tbss_4_prestats/FA"
fi
if [[ ! -d "$STATS_INPUT" ]]; then
    STATS_INPUT="$OUTPUT_BASE/tbss_4_prestats/stats"
fi
if [[ ! -d "$FA_INPUT" || ! -d "$STATS_INPUT" ]]; then
    echo "Running tbss_4_prestats first..." | tee -a "$RESULTS_FILE"
    bash "$SCRIPT_DIR/test_tbss_4_prestats.sh"
    FA_INPUT="$INTERMEDIATE_DIR/tbss_FA_step4"
    STATS_INPUT="$INTERMEDIATE_DIR/tbss_stats_step4"
fi

# If still not found, try the direct output
if [[ ! -d "$FA_INPUT" ]]; then
    FA_INPUT="$OUTPUT_BASE/tbss_4_prestats/FA"
fi
if [[ ! -d "$STATS_INPUT" ]]; then
    STATS_INPUT="$OUTPUT_BASE/tbss_4_prestats/stats"
fi

if [[ ! -d "$FA_INPUT" || ! -d "$STATS_INPUT" ]]; then
    echo -e "${RED}FAIL: Cannot find TBSS step 4 output (FA/ and stats/)${NC}" | tee -a "$RESULTS_FILE"
    exit 1
fi

# Create synthetic MD data: copy FA data and rename
# tbss_non_FA expects all_<measure>.nii.gz in the stats directory
SYNTH_STATS="$INTERMEDIATE_DIR/tbss_stats_nonFA"
if [[ ! -d "$SYNTH_STATS" ]]; then
    echo "Creating synthetic MD data for tbss_non_FA..." | tee -a "$RESULTS_FILE"
    cp -r "$STATS_INPUT" "$SYNTH_STATS"
    # Copy all_FA as all_MD (synthetic substitute)
    if [[ -f "$SYNTH_STATS/all_FA.nii.gz" ]]; then
        cp "$SYNTH_STATS/all_FA.nii.gz" "$SYNTH_STATS/all_MD.nii.gz"
    fi
fi

# Step 1: Validate CWL
validate_cwl "$CWL_FILE" "$RESULTS_FILE" || exit 1

# Step 2: Generate template
echo "--- Generating template ---" | tee -a "$RESULTS_FILE"
cwltool --make-template "$CWL_FILE" > "$OUTPUT_DIR/template.yml" 2>/dev/null
echo "Template saved to $OUTPUT_DIR/template.yml" | tee -a "$RESULTS_FILE"

# Step 3: Create job YAML
cat > "$OUTPUT_DIR/job.yml" << EOF
measure: MD
fa_directory:
  class: Directory
  path: $FA_INPUT
stats_directory:
  class: Directory
  path: $SYNTH_STATS
EOF

# Step 4: Run tool
echo "--- Running $TOOL_NAME ---" | tee -a "$RESULTS_FILE"
PASS=true
if cwltool --outdir "$OUTPUT_DIR" "$CWL_FILE" "$OUTPUT_DIR/job.yml" >> "$RESULTS_FILE" 2>&1; then
    echo -e "${GREEN}PASS: $TOOL_NAME execution${NC}" | tee -a "$RESULTS_FILE"
else
    echo -e "${RED}FAIL: $TOOL_NAME execution${NC}" | tee -a "$RESULTS_FILE"
    PASS=false
fi

# Step 5: Check outputs
echo "--- Output validation ---" | tee -a "$RESULTS_FILE"
SKEL_FILE="$OUTPUT_DIR/stats/all_MD_skeletonised.nii.gz"
if [[ ! -f "$SKEL_FILE" ]]; then
    SKEL_FILE="$OUTPUT_DIR/all_MD_skeletonised.nii.gz"
fi
check_file_exists "$SKEL_FILE" "all_MD_skeletonised" "$RESULTS_FILE" || PASS=false
check_file_nonempty "$SKEL_FILE" "all_MD_skeletonised" "$RESULTS_FILE" || PASS=false

# Step 6: Header checks
echo "--- Header checks ---" | tee -a "$RESULTS_FILE"
if [[ -f "$SKEL_FILE" ]]; then
    check_nifti_header "$SKEL_FILE" "all_MD_skeletonised" "$RESULTS_FILE" || PASS=false
fi

# Summary
echo "" | tee -a "$RESULTS_FILE"
if $PASS; then
    echo -e "${GREEN}=== $TOOL_NAME: ALL TESTS PASSED ===${NC}" | tee -a "$RESULTS_FILE"
else
    echo -e "${RED}=== $TOOL_NAME: SOME TESTS FAILED ===${NC}" | tee -a "$RESULTS_FILE"
fi
