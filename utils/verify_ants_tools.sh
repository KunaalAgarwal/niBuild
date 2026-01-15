#!/usr/bin/env bash
set -uo pipefail
shopt -s nullglob

# One-command verification for all ANTs CWL tools.
# Usage: scripts/verify_ants_tools.sh [--rerun-passed|--rerun-all]
#
# Requires:
# - cwltool
# - docker
# - aws cli (only if data needs downloading)
#
# Data location:
#   tests/data/openneuro/ds002979
#
# Outputs:
#   tests/work/ants/{jobs,out,logs,derived,summary.tsv}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${ANTS_TEST_DATA_DIR:-$ROOT_DIR/tests/data/openneuro}"
WORK_DIR="${ANTS_TEST_WORK_DIR:-$ROOT_DIR/tests/work/ants}"
JOB_DIR="${WORK_DIR}/jobs"
OUT_DIR="${WORK_DIR}/out"
LOG_DIR="${WORK_DIR}/logs"
DERIVED_DIR="${WORK_DIR}/derived"
SUMMARY_FILE="${WORK_DIR}/summary.tsv"
CWL_DIR="${ROOT_DIR}/public/cwl/ants"
ANTS_IMAGE="${ANTS_DOCKER_IMAGE:-fnndsc/ants:latest}"
DOCKER_PLATFORM="${ANTS_DOCKER_PLATFORM:-}"
RES_MM="${ANTS_TEST_RES_MM:-6}"
ANTS_NUM_THREADS="${ANTS_NUM_THREADS:-1}"
ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS="${ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS:-1}"
RERUN_PASSED=0
PASS_CACHE_FILE=""
CWLTOOL_ARGS=()

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

if [[ "${ANTS_DISABLE_PULL:-1}" -eq 1 ]]; then
  CWLTOOL_ARGS+=(--disable-pull)
fi
CWLTOOL_ARGS+=(--preserve-environment ANTS_NUM_THREADS)
CWLTOOL_ARGS+=(--preserve-environment ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS)
export ANTS_NUM_THREADS
export ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS

die() {
  echo "Error: $1" >&2
  exit 1
}

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

