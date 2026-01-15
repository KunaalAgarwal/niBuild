#!/usr/bin/env bash
set -euo pipefail

# Minimal FreeSurfer subject data for CWL tests.
# Data is stored in: tests/data/freesurfer/subjects/bert
# Source: https://surfer.nmr.mgh.harvard.edu/pub/data/archive/bert.recon.tgz

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${FREESURFER_TEST_DATA_DIR:-$ROOT_DIR/tests/data/freesurfer}"
SUBJECTS_DIR="$DATA_DIR/subjects"
ARCHIVE_DIR="$DATA_DIR/archive"
BERT_URL="https://surfer.nmr.mgh.harvard.edu/pub/data/archive/bert.recon.tgz"
BERT_ARCHIVE="$ARCHIVE_DIR/bert.recon.tgz"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

ensure_repo_data_gitignore() {
  local data_path="$1"
  local data_root="${ROOT_DIR}/tests/data"
  if [[ "$data_path" == "$data_root"* ]]; then
    mkdir -p "$data_root"
    touch "$data_root/.gitignore"
  fi
}

require_cmd curl
require_cmd tar

ensure_repo_data_gitignore "$DATA_DIR"
mkdir -p "$SUBJECTS_DIR" "$ARCHIVE_DIR"

if [[ -d "$SUBJECTS_DIR/bert" ]]; then
  echo "bert subject already present: $SUBJECTS_DIR/bert"
else
  if [[ ! -f "$BERT_ARCHIVE" ]]; then
    echo "Downloading bert recon data..."
    curl -L --fail --retry 3 --retry-delay 2 -o "$BERT_ARCHIVE" "$BERT_URL"
  fi
  echo "Extracting bert recon data..."
  tar -xzf "$BERT_ARCHIVE" -C "$SUBJECTS_DIR"
fi

if [[ ! -f "$SUBJECTS_DIR/bert/mri/orig.mgz" ]]; then
  echo "ERROR: bert subject not found after extraction" >&2
  exit 1
fi

echo "Download complete."
echo "Subjects directory: $SUBJECTS_DIR"
