#!/usr/bin/env bash
# Shared infrastructure for structural MRI CWL test scripts.
# Source this file at the top of every test_*.sh script.

set -uo pipefail
shopt -s nullglob

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]:-${BASH_SOURCE[0]}}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

CWL_DIR="${ROOT_DIR}/public/cwl"
JOB_DIR="${SCRIPT_DIR}/jobs"
OUT_DIR="${SCRIPT_DIR}/out"
LOG_DIR="${SCRIPT_DIR}/logs"
DATA_DIR="${SCRIPT_DIR}/data"
DERIVED_DIR="${SCRIPT_DIR}/derived"
SUMMARY_FILE="${SCRIPT_DIR}/summary.tsv"

# Docker images
FSL_IMAGE="${FSL_DOCKER_IMAGE:-brainlife/fsl:latest}"
ANTS_IMAGE="${ANTS_DOCKER_IMAGE:-fnndsc/ants:latest}"
FS_IMAGE="${FREESURFER_DOCKER_IMAGE:-freesurfer/freesurfer:7.4.1}"
AFNI_IMAGE="${AFNI_DOCKER_IMAGE:-brainlife/afni:latest}"

DOCKER_PLATFORM="${DOCKER_PLATFORM:-}"

# ANTs tuning
RES_MM="${ANTS_TEST_RES_MM:-6}"
ANTS_NUM_THREADS="${ANTS_NUM_THREADS:-1}"
ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS="${ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS:-1}"
export ANTS_NUM_THREADS ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS

# FreeSurfer license
LICENSE_FILE="${FS_LICENSE:-}"

CWLTOOL_BIN="${CWLTOOL_BIN:-cwltool}"
CWLTOOL_ARGS=()
RERUN_PASSED=0

for arg in "$@"; do
  case "$arg" in
    --rerun-passed|--rerun-all) RERUN_PASSED=1 ;;
  esac
done

# ── Utility functions ──────────────────────────────────────────────

die() { echo "ERROR: $1" >&2; exit 1; }

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    die "Missing required command: $1"
  fi
}

first_match() {
  local pattern
  for pattern in "$@"; do
    for f in $pattern; do
      echo "$f"
      return 0
    done
  done
  return 1
}

