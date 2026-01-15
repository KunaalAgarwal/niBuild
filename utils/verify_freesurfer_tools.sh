#!/usr/bin/env bash
set -uo pipefail
shopt -s nullglob

# One-command verification for all FreeSurfer CWL tools.
# Usage: scripts/verify_freesurfer_tools.sh [--rerun-passed|--rerun-all]
#
# Requires:
# - cwltool
# - docker
#
# FreeSurfer license:
# - Set FS_LICENSE to your license.txt path, OR
# - Place license at tests/data/freesurfer/license.txt
#
# Data location (download script stores here by default):
#   tests/data/freesurfer/subjects/bert
#
# Outputs:
#   tests/work/freesurfer/{jobs,out,logs,derived,summary.tsv}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${FREESURFER_TEST_DATA_DIR:-$ROOT_DIR/tests/data/freesurfer}"
WORK_DIR="${FREESURFER_TEST_WORK_DIR:-$ROOT_DIR/tests/work/freesurfer}"
DATA_SUBJECTS_DIR="${DATA_DIR}/subjects"
WORK_SUBJECTS_DIR="${WORK_DIR}/subjects"
SUBJECTS_DIR="$WORK_SUBJECTS_DIR"
JOB_DIR="${WORK_DIR}/jobs"
OUT_DIR="${WORK_DIR}/out"
LOG_DIR="${WORK_DIR}/logs"
DERIVED_DIR="${WORK_DIR}/derived"
SUMMARY_FILE="${WORK_DIR}/summary.tsv"
CWL_DIR="${ROOT_DIR}/public/cwl/freesurfer"
FREESURFER_IMAGE="${FREESURFER_DOCKER_IMAGE:-freesurfer/freesurfer:7.4.1}"
RERUN_PASSED=0
PASS_CACHE_FILE=""

LICENSE_FILE="${FS_LICENSE:-}"

if [[ -z "$LICENSE_FILE" && -f "${DATA_DIR}/license.txt" ]]; then
  LICENSE_FILE="${DATA_DIR}/license.txt"
fi

for arg in "$@"; do
  case "$arg" in
    --rerun-passed|--rerun-all)
      RERUN_PASSED=1
      ;;
    --help|-h)
      echo "Usage: $(basename "$0") [--rerun-passed|--rerun-all]"
      exit 0
      ;;
    *)
      echo "Error: Unknown argument: ${arg}" >&2
      exit 1
      ;;
  esac
done

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

skip_tool() {
  local name="$1"
  local reason="${2:-}"
  echo -e "${name}\tSKIP" >>"$SUMMARY_FILE"
  if [[ -n "$reason" ]]; then
    echo "SKIP: ${reason}" >>"${LOG_DIR}/${name}.log"
  fi
}

copy_from_fs_image() {
  local src_rel="$1"
  local dest="$2"
  docker run --rm \
    -v "$ROOT_DIR":"$ROOT_DIR" \
    -w "$ROOT_DIR" \
    "$FREESURFER_IMAGE" /bin/sh -c "
      for d in \"\${FREESURFER_HOME:-}\" /opt/freesurfer /usr/local/freesurfer /usr/share/freesurfer; do
        if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
          cp \"\$d/${src_rel}\" \"${dest}\"
          exit 0
        fi
      done
      exit 1
    "
}

verify_outputs() {
  local outputs_json="$1"
  python3 - "$outputs_json" <<'PY'
import json
import os
import sys
from urllib.parse import urlparse

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

paths = []

def add_path(p):
    if not p:
        return
    if p.startswith("file://"):
        p = urlparse(p).path
    paths.append(p)

def walk(obj):
    if obj is None:
        return
    if isinstance(obj, dict):
        if obj.get("class") in ("File", "Directory"):
            add_path(obj.get("path") or obj.get("location"))
        else:
            for v in obj.values():
                walk(v)
    elif isinstance(obj, list):
        for v in obj:
            walk(v)

walk(data)
paths = [p for p in paths if p]

if not paths:
    print("no outputs found")
    sys.exit(2)

missing = [p for p in paths if not os.path.exists(p)]
if missing:
    print("missing outputs:", ", ".join(missing))
    sys.exit(3)

print("ok")
PY
}

