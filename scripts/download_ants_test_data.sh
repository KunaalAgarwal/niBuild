#!/usr/bin/env bash
set -euo pipefail

# Minimal OpenNeuro download to test ANTs tools in public/cwl/ants.
# Data is stored in: tests/data/openneuro/ds002979
#
# Uses: ds002979 (sub-016) T1w + BOLD for structural and 4D inputs.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ANTS_TEST_DATA_DIR:-$ROOT_DIR/tests/data/openneuro}"
DSID="ds002979"
SUB="sub-016"
DEST="${DATA_DIR}/${DSID}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd aws

mkdir -p "$DEST"

aws s3 sync --no-sign-request "s3://openneuro.org/${DSID}/" "$DEST" \
  --exclude "*" \
  --include "${SUB}/anat/*T1w*.nii*" \
  --include "${SUB}/anat/*T1w*.json" \
  --include "${SUB}/func/*bold*.nii*" \
  --include "${SUB}/func/*bold*.json"

echo "Downloads complete."
echo "Data location: ${DEST}"
