#!/usr/bin/env bash
set -euo pipefail

# Minimal OpenNeuro download for AFNI CWL tests.
# Data is stored in: tests/data/openneuro/<dataset-id>
# Uses ds002979 sub-016 (T1w + BOLD).

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${AFNI_TEST_DATA_DIR:-$ROOT_DIR/tests/data/openneuro}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_cmd aws

mkdir -p "$DATA_DIR"

AWS_NO_SIGN=(--no-sign-request)

sub="sub-016"
ds_id="ds002979"
dest="${DATA_DIR}/${ds_id}"

mkdir -p "$dest"

aws s3 sync "${AWS_NO_SIGN[@]}" "s3://openneuro.org/${ds_id}/" "$dest" \
  --exclude "*" \
  --include "${sub}/anat/*T1w*.nii*" \
  --include "${sub}/anat/*T1w*.json" \
  --include "${sub}/func/*bold*.nii*" \
  --include "${sub}/func/*bold*.json"

echo "Download complete."
echo "Data location: ${DATA_DIR}"