find_one() {
  local root="$1"
  local pattern="$2"
  if [[ "$pattern" == */* ]]; then
    find "$root" -type f -path "*$pattern" | head -n1
  else
    find "$root" -type f -name "$pattern" | head -n1
  fi
}

docker_ants() {
  if [[ -n "$DOCKER_PLATFORM" ]]; then
    docker run --rm \
      --platform "$DOCKER_PLATFORM" \
      -e ANTS_NUM_THREADS="$ANTS_NUM_THREADS" \
      -e ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS="$ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS" \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$ANTS_IMAGE" "$@"
  else
    docker run --rm \
      -e ANTS_NUM_THREADS="$ANTS_NUM_THREADS" \
      -e ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS="$ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS" \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$ANTS_IMAGE" "$@"
  fi
}

ensure_image() {
  local image="$1"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi
  if ! docker pull "$image"; then
    die "Failed to pull ${image}"
  fi
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

  if cwltool "${CWLTOOL_ARGS[@]}" --outdir "$out_dir" "$cwl_file" "$job_file" >"$out_json" 2>"$log_file"; then
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

move_cortical_testmode_artifacts() {
  for artifact in "$ROOT_DIR"/cortical_testMode_*; do
    if [[ -e "$artifact" ]]; then
      mv "$artifact" "$DERIVED_DIR/"
    fi
  done
}
move_cortical_testmode_artifacts

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

ensure_image "$ANTS_IMAGE"

# Download data if missing.
if [[ ! -d "${DATA_DIR}/ds002979" ]]; then
  require_cmd aws
  "${ROOT_DIR}/utils/download_ants_test_data.sh"
fi

DS1="${DATA_DIR}/ds002979"
T1W="$(find_one "$DS1" "*T1w*.nii*")"
BOLD="$(find_one "$DS1" "*bold*.nii*")"

if [[ -z "$T1W" ]]; then
  die "No T1w dataset found in ${DS1}"
fi
if [[ -z "$BOLD" ]]; then
  die "No BOLD dataset found in ${DS1}"
fi

T1_RES="${DERIVED_DIR}/t1_${RES_MM}mm.nii.gz"
BOLD_SHORT="${DERIVED_DIR}/bold_5.nii.gz"
BOLD_FIRST="${DERIVED_DIR}/bold_first.nii.gz"
MASK="${DERIVED_DIR}/t1_mask.nii.gz"
MASK_ERODE="${DERIVED_DIR}/t1_mask_erode.nii.gz"
LABEL1_TEMP="${DERIVED_DIR}/label_gm_temp.nii.gz"
LABEL1="${DERIVED_DIR}/label_gm.nii.gz"
LABEL2="${DERIVED_DIR}/label_wm.nii.gz"
SEGMENTATION="${DERIVED_DIR}/segmentation.nii.gz"
GM_PROB="${DERIVED_DIR}/gm_prob.nii.gz"
WM_PROB="${DERIVED_DIR}/wm_prob.nii.gz"
PRIORS_DIR="${DERIVED_DIR}/priors"

if [[ ! -f "$T1_RES" ]]; then
  docker_ants ResampleImage 3 "$T1W" "$T1_RES" "${RES_MM}x${RES_MM}x${RES_MM}" 0 0
fi

if [[ ! -f "$BOLD_SHORT" ]]; then
  docker_ants ExtractRegionFromImage 4 "$BOLD" "$BOLD_SHORT" 0x0x0x0 95x95x71x4
fi

if [[ ! -f "$BOLD_FIRST" ]]; then
  docker_ants ExtractSliceFromImage 4 "$BOLD_SHORT" "$BOLD_FIRST" 3 0
fi

if [[ ! -f "$MASK" ]]; then
  docker_ants ThresholdImage 3 "$T1_RES" "$MASK" 0.01 100000 1 0
fi

if [[ ! -f "$MASK_ERODE" ]]; then
  docker_ants ImageMath 3 "$MASK_ERODE" ME "$MASK" 1
fi

if [[ ! -f "$LABEL1_TEMP" ]]; then
  docker_ants ImageMath 3 "$LABEL1_TEMP" - "$MASK" "$MASK_ERODE"
fi
if [[ ! -f "$LABEL1" ]]; then
  docker_ants ImageMath 3 "$LABEL1" m "$LABEL1_TEMP" 2
fi

if [[ ! -f "$LABEL2" ]]; then
  docker_ants ImageMath 3 "$LABEL2" m "$MASK_ERODE" 3
fi

if [[ ! -f "$SEGMENTATION" ]]; then
  docker_ants ImageMath 3 "$SEGMENTATION" + "$LABEL1" "$LABEL2"
fi

if [[ ! -f "$GM_PROB" ]]; then
  docker_ants ThresholdImage 3 "$LABEL1" "$GM_PROB" 1.5 2.5 1 0
fi

if [[ ! -f "$WM_PROB" ]]; then
  docker_ants ThresholdImage 3 "$LABEL2" "$WM_PROB" 2.5 3.5 1 0
fi

mkdir -p "$PRIORS_DIR"
if [[ ! -f "${PRIORS_DIR}/priors6.nii.gz" ]]; then
  docker_ants Atropos \
    -d 3 \
    -a "$T1_RES" \
    -x "$MASK" \
    -i "kmeans[6]" \
    -c "[3,0.001]" \
    -m "[0.1,1x1x1]" \
    -o "[${PRIORS_DIR}/priors_seg.nii.gz,${PRIORS_DIR}/priors%d.nii.gz]"
fi

cat >"${JOB_DIR}/DenoiseImage.yml" <<EOF
input_image:
  class: File
  path: "${T1_RES}"
output_prefix: "denoise"
dimensionality: 3
shrink_factor: 2
EOF
run_tool "DenoiseImage" "${JOB_DIR}/DenoiseImage.yml"

cat >"${JOB_DIR}/N4BiasFieldCorrection.yml" <<EOF
input_image:
  class: File
  path: "${T1_RES}"
output_prefix: "n4"
dimensionality: 3
shrink_factor: 2
convergence: "[20x10x0,0.0]"
EOF
run_tool "N4BiasFieldCorrection" "${JOB_DIR}/N4BiasFieldCorrection.yml"

cat >"${JOB_DIR}/ThresholdImage.yml" <<EOF
dimensionality: 3
input_image:
  class: File
  path: "${T1_RES}"
output_image: "threshold_mask.nii.gz"
threshold_low: 0.01
threshold_high: 100000
inside_value: 1
outside_value: 0
EOF
run_tool "ThresholdImage" "${JOB_DIR}/ThresholdImage.yml"

cat >"${JOB_DIR}/ImageMath.yml" <<EOF
dimensionality: 3
output_image: "imagemath_out.nii.gz"
operation: "m"
input_image:
  class: File
  path: "${T1_RES}"
scalar_value: 2
EOF
run_tool "ImageMath" "${JOB_DIR}/ImageMath.yml"

cat >"${JOB_DIR}/Atropos.yml" <<EOF
dimensionality: 3
intensity_image:
  class: File
  path: "${T1_RES}"
mask_image:
  class: File
  path: "${MASK}"
output_prefix: "atropos_seg.nii.gz"
initialization: "kmeans[2]"
convergence: "[3,0.001]"
mrf: "[0.1,1x1x1]"
EOF
run_tool "Atropos" "${JOB_DIR}/Atropos.yml"

cat >"${JOB_DIR}/antsAtroposN4.yml" <<EOF
dimensionality: 3
input_image:
  class: File
  path: "${T1_RES}"
mask_image:
  class: File
  path: "${MASK}"
output_prefix: "atroposn4_"
num_classes: 2
n4_atropos_iterations: 1
atropos_iterations: 3
EOF
run_tool "antsAtroposN4" "${JOB_DIR}/antsAtroposN4.yml"

cat >"${JOB_DIR}/antsBrainExtraction.yml" <<EOF
dimensionality: 3
anatomical_image:
  class: File
  path: "${T1_RES}"
template:
  class: File
  path: "${T1_RES}"
brain_probability_mask:
  class: File
  path: "${MASK}"
output_prefix: "brainextract_"
use_floatingpoint: true
EOF
run_tool "antsBrainExtraction" "${JOB_DIR}/antsBrainExtraction.yml"

cat >"${JOB_DIR}/antsCorticalThickness.yml" <<EOF
dimensionality: 3
anatomical_image:
  class: File
  path: "${T1_RES}"
template:
  class: File
  path: "${T1_RES}"
brain_probability_mask:
  class: File
  path: "${MASK}"
segmentation_priors: "priors%d.nii.gz"
segmentation_priors_dir:
  class: Directory
  basename: "priors"
  location: "file://${PRIORS_DIR}"
  listing: []
output_prefix: "cortical_"
quick_registration: true
run_stage: "1"
keep_temporary: true
EOF
run_tool "antsCorticalThickness" "${JOB_DIR}/antsCorticalThickness.yml"

cat >"${JOB_DIR}/antsIntermodalityIntrasubject.yml" <<EOF
dimensionality: 3
input_image:
  class: File
  path: "${BOLD_FIRST}"
reference_image:
  class: File
  path: "${T1_RES}"
output_prefix: "intermodal_"
brain_mask:
  class: File
  path: "${MASK}"
transform_type: "0"
EOF
run_tool "antsIntermodalityIntrasubject" "${JOB_DIR}/antsIntermodalityIntrasubject.yml"

cat >"${JOB_DIR}/antsJointLabelFusion.yml" <<EOF
dimensionality: 3
output_prefix: "jointfusion_"
target_image:
  class: File
  path: "${T1_RES}"
atlas_images:
  - class: File
    path: "${T1_RES}"
  - class: File
    path: "${T1_RES}"
atlas_labels:
  - class: File
    path: "${SEGMENTATION}"
  - class: File
    path: "${SEGMENTATION}"
mask_image:
  class: File
  path: "${MASK}"
parallel_control: 0
num_threads: 1
EOF
run_tool "antsJointLabelFusion" "${JOB_DIR}/antsJointLabelFusion.yml"

cat >"${JOB_DIR}/antsMotionCorr.yml" <<EOF
dimensionality: 3
fixed_image:
  class: File
  path: "${BOLD_FIRST}"
moving_image:
  class: File
  path: "${BOLD_SHORT}"
output_prefix: "motion_"
metric: "MI[{fixed},{moving},1,16,Regular,0.1]"
transform: "Rigid[0.1]"
iterations: "20x10x0"
shrink_factors: "2x1x1"
smoothing_sigmas: "1x0x0"
num_images: 5
EOF
run_tool "antsMotionCorr" "${JOB_DIR}/antsMotionCorr.yml"

cat >"${JOB_DIR}/antsRegistrationSyNQuick.yml" <<EOF
dimensionality: 3
fixed_image:
  class: File
  path: "${T1_RES}"
moving_image:
  class: File
  path: "${T1_RES}"
output_prefix: "synquick_"
transform_type: "r"
num_threads: 1
precision: "f"
reproducible: true
EOF
run_tool "antsRegistrationSyNQuick" "${JOB_DIR}/antsRegistrationSyNQuick.yml"

AFFINE_QUICK="${OUT_DIR}/antsRegistrationSyNQuick/synquick_0GenericAffine.mat"
if [[ -f "$AFFINE_QUICK" ]]; then
  cat >"${JOB_DIR}/antsApplyTransforms.yml" <<EOF
dimensionality: 3
input_image:
  class: File
  path: "${T1_RES}"
reference_image:
  class: File
  path: "${T1_RES}"
output_image: "applytransforms_out.nii.gz"
transforms:
  - class: File
    path: "${AFFINE_QUICK}"
EOF
  run_tool "antsApplyTransforms" "${JOB_DIR}/antsApplyTransforms.yml"
else
  skip_tool "antsApplyTransforms" "Missing affine from antsRegistrationSyNQuick"
fi

cat >"${JOB_DIR}/antsRegistration.yml" <<EOF
dimensionality: 3
output_prefix: "antsreg_"
fixed_image:
  class: File
  path: "${T1_RES}"
moving_image:
  class: File
  path: "${T1_RES}"
metric: "MI[{fixed},{moving},1,16,Regular,0.1]"
transform: "Rigid[0.1]"
convergence: "[20x10x0,1e-6,5]"
shrink_factors: "2x1x1"
smoothing_sigmas: "1x0x0vox"
use_float: true
EOF
run_tool "antsRegistration" "${JOB_DIR}/antsRegistration.yml"

cat >"${JOB_DIR}/antsRegistrationSyN.yml" <<EOF
dimensionality: 3
fixed_image:
  class: File
  path: "${T1_RES}"
moving_image:
  class: File
  path: "${T1_RES}"
output_prefix: "syn_"
transform_type: "r"
num_threads: 1
precision: "f"
reproducible: true
EOF
run_tool "antsRegistrationSyN" "${JOB_DIR}/antsRegistrationSyN.yml"

cat >"${JOB_DIR}/LabelGeometryMeasures.yml" <<EOF
dimensionality: 3
label_image:
  class: File
  path: "${SEGMENTATION}"
intensity_image: "none"
output_csv: "label_geometry.csv"
EOF
run_tool "LabelGeometryMeasures" "${JOB_DIR}/LabelGeometryMeasures.yml"

cat >"${JOB_DIR}/KellyKapowski.yml" <<EOF
dimensionality: 3
segmentation_image:
  class: File
  path: "${SEGMENTATION}"
gray_matter_prob:
  class: File
  path: "${GM_PROB}"
white_matter_prob:
  class: File
  path: "${WM_PROB}"
output_image: "thickness.nii.gz"
convergence: "[5,0.01,10]"
EOF
run_tool "KellyKapowski" "${JOB_DIR}/KellyKapowski.yml"

echo "ANTs verification complete."
echo "Summary: ${SUMMARY_FILE}"