RUN_TOOL_STATUS=0
run_tool() {
  local name="$1"
  local job_file="$2"
  local cwl_file="${CWL_DIR}/${name}.cwl"
  local out_dir="${OUT_DIR}/${name}"
  local log_file="${LOG_DIR}/${name}.log"
  local out_json="${out_dir}/outputs.json"
  local status="FAIL"

  mkdir -p "$out_dir"

  if [[ "$RERUN_PASSED" -eq 0 ]] && is_cached_pass "$name"; then
    return 0
  fi

  if cwltool --outdir "$out_dir" "$cwl_file" "$job_file" >"$out_json" 2>"$log_file"; then
    if verify_outputs "$out_json" >>"$log_file" 2>&1; then
      status="PASS"
    fi
  fi

  if [[ "$status" == "PASS" ]]; then
    RUN_TOOL_STATUS=0
  else
    RUN_TOOL_STATUS=1
  fi
  echo -e "${name}\t${status}" >>"$SUMMARY_FILE"
  return 0
}

require_cmd cwltool
require_cmd docker
require_cmd python3

ensure_repo_data_gitignore "$DATA_DIR"
mkdir -p "$JOB_DIR" "$OUT_DIR" "$LOG_DIR" "$DERIVED_DIR"

is_cached_pass() {
  local name="$1"
  local out_json="${OUT_DIR}/${name}/outputs.json"
  if [[ -n "$PASS_CACHE_FILE" && -f "$PASS_CACHE_FILE" && -f "$out_json" ]]; then
    if grep -qx "$name" "$PASS_CACHE_FILE"; then
      if verify_outputs "$out_json" >/dev/null 2>&1; then
        echo -e "${name}\tPASS" >>"$SUMMARY_FILE"
        echo "CACHED PASS: skipping re-run (use --rerun-passed to re-run)" >>"${LOG_DIR}/${name}.log"
        return 0
      fi
    fi
  fi
  return 1
}

if [[ -f "$SUMMARY_FILE" && "$RERUN_PASSED" -eq 0 ]]; then
  PASS_CACHE_FILE="${WORK_DIR}/.passed_cache"
  awk -F $'\t' '$2=="PASS" {print $1}' "$SUMMARY_FILE" > "$PASS_CACHE_FILE"
fi

echo -e "tool\tstatus" >"$SUMMARY_FILE"

# Download data if missing.
if [[ ! -d "${DATA_SUBJECTS_DIR}/bert" ]]; then
  "${ROOT_DIR}/utils/download_freesurfer_test_data.sh"
fi

if [[ ! -d "${DATA_SUBJECTS_DIR}/bert" ]]; then
  echo "Error: bert subject not found in ${DATA_SUBJECTS_DIR}" >&2
  exit 1
fi

if [[ -z "$LICENSE_FILE" || ! -f "$LICENSE_FILE" ]]; then
  echo "Error: FreeSurfer license not found." >&2
  echo "Set FS_LICENSE or place license.txt at ${DATA_DIR}/license.txt" >&2
  exit 1
fi

# Use a writable copy of the subject to allow tools that write into SUBJECTS_DIR.
mkdir -p "$WORK_SUBJECTS_DIR"
if [[ ! -d "${WORK_SUBJECTS_DIR}/bert" ]]; then
  cp -a "${DATA_SUBJECTS_DIR}/bert" "${WORK_SUBJECTS_DIR}/"
fi

if [[ ! -d "${WORK_SUBJECTS_DIR}/bert" ]]; then
  echo "Error: writable bert subject not found in ${WORK_SUBJECTS_DIR}" >&2
  exit 1
fi

SUBJECTS_DIR="$WORK_SUBJECTS_DIR"

SUBJECT="bert"
SUBJECT2="bert2"
SUBJECT_DIR="${SUBJECTS_DIR}/${SUBJECT}"
SUBJECT_DIR2="${SUBJECTS_DIR}/${SUBJECT2}"
T1_MGZ="${SUBJECT_DIR}/mri/orig.mgz"
BRAIN_MGZ="${SUBJECT_DIR}/mri/brain.mgz"
ASEG_MGZ="${SUBJECT_DIR}/mri/aseg.mgz"
APARC_LH="${SUBJECT_DIR}/label/lh.aparc.annot"
LABEL_LH_CORTEX="${SUBJECT_DIR}/label/lh.cortex.label"
SURF_LH_WHITE="${SUBJECT_DIR}/surf/lh.white"
SURF_LH_SPHERE_REG="${SUBJECT_DIR}/surf/lh.sphere.reg"
SURF_LH_SUBJECT_SPHERE_REG="${SUBJECT_DIR}/surf/lh.${SUBJECT}.sphere.reg"

if [[ -f "$SURF_LH_SPHERE_REG" && ! -f "$SURF_LH_SUBJECT_SPHERE_REG" ]]; then
  cp "$SURF_LH_SPHERE_REG" "$SURF_LH_SUBJECT_SPHERE_REG"
fi

if [[ -L "$SUBJECT_DIR2" ]]; then
  rm -f "$SUBJECT_DIR2"