find_one() {
  local root="$1" pattern="$2"
  if [[ "$pattern" == */* ]]; then
    find "$root" -type f -path "*$pattern" | head -n1
  else
    find "$root" -type f -name "$pattern" | head -n1
  fi
}

setup_dirs() {
  mkdir -p "$JOB_DIR" "$OUT_DIR" "$LOG_DIR" "$DATA_DIR" "$DERIVED_DIR"
}

# ── Docker helpers ─────────────────────────────────────────────────

_docker_run() {
  local image="$1"; shift
  if [[ -n "$DOCKER_PLATFORM" ]]; then
    docker run --rm --platform "$DOCKER_PLATFORM" \
      -v "$ROOT_DIR":"$ROOT_DIR" -v "$SCRIPT_DIR":"$SCRIPT_DIR" \
      -w "$ROOT_DIR" "$image" "$@"
  else
    docker run --rm \
      -v "$ROOT_DIR":"$ROOT_DIR" -v "$SCRIPT_DIR":"$SCRIPT_DIR" \
      -w "$ROOT_DIR" "$image" "$@"
  fi
}

docker_fsl()  { _docker_run "$FSL_IMAGE"  "$@"; }
docker_ants() {
  _docker_run "$ANTS_IMAGE" \
    env ANTS_NUM_THREADS="$ANTS_NUM_THREADS" \
    ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS="$ITK_GLOBAL_DEFAULT_NUMBER_OF_THREADS" \
    "$@"
}
docker_fs() {
  if [[ -n "${LICENSE_FILE:-}" && -f "$LICENSE_FILE" ]]; then
    _docker_run "$FS_IMAGE" env FS_LICENSE="$LICENSE_FILE" "$@"
  else
    _docker_run "$FS_IMAGE" "$@"
  fi
}
docker_afni() { _docker_run "$AFNI_IMAGE" "$@"; }

copy_from_fsl_image() {
  local src_rel="$1" dest="$2"
  docker_fsl /bin/sh -c "
    for d in \"\${FSLDIR:-}\" /usr/local/fsl /usr/share/fsl /opt/fsl /usr/share/data/fsl-mni152-templates; do
      if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
        cp \"\$d/${src_rel}\" \"${dest}\"
        exit 0
      fi
    done
    # Also try the filename directly under template dirs
    local base=\$(basename \"${src_rel}\")
    for d in /usr/share/data/fsl-mni152-templates; do
      if [ -f \"\$d/\$base\" ]; then
        cp \"\$d/\$base\" \"${dest}\"
        exit 0
      fi
    done
    exit 1
  "
}

copy_from_fs_image() {
  local src_rel="$1" dest="$2"
  docker_fs /bin/sh -c "
    for d in \"\${FREESURFER_HOME:-}\" /opt/freesurfer /usr/local/freesurfer /usr/share/freesurfer; do
      if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
        cp \"\$d/${src_rel}\" \"${dest}\"
        exit 0
      fi
    done
    exit 1
  "
}

copy_from_afni_image() {
  local src_rel="$1" dest="$2"
  docker_afni /bin/sh -c "
    for d in \"\${AFNI_HOME:-}\" /opt/afni /usr/local/afni /usr/share/afni /usr/share/afni/atlases /usr/lib/afni; do
      if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
        cp \"\$d/${src_rel}\" \"${dest}\"
        exit 0
      fi
    done
    exit 1
  "
}

# ── CWL template generation ───────────────────────────────────────

make_template() {
  local cwl_file="$1" tool_name="$2"
  local tmpl="${JOB_DIR}/${tool_name}_template.yml"
  (cd /tmp && "$CWLTOOL_BIN" --make-template "$cwl_file") > "$tmpl" 2>/dev/null || true
}

# ── Verification & run ─────────────────────────────────────────────

verify_outputs() {
  local outputs_json="$1"
  python3 - "$outputs_json" <<'PY'
import json, os, sys
from urllib.parse import urlparse

with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)

paths = []
def add_path(p):
    if not p: return
    if p.startswith("file://"): p = urlparse(p).path
    paths.append(p)

def walk(obj):
    if obj is None: return
    if isinstance(obj, dict):
        if obj.get("class") in ("File", "Directory"):
            add_path(obj.get("path") or obj.get("location"))
        else:
            for v in obj.values(): walk(v)
    elif isinstance(obj, list):
        for v in obj: walk(v)

walk(data)
paths = [p for p in paths if p]
if not paths:
    print("no outputs found"); sys.exit(2)
missing = [p for p in paths if not os.path.exists(p)]
if missing:
    print("missing outputs:", ", ".join(missing)); sys.exit(3)

# Warn about empty array outputs (may indicate glob pattern mismatches)
empty_arrays = [k for k, v in data.items() if isinstance(v, list) and len(v) == 0]
if empty_arrays:
    print("WARNING: empty array outputs:", ", ".join(empty_arrays), file=sys.stderr)

print("ok")
PY
}

RUN_TOOL_STATUS=0

run_tool() {
  local name="$1" job_file="$2" cwl_file="$3"
  local tool_out_dir="${OUT_DIR}/${name}"
  local log_file="${LOG_DIR}/${name}.log"
  local out_json="${tool_out_dir}/outputs.json"
  local status="FAIL"

  mkdir -p "$tool_out_dir"

  echo "── ${name} ──────────────────────────────────"
  echo "  CWL:  ${cwl_file}"
  echo "  Job:  ${job_file}"

  # Validate (run from /tmp to avoid Docker+WSL os.getcwd() breakage)
  if ! (cd /tmp && "$CWLTOOL_BIN" --validate "$cwl_file") >>"$log_file" 2>&1; then
    echo "  Result: FAIL (CWL validation failed)"
    RUN_TOOL_STATUS=1
    echo -e "${name}\tFAIL" >>"$SUMMARY_FILE"
    return 0
  fi

  # Execute (run from /tmp to avoid Docker+WSL os.getcwd() breakage)
  if (cd /tmp && "$CWLTOOL_BIN" "${CWLTOOL_ARGS[@]}" --outdir "$tool_out_dir" "$cwl_file" "$job_file") \
      >"$out_json" 2>"$log_file"; then
    if verify_outputs "$out_json" >>"$log_file" 2>&1; then
      status="PASS"
    fi
  fi

  if [[ "$status" == "PASS" ]]; then
    RUN_TOOL_STATUS=0
    echo "  Result: PASS"
  else
    RUN_TOOL_STATUS=1
    echo "  Result: FAIL (see ${log_file})"
  fi
  echo -e "${name}\t${status}" >>"$SUMMARY_FILE"
  return 0
}

# ── Data preparation ───────────────────────────────────────────────

prepare_fsl_data() {
  local t1="${DATA_DIR}/MNI152_T1_1mm.nii.gz"
  local t1_2mm="${DATA_DIR}/MNI152_T1_2mm.nii.gz"
  local t1_brain="${DATA_DIR}/MNI152_T1_1mm_brain.nii.gz"
  local t1_2mm_brain="${DATA_DIR}/MNI152_T1_2mm_brain.nii.gz"
  local t1_mask="${DATA_DIR}/MNI152_T1_1mm_brain_mask.nii.gz"
  local t1_2mm_mask="${DATA_DIR}/MNI152_T1_2mm_brain_mask_dil.nii.gz"

  if [[ ! -f "$t1" ]]; then
    echo "Copying MNI152 from FSL container..."
    copy_from_fsl_image "data/standard/MNI152_T1_1mm.nii.gz" "$t1" || true
  fi
  if [[ ! -f "$t1_2mm" ]]; then
    copy_from_fsl_image "data/standard/MNI152_T1_2mm.nii.gz" "$t1_2mm" || true
  fi
  if [[ ! -f "$t1_brain" ]]; then
    copy_from_fsl_image "data/standard/MNI152_T1_1mm_brain.nii.gz" "$t1_brain" || true
  fi
  if [[ ! -f "$t1_2mm_brain" ]]; then
    copy_from_fsl_image "data/standard/MNI152_T1_2mm_brain.nii.gz" "$t1_2mm_brain" \
      || copy_from_fsl_image "data/fsl-mni152-templates/MNI152_T1_2mm_brain.nii.gz" "$t1_2mm_brain" \
      || true
  fi
  if [[ ! -f "$t1_mask" ]]; then
    copy_from_fsl_image "data/standard/MNI152_T1_1mm_brain_mask.nii.gz" "$t1_mask" || true
  fi
  if [[ ! -f "$t1_2mm_mask" ]]; then
    copy_from_fsl_image "data/standard/MNI152_T1_2mm_brain_mask_dil.nii.gz" "$t1_2mm_mask" || true
  fi

  # Export paths for scripts
  T1W="$t1"
  T1W_2MM="$t1_2mm"
  T1W_BRAIN="$t1_brain"
  T1W_2MM_BRAIN="$t1_2mm_brain"
  T1W_MASK="$t1_mask"
  T1W_2MM_MASK="$t1_2mm_mask"
}

prepare_ants_data() {
  prepare_fsl_data  # ANTs uses same MNI152 source

  local t1_res="${DERIVED_DIR}/t1_${RES_MM}mm.nii.gz"
  local mask="${DERIVED_DIR}/t1_mask.nii.gz"
  local mask_erode="${DERIVED_DIR}/t1_mask_erode.nii.gz"
  local label1_temp="${DERIVED_DIR}/label_gm_temp.nii.gz"
  local label1="${DERIVED_DIR}/label_gm.nii.gz"
  local label2="${DERIVED_DIR}/label_wm.nii.gz"
  local segmentation="${DERIVED_DIR}/segmentation.nii.gz"
  local gm_prob="${DERIVED_DIR}/gm_prob.nii.gz"
  local wm_prob="${DERIVED_DIR}/wm_prob.nii.gz"
  local priors_dir="${DERIVED_DIR}/priors"

  if [[ ! -f "$t1_res" ]]; then
    echo "Downsampling T1 to ${RES_MM}mm for ANTs tests..."
    docker_ants ResampleImage 3 "$T1W" "$t1_res" "${RES_MM}x${RES_MM}x${RES_MM}" 0 0
  fi
  if [[ ! -f "$mask" ]]; then
    docker_ants ThresholdImage 3 "$t1_res" "$mask" 0.01 100000 1 0
  fi
  if [[ ! -f "$mask_erode" ]]; then
    docker_ants ImageMath 3 "$mask_erode" ME "$mask" 1
  fi
  if [[ ! -f "$label1_temp" ]]; then
    docker_ants ImageMath 3 "$label1_temp" - "$mask" "$mask_erode"
  fi
  if [[ ! -f "$label1" ]]; then
    docker_ants ImageMath 3 "$label1" m "$label1_temp" 2
  fi
  if [[ ! -f "$label2" ]]; then
    docker_ants ImageMath 3 "$label2" m "$mask_erode" 3
  fi
  if [[ ! -f "$segmentation" ]]; then
    docker_ants ImageMath 3 "$segmentation" + "$label1" "$label2"
  fi
  if [[ ! -f "$gm_prob" ]]; then
    docker_ants ThresholdImage 3 "$label1" "$gm_prob" 1.5 2.5 1 0
  fi
  if [[ ! -f "$wm_prob" ]]; then
    docker_ants ThresholdImage 3 "$label2" "$wm_prob" 2.5 3.5 1 0
  fi

  mkdir -p "$priors_dir"
  if [[ ! -f "${priors_dir}/priors6.nii.gz" ]]; then
    docker_ants Atropos \
      -d 3 -a "$t1_res" -x "$mask" \
      -i "kmeans[6]" -c "[3,0.001]" -m "[0.1,1x1x1]" \
      -o "[${priors_dir}/priors_seg.nii.gz,${priors_dir}/priors%d.nii.gz]"
  fi

  T1_RES="$t1_res"
  ANTS_MASK="$mask"
  ANTS_SEGMENTATION="$segmentation"
  ANTS_GM_PROB="$gm_prob"
  ANTS_WM_PROB="$wm_prob"
  ANTS_PRIORS_DIR="$priors_dir"
}

prepare_freesurfer_data() {
  local fs_data_dir="${ROOT_DIR}/tests/data/freesurfer"
  local fs_subjects="${SCRIPT_DIR}/data/subjects"

  # License
  if [[ -z "$LICENSE_FILE" && -f "${fs_data_dir}/license.txt" ]]; then
    LICENSE_FILE="${fs_data_dir}/license.txt"
  fi
  if [[ -z "$LICENSE_FILE" || ! -f "$LICENSE_FILE" ]]; then
    die "FreeSurfer license not found. Set FS_LICENSE or place license.txt at ${fs_data_dir}/license.txt"
  fi

  # Download bert if needed
  local src_bert="${ROOT_DIR}/tests/data/freesurfer/subjects/bert"
  if [[ ! -d "$src_bert" ]]; then
    "${ROOT_DIR}/utils/download_freesurfer_test_data.sh" || true
  fi
  if [[ ! -d "$src_bert" ]]; then
    die "bert subject not found at ${src_bert}"
  fi

  # Writable copy
  mkdir -p "$fs_subjects"
  if [[ ! -d "${fs_subjects}/bert" ]]; then
    cp -a "$src_bert" "${fs_subjects}/"
  fi

  # Copy classifier for mris_ca_label
  CLASSIFIER_GCS="${DERIVED_DIR}/lh.curvature.buckner40.filled.desikan_killiany.2010-03-25.gcs"
  if [[ ! -f "$CLASSIFIER_GCS" ]]; then
    copy_from_fs_image "average/lh.curvature.buckner40.filled.desikan_killiany.2010-03-25.gcs" "$CLASSIFIER_GCS" || true
  fi

  FS_SUBJECTS_DIR="$fs_subjects"
  FS_SUBJECT="bert"
  FS_SUBJECT_DIR="${fs_subjects}/bert"
  FS_LICENSE="$LICENSE_FILE"

  # Ensure sphere.reg alias exists
  local sphere_reg="${FS_SUBJECT_DIR}/surf/lh.sphere.reg"
  local sphere_reg_alias="${FS_SUBJECT_DIR}/surf/lh.${FS_SUBJECT}.sphere.reg"
  if [[ -f "$sphere_reg" && ! -f "$sphere_reg_alias" ]]; then
    cp "$sphere_reg" "$sphere_reg_alias"
  fi
}

prepare_afni_data() {
  prepare_fsl_data  # AFNI uses MNI152 T1 from FSL
}

# ── Initialization ─────────────────────────────────────────────────

# Resolve cwltool
if ! command -v "$CWLTOOL_BIN" >/dev/null 2>&1; then
  if [[ -x "${HOME}/miniconda3/bin/cwltool" ]]; then
    CWLTOOL_BIN="${HOME}/miniconda3/bin/cwltool"
  fi
fi

require_cmd "$CWLTOOL_BIN"
require_cmd docker
require_cmd python3

setup_dirs