fi

if [[ ! -d "$SUBJECT_DIR2" ]]; then
  cp -a "$SUBJECT_DIR" "$SUBJECT_DIR2"
fi

SURF_LH_SUBJECT2_SPHERE_REG="${SUBJECT_DIR2}/surf/lh.${SUBJECT2}.sphere.reg"
if [[ -f "$SURF_LH_SPHERE_REG" && ! -f "$SURF_LH_SUBJECT2_SPHERE_REG" ]]; then
  cp "$SURF_LH_SPHERE_REG" "$SURF_LH_SUBJECT2_SPHERE_REG"
fi

if [[ ! -f "$T1_MGZ" ]]; then
  echo "Error: missing ${T1_MGZ}" >&2
  exit 1
fi

CLASSIFIER_GCS="${DERIVED_DIR}/lh.curvature.buckner40.filled.desikan_killiany.2010-03-25.gcs"
if [[ ! -f "$CLASSIFIER_GCS" ]]; then
  if ! copy_from_fs_image "average/lh.curvature.buckner40.filled.desikan_killiany.2010-03-25.gcs" "$CLASSIFIER_GCS"; then
    echo "WARN: Could not copy mris_ca_label classifier from FreeSurfer image" >&2
    CLASSIFIER_GCS=""
  fi
fi

# Job files
cat > "${JOB_DIR}/mri_convert.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${T1_MGZ}"
output: "bert_orig.nii.gz"
EOF

cat > "${JOB_DIR}/mri_watershed.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${T1_MGZ}"
output: "bert_watershed.mgz"
EOF

cat > "${JOB_DIR}/mri_normalize.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${T1_MGZ}"
output: "bert_norm.mgz"
EOF

cat > "${JOB_DIR}/mri_segment.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${OUT_DIR}/mri_normalize/bert_norm.mgz"
output: "bert_segment.mgz"
EOF

cat > "${JOB_DIR}/bbregister.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subject: "${SUBJECT}"
source_file:
  class: File
  path: "${BRAIN_MGZ}"
out_reg_file: "bbregister.dat"
contrast_type: t1
init_header: true
no_coreg_ref_mask: true
no_brute2: true
brute1max: 1
brute1delta: 1
subsamp1: 200
subsamp: 200
nmax: 1
tol: 0.1
tol1d: 0.1
EOF

cat > "${JOB_DIR}/mri_annotation2label.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subject: "${SUBJECT}"
hemi: lh
outdir: "annotation_labels"
EOF

cat > "${JOB_DIR}/mri_label2vol.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
label:
  class: File
  path: "${LABEL_LH_CORTEX}"
temp:
  class: File
  path: "${BRAIN_MGZ}"
output: "label2vol.mgz"
identity: true
EOF

cat > "${JOB_DIR}/mri_aparc2aseg.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subject: "${SUBJECT}"
output: "aparc2aseg.mgz"
EOF

cat > "${JOB_DIR}/mri_segstats.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
seg:
  class: File
  path: "${ASEG_MGZ}"
sum: "segstats.txt"
ctab_default: true
EOF

cat > "${JOB_DIR}/aparcstats2table.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subjects:
  - "${SUBJECT}"
hemi: lh
tablefile: "aparcstats.tsv"
EOF

cat > "${JOB_DIR}/asegstats2table.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subjects:
  - "${SUBJECT}"
tablefile: "asegstats.tsv"
EOF

cat > "${JOB_DIR}/mris_anatomical_stats.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subject: "${SUBJECT}"
hemi: lh
annotation:
  class: File
  path: "${APARC_LH}"
tablefile: "anatomical_stats.tsv"
EOF

cat > "${JOB_DIR}/mris_inflate.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${SURF_LH_WHITE}"
output: "lh.inflated.test"
n: 5
EOF

cat > "${JOB_DIR}/mris_sphere.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${OUT_DIR}/mris_inflate/lh.inflated.test"
output: "lh.sphere.test"
q: true
EOF

cat > "${JOB_DIR}/mri_vol2surf.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
source_file:
  class: File
  path: "${BRAIN_MGZ}"
hemi: lh
output: "vol2surf.mgh"
reg_header: "${SUBJECT}"
subject: "${SUBJECT}"
projfrac: 0.5
interp: nearest
EOF

cat > "${JOB_DIR}/mri_surf2vol.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
source_file:
  class: File
  path: "${OUT_DIR}/mri_vol2surf/vol2surf.mgh"
hemi: lh
output: "surf2vol.mgz"
identity: "${SUBJECT}"
template:
  class: File
  path: "${BRAIN_MGZ}"
EOF

cat > "${JOB_DIR}/mris_preproc.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
output: "mris_preproc.mgh"
target: "${SUBJECT}"
hemi: lh
subjects:
  - "${SUBJECT}"
  - "${SUBJECT2}"
meas: thickness
EOF

cat > "${JOB_DIR}/mri_glmfit.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
y:
  class: File
  path: "${OUT_DIR}/mris_preproc/mris_preproc.mgh"
glmdir: "mri_glmfit_out"
osgm: true
EOF

cat > "${JOB_DIR}/mris_ca_label.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
subject: "${SUBJECT}"
hemi: lh
canonsurf:
  class: File
  path: "${SURF_LH_SPHERE_REG}"
classifier:
  class: File
  path: "${CLASSIFIER_GCS}"
output: "lh.aparc.ca.annot"
EOF

cat > "${JOB_DIR}/dmri_postreg.yml" <<EOF
subjects_dir:
  class: Directory
  path: "${SUBJECTS_DIR}"
  writable: true
fs_license:
  class: File
  path: "${LICENSE_FILE}"
input:
  class: File
  path: "${BRAIN_MGZ}"
output: "dmri_postreg.mgz"
noresample: true
ref:
  class: File
  path: "${BRAIN_MGZ}"
EOF

# Run tools
run_tool "mri_convert" "${JOB_DIR}/mri_convert.yml"
run_tool "mri_watershed" "${JOB_DIR}/mri_watershed.yml"
run_tool "mri_normalize" "${JOB_DIR}/mri_normalize.yml"

if [[ -f "${OUT_DIR}/mri_normalize/bert_norm.mgz" ]]; then
  run_tool "mri_segment" "${JOB_DIR}/mri_segment.yml"
else
  skip_tool "mri_segment" "missing mri_normalize output"
fi

run_tool "bbregister" "${JOB_DIR}/bbregister.yml"
run_tool "mri_annotation2label" "${JOB_DIR}/mri_annotation2label.yml"
run_tool "mri_label2vol" "${JOB_DIR}/mri_label2vol.yml"
run_tool "mri_aparc2aseg" "${JOB_DIR}/mri_aparc2aseg.yml"
run_tool "mri_segstats" "${JOB_DIR}/mri_segstats.yml"
run_tool "aparcstats2table" "${JOB_DIR}/aparcstats2table.yml"
run_tool "asegstats2table" "${JOB_DIR}/asegstats2table.yml"
run_tool "mris_anatomical_stats" "${JOB_DIR}/mris_anatomical_stats.yml"
run_tool "mris_inflate" "${JOB_DIR}/mris_inflate.yml"

if [[ -f "${OUT_DIR}/mris_inflate/lh.inflated.test" ]]; then
  run_tool "mris_sphere" "${JOB_DIR}/mris_sphere.yml"
else
  skip_tool "mris_sphere" "missing mris_inflate output"
fi

run_tool "mri_vol2surf" "${JOB_DIR}/mri_vol2surf.yml"

if [[ -f "${OUT_DIR}/mri_vol2surf/vol2surf.mgh" ]]; then
  run_tool "mri_surf2vol" "${JOB_DIR}/mri_surf2vol.yml"
else
  skip_tool "mri_surf2vol" "missing mri_vol2surf output"
fi

run_tool "mris_preproc" "${JOB_DIR}/mris_preproc.yml"

if [[ -f "${OUT_DIR}/mris_preproc/mris_preproc.mgh" ]]; then
  run_tool "mri_glmfit" "${JOB_DIR}/mri_glmfit.yml"
else
  skip_tool "mri_glmfit" "missing mris_preproc output"
fi

if [[ -n "${CLASSIFIER_GCS}" && -f "${CLASSIFIER_GCS}" ]]; then
  run_tool "mris_ca_label" "${JOB_DIR}/mris_ca_label.yml"
else
  skip_tool "mris_ca_label" "missing classifier file"
fi

run_tool "dmri_postreg" "${JOB_DIR}/dmri_postreg.yml"

PASS_COUNT="$(awk -F $'\t' 'NR>1 && $2=="PASS" {c++} END {print c+0}' "$SUMMARY_FILE")"
FAIL_COUNT="$(awk -F $'\t' 'NR>1 && $2=="FAIL" {c++} END {print c+0}' "$SUMMARY_FILE")"
SKIP_COUNT="$(awk -F $'\t' 'NR>1 && $2=="SKIP" {c++} END {print c+0}' "$SUMMARY_FILE")"

echo "Verification complete."
echo "Summary: ${SUMMARY_FILE}"
echo "Results: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} SKIP=${SKIP_COUNT}"
