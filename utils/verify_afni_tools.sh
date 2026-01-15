#!/usr/bin/env bash
set -uo pipefail
shopt -s nullglob

# One-command verification for all AFNI CWL tools.
# Usage: scripts/verify_afni_tools.sh [--rerun-passed|--rerun-all]
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
#   tests/work/afni/{jobs,out,logs,derived,summary.tsv}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${AFNI_TEST_DATA_DIR:-$ROOT_DIR/tests/data/openneuro}"
WORK_DIR="${AFNI_TEST_WORK_DIR:-$ROOT_DIR/tests/work/afni}"
JOB_DIR="${WORK_DIR}/jobs"
OUT_DIR="${WORK_DIR}/out"
LOG_DIR="${WORK_DIR}/logs"
DERIVED_DIR="${WORK_DIR}/derived"
SUMMARY_FILE="${WORK_DIR}/summary.tsv"
CWL_DIR="${ROOT_DIR}/public/cwl/afni"
AFNI_IMAGE="${AFNI_DOCKER_IMAGE:-brainlife/afni:latest}"
AFNI_TEST_IMAGE="${AFNI_TEST_IMAGE:-fmribuild/afni-test:latest}"
DOCKER_PLATFORM="${AFNI_DOCKER_PLATFORM:-}"
RES_MM="${AFNI_TEST_RES_MM:-6}"
AFNI_OUTPUT_TYPE="${AFNI_OUTPUT_TYPE:-BRIK}"
CWLTOOL_BIN="${CWLTOOL_BIN:-cwltool}"
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

if [[ "${AFNI_DISABLE_PULL:-1}" -eq 1 ]]; then
  CWLTOOL_ARGS+=(--disable-pull)
fi
CWLTOOL_ARGS+=(--preserve-environment AFNI_OUTPUT_TYPE)
export AFNI_OUTPUT_TYPE

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
  local root="$1"
  local pattern="$2"
  if [[ "$pattern" == */* ]]; then
    find "$root" -type f -path "*$pattern" | head -n1
  else
    find "$root" -type f -name "$pattern" | head -n1
  fi
}

docker_afni() {
  if [[ -n "$DOCKER_PLATFORM" ]]; then
    docker run --rm \
      --platform "$DOCKER_PLATFORM" \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$AFNI_IMAGE" "$@"
  else
    docker run --rm \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$AFNI_IMAGE" "$@"
  fi
}

ensure_image() {
  local image="$1"
  local mode="$2"
  if docker image inspect "$image" >/dev/null 2>&1; then
    return 0
  fi

  case "$mode" in
    pull)
      if ! docker pull "$image"; then
        die "Failed to pull ${image}"
      fi
      ;;
    build)
      if ! AFNI_TEST_IMAGE="$image" "${ROOT_DIR}/scripts/build_afni_test_image.sh"; then
        die "Failed to build ${image}"
      fi
      ;;
    *)
      die "Unknown image mode: ${mode}"
      ;;
  esac
}

copy_from_afni_image() {
  local src_rel="$1"
  local dest="$2"
  local image="${3:-$AFNI_IMAGE}"

  if [[ -n "$DOCKER_PLATFORM" ]]; then
    docker run --rm \
      --platform "$DOCKER_PLATFORM" \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$image" /bin/sh -c "
        for d in \"\${AFNI_HOME:-}\" /opt/afni /usr/local/afni /usr/share/afni /usr/share/afni/atlases /usr/lib/afni; do
          if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
            cp \"\$d/${src_rel}\" \"${dest}\"
            exit 0
          fi
        done
        exit 1
      "
  else
    docker run --rm \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$image" /bin/sh -c "
        for d in \"\${AFNI_HOME:-}\" /opt/afni /usr/local/afni /usr/share/afni /usr/share/afni/atlases /usr/lib/afni; do
          if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
            cp \"\$d/${src_rel}\" \"${dest}\"
            exit 0
          fi
        done
        exit 1
      "
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

  if "$CWLTOOL_BIN" "${CWLTOOL_ARGS[@]}" --outdir "$out_dir" "$cwl_file" "$job_file" >"$out_json" 2>"$log_file"; then
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

if ! command -v "$CWLTOOL_BIN" >/dev/null 2>&1; then
  if [[ -x "${HOME}/miniconda3/bin/cwltool" ]]; then
    CWLTOOL_BIN="${HOME}/miniconda3/bin/cwltool"
  else
    echo "Missing required command: cwltool" >&2
    exit 1
  fi
fi
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

ensure_image "$AFNI_IMAGE" pull
ensure_image "$AFNI_TEST_IMAGE" build

# Download data if missing.
if [[ ! -d "${DATA_DIR}/ds002979" ]]; then
  require_cmd aws
  "${ROOT_DIR}/utils/download_afni_test_data.sh"
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

AFNI_BOLD_CLIP_LEN="${AFNI_BOLD_CLIP_LEN:-20}"
BOLD_CLIP="${DERIVED_DIR}/bold_${AFNI_BOLD_CLIP_LEN}.nii.gz"
BOLD_CLIP_RES="${DERIVED_DIR}/bold_${AFNI_BOLD_CLIP_LEN}_${RES_MM}mm.nii.gz"
BOLD_MEAN="${DERIVED_DIR}/bold_${AFNI_BOLD_CLIP_LEN}_mean.nii.gz"
BOLD_MASK="${DERIVED_DIR}/bold_${AFNI_BOLD_CLIP_LEN}_mask.nii.gz"
ROI_MASK="${DERIVED_DIR}/roi_mask.nii.gz"
LME_MASK="${DERIVED_DIR}/lme_mask.nii.gz"
T1_RES="${DERIVED_DIR}/t1_${RES_MM}mm.nii.gz"
SSW_TEMPLATE="${DERIVED_DIR}/MNI152_2009_template_SSW.nii.gz"
SSW_TEMPLATE_RES="${DERIVED_DIR}/MNI152_2009_template_SSW_${RES_MM}mm.nii.gz"
SSW_TEMPLATE_MULTI="${DERIVED_DIR}/MNI152_2009_template_SSW_${RES_MM}mm_5vol.nii.gz"
AUTO_TLRC_BASE_HEAD="${DERIVED_DIR}/TT_N27+tlrc.HEAD"
AUTO_TLRC_RES_MM="${AFNI_AUTO_TLRC_RES_MM:-20}"
AUTO_TLRC_BASE_RES="${DERIVED_DIR}/TT_N27_${AUTO_TLRC_RES_MM}mm+tlrc.HEAD"
AUTO_TLRC_INPUT="${DERIVED_DIR}/t1_${AUTO_TLRC_RES_MM}mm.nii.gz"
STIM_1D="${DERIVED_DIR}/stim.1D"
COORDS_1D="${DERIVED_DIR}/coords.1D"

if [[ ! -f "$T1_RES" ]]; then
  docker_afni 3dresample -dxyz "$RES_MM" "$RES_MM" "$RES_MM" -prefix "$T1_RES" -input "$T1W"
fi

if [[ ! -f "$SSW_TEMPLATE" ]]; then
  if ! copy_from_afni_image "MNI152_2009_template_SSW.nii.gz" "$SSW_TEMPLATE" "$AFNI_IMAGE"; then
    if ! copy_from_afni_image "MNI152_2009_template_SSW.nii.gz" "$SSW_TEMPLATE" "$AFNI_TEST_IMAGE"; then
      if ! copy_from_afni_image "MNI152_2009_template.nii.gz" "$SSW_TEMPLATE" "$AFNI_IMAGE"; then
        if ! copy_from_afni_image "MNI152_2009_template.nii.gz" "$SSW_TEMPLATE" "$AFNI_TEST_IMAGE"; then
          if ! cp "$T1_RES" "$SSW_TEMPLATE"; then
            die "Could not create template fallback"
          fi
        fi
      fi
    fi
  fi
fi

if [[ ! -f "$SSW_TEMPLATE_RES" ]]; then
  docker_afni 3dresample -dxyz "$RES_MM" "$RES_MM" "$RES_MM" -prefix "$SSW_TEMPLATE_RES" -input "$SSW_TEMPLATE"
fi

if [[ ! -f "$SSW_TEMPLATE_MULTI" ]]; then
  docker_afni 3dTcat -prefix "$SSW_TEMPLATE_MULTI" \
    "$SSW_TEMPLATE_RES" "$SSW_TEMPLATE_RES" "$SSW_TEMPLATE_RES" "$SSW_TEMPLATE_RES" "$SSW_TEMPLATE_RES"
fi

if [[ ! -f "$AUTO_TLRC_BASE_HEAD" ]]; then
  if ! copy_from_afni_image "TT_N27+tlrc.HEAD" "$AUTO_TLRC_BASE_HEAD" "$AFNI_IMAGE"; then
    if ! copy_from_afni_image "TT_N27+tlrc.HEAD" "$AUTO_TLRC_BASE_HEAD" "$AFNI_TEST_IMAGE"; then
      die "Could not locate TT_N27+tlrc.HEAD in AFNI images"
    fi
  fi
fi

if [[ ! -f "${DERIVED_DIR}/TT_N27+tlrc.BRIK" && ! -f "${DERIVED_DIR}/TT_N27+tlrc.BRIK.gz" ]]; then
  if ! copy_from_afni_image "TT_N27+tlrc.BRIK.gz" "${DERIVED_DIR}/TT_N27+tlrc.BRIK.gz" "$AFNI_IMAGE"; then
    if ! copy_from_afni_image "TT_N27+tlrc.BRIK.gz" "${DERIVED_DIR}/TT_N27+tlrc.BRIK.gz" "$AFNI_TEST_IMAGE"; then
      if ! copy_from_afni_image "TT_N27+tlrc.BRIK" "${DERIVED_DIR}/TT_N27+tlrc.BRIK" "$AFNI_IMAGE"; then
        if ! copy_from_afni_image "TT_N27+tlrc.BRIK" "${DERIVED_DIR}/TT_N27+tlrc.BRIK" "$AFNI_TEST_IMAGE"; then
          die "Could not locate TT_N27+tlrc.BRIK(.gz) in AFNI images"
        fi
      fi
    fi
  fi
fi

if [[ ! -f "$AUTO_TLRC_BASE_RES" ]]; then
  docker_afni 3dresample -dxyz "$AUTO_TLRC_RES_MM" "$AUTO_TLRC_RES_MM" "$AUTO_TLRC_RES_MM" \
    -prefix "$AUTO_TLRC_BASE_RES" -input "$AUTO_TLRC_BASE_HEAD"
fi

if [[ ! -f "$AUTO_TLRC_INPUT" ]]; then
  docker_afni 3dresample -dxyz "$AUTO_TLRC_RES_MM" "$AUTO_TLRC_RES_MM" "$AUTO_TLRC_RES_MM" \
    -prefix "$AUTO_TLRC_INPUT" -input "$T1W"
fi

if [[ ! -f "$BOLD_CLIP" ]]; then
  docker_afni 3dTcat -prefix "$BOLD_CLIP" "${BOLD}[0..$((AFNI_BOLD_CLIP_LEN-1))]"
fi

if [[ ! -f "$BOLD_CLIP_RES" ]]; then
  docker_afni 3dresample -dxyz "$RES_MM" "$RES_MM" "$RES_MM" -prefix "$BOLD_CLIP_RES" -input "$BOLD_CLIP"
fi

if [[ ! -f "$BOLD_MEAN" ]]; then
  docker_afni 3dTstat -mean -prefix "$BOLD_MEAN" "$BOLD_CLIP_RES"
fi

if [[ ! -f "$BOLD_MASK" ]]; then
  docker_afni 3dAutomask -prefix "$BOLD_MASK" "$BOLD_MEAN"
fi

docker_afni 3dcalc -overwrite -a "$BOLD_MASK" -expr 'step(a)*(1+ispositive(i-2))' -prefix "$ROI_MASK"

docker_afni 3dmaskdump -nozero "$BOLD_MASK" | head -n 10 >"${DERIVED_DIR}/lme_coord.1D"
if [[ ! -s "${DERIVED_DIR}/lme_coord.1D" ]]; then
  die "Could not find voxels in ${BOLD_MASK} for LME mask"
fi
docker_afni 3dUndump -overwrite -ijk -master "$BOLD_MASK" -prefix "$LME_MASK" "${DERIVED_DIR}/lme_coord.1D"

regen_stim=1
if [[ -f "$STIM_1D" ]]; then
  stim_lines="$(wc -l <"$STIM_1D" | tr -d ' ')"
  if [[ "$stim_lines" == "$AFNI_BOLD_CLIP_LEN" ]]; then
    regen_stim=0
  fi
fi
if [[ "$regen_stim" -eq 1 ]]; then
  python3 - "$STIM_1D" "$AFNI_BOLD_CLIP_LEN" <<'PY'
import sys
out = sys.argv[1]
length = int(sys.argv[2])
values = [(i % 2) for i in range(length)]
with open(out, "w", encoding="utf-8") as f:
    for v in values:
        f.write(f"{v}\n")
PY
fi

if [[ ! -f "$COORDS_1D" ]]; then
  python3 - "$COORDS_1D" <<'PY'
import sys
out = sys.argv[1]
with open(out, "w", encoding="utf-8") as f:
    f.write("0 0 0\n")
    f.write("1 1 1\n")
    f.write("2 2 2\n")
PY
fi

make_const() {
  local out="$1"
  local val="$2"
  docker_afni 3dcalc -overwrite -a "$BOLD_MEAN" -expr "a*0+${val}" -prefix "$out"
}

ANOVA_1="${DERIVED_DIR}/anova_1.nii.gz"
ANOVA_2="${DERIVED_DIR}/anova_2.nii.gz"
ANOVA_3="${DERIVED_DIR}/anova_3.nii.gz"
ANOVA_4="${DERIVED_DIR}/anova_4.nii.gz"
ANOVA_5="${DERIVED_DIR}/anova_5.nii.gz"
ANOVA_6="${DERIVED_DIR}/anova_6.nii.gz"
ANOVA_7="${DERIVED_DIR}/anova_7.nii.gz"
ANOVA_8="${DERIVED_DIR}/anova_8.nii.gz"
ANOVA_9="${DERIVED_DIR}/anova_9.nii.gz"
ANOVA_10="${DERIVED_DIR}/anova_10.nii.gz"
ANOVA_11="${DERIVED_DIR}/anova_11.nii.gz"
ANOVA_12="${DERIVED_DIR}/anova_12.nii.gz"
ANOVA_13="${DERIVED_DIR}/anova_13.nii.gz"
ANOVA_14="${DERIVED_DIR}/anova_14.nii.gz"
ANOVA_15="${DERIVED_DIR}/anova_15.nii.gz"
ANOVA_16="${DERIVED_DIR}/anova_16.nii.gz"

make_const "$ANOVA_1" 1
make_const "$ANOVA_2" 2
make_const "$ANOVA_3" 3
make_const "$ANOVA_4" 4
make_const "$ANOVA_5" 5
make_const "$ANOVA_6" 6
make_const "$ANOVA_7" 7
make_const "$ANOVA_8" 8
make_const "$ANOVA_9" 9
make_const "$ANOVA_10" 10
make_const "$ANOVA_11" 11
make_const "$ANOVA_12" 12
make_const "$ANOVA_13" 13
make_const "$ANOVA_14" 14
make_const "$ANOVA_15" 15
make_const "$ANOVA_16" 16

SUBJ1_A="$ANOVA_1"
SUBJ1_B="$ANOVA_2"
SUBJ2_A="$ANOVA_3"
SUBJ2_B="$ANOVA_4"

BETA1="${DERIVED_DIR}/mema_beta1.nii.gz"
BETA2="${DERIVED_DIR}/mema_beta2.nii.gz"
TSTAT1="${DERIVED_DIR}/mema_t1.nii.gz"
TSTAT2="${DERIVED_DIR}/mema_t2.nii.gz"
make_const "$BETA1" 0.5
make_const "$BETA2" 0.8
make_const "$TSTAT1" 2
make_const "$TSTAT2" 3

LME_TABLE="${DERIVED_DIR}/lme_table.txt"
MVM_TABLE="${DERIVED_DIR}/mvm_table.txt"
ANOVA_1_BASE="$(basename "$ANOVA_1")"
ANOVA_2_BASE="$(basename "$ANOVA_2")"
ANOVA_3_BASE="$(basename "$ANOVA_3")"
ANOVA_4_BASE="$(basename "$ANOVA_4")"

printf "Subj\tCond\tInputFile\nS1\tA\t%s\nS1\tB\t%s\nS2\tA\t%s\nS2\tB\t%s\n" \
  "$ANOVA_1_BASE" "$ANOVA_2_BASE" "$ANOVA_3_BASE" "$ANOVA_4_BASE" >"$LME_TABLE"

printf "Subj\tGroup\tCond\tInputFile\nS1\tG1\tA\t%s\nS1\tG1\tB\t%s\nS2\tG2\tA\t%s\nS2\tG2\tB\t%s\n" \
  "$ANOVA_1_BASE" "$ANOVA_2_BASE" "$ANOVA_3_BASE" "$ANOVA_4_BASE" >"$MVM_TABLE"

cat >"${JOB_DIR}/3dNetCorr.yml" <<EOF
prefix: "netcorr"
inset:
  class: File
  path: "${BOLD_CLIP_RES}"
in_rois:
  class: File
  path: "${ROI_MASK}"
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dNetCorr" "${JOB_DIR}/3dNetCorr.yml"

cat >"${JOB_DIR}/3dSkullStrip.yml" <<EOF
input:
  class: File
  path: "${T1_RES}"
prefix: "skullstrip"
niter: 5
EOF
run_tool "3dSkullStrip" "${JOB_DIR}/3dSkullStrip.yml"

cat >"${JOB_DIR}/3dANOVA.yml" <<EOF
levels: 2
dset:
  - level: 1
    dataset:
      class: File
      path: "${ANOVA_1}"
  - level: 1
    dataset:
      class: File
      path: "${ANOVA_2}"
  - level: 2
    dataset:
      class: File
      path: "${ANOVA_3}"
  - level: 2
    dataset:
      class: File
      path: "${ANOVA_4}"
ftr: "anova_ftr"
bucket: "anova_bucket"
EOF
run_tool "3dANOVA" "${JOB_DIR}/3dANOVA.yml"

cat >"${JOB_DIR}/3dDespike.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "despike"
EOF
run_tool "3dDespike" "${JOB_DIR}/3dDespike.yml"

cat >"${JOB_DIR}/SSwarper.yml" <<EOF
input:
  class: File
  path: "${T1_RES}"
base:
  class: File
  path: "${SSW_TEMPLATE_MULTI}"
subid: "sub016"
odir: "."
minp: 5
warpscale: 0.2
unifize_off: true
aniso_off: true
ceil_off: true
init_skullstr_off: true
extra_qc_off: true
skipwarp: true
EOF
run_tool "SSwarper" "${JOB_DIR}/SSwarper.yml"

cat >"${JOB_DIR}/3dTstat.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "tstat"
mean: true
EOF
run_tool "3dTstat" "${JOB_DIR}/3dTstat.yml"

cat >"${JOB_DIR}/3dLMEr.yml" <<EOF
prefix: "lmerr_out"
table:
  - subj: "S1"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ1_A}"
  - subj: "S1"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ1_B}"
  - subj: "S2"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ2_A}"
  - subj: "S2"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ2_B}"
model: "Cond+(1|Subj)"
mask:
  class: File
  path: "${LME_MASK}"
jobs: 1
EOF
run_tool "3dLMEr" "${JOB_DIR}/3dLMEr.yml"

cat >"${JOB_DIR}/3dQwarp.yml" <<EOF
source:
  class: File
  path: "${T1_RES}"
base:
  class: File
  path: "${SSW_TEMPLATE_RES}"
prefix: "qwarp_out"
allinfast: true
minpatch: 5
maxlev: 0
quiet: true
EOF
run_tool "3dQwarp" "${JOB_DIR}/3dQwarp.yml"

QWARP_WARP="$(first_match "${OUT_DIR}/3dQwarp/qwarp_out_WARP.nii*" "${OUT_DIR}/3dQwarp/qwarp_out_WARP+*.HEAD" "${OUT_DIR}/3dQwarp/qwarp_out_WARP+*.BRIK*")"

if [[ -n "$QWARP_WARP" ]]; then
  cat >"${JOB_DIR}/3dNwarpCat.yml" <<EOF
prefix: "nwarpcat_out"
warp1:
  class: File
  path: "${QWARP_WARP}"
EOF
  run_tool "3dNwarpCat" "${JOB_DIR}/3dNwarpCat.yml"

  cat >"${JOB_DIR}/3dNwarpApply.yml" <<EOF
nwarp:
  class: File
  path: "${QWARP_WARP}"
source:
  class: File
  path: "${T1_RES}"
prefix: "nwarp_apply"
interp: linear
EOF
  run_tool "3dNwarpApply" "${JOB_DIR}/3dNwarpApply.yml"
else
  skip_tool "3dNwarpCat" "Missing warp from 3dQwarp"
  skip_tool "3dNwarpApply" "Missing warp from 3dQwarp"
fi

cat >"${JOB_DIR}/3dFWHMx.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
mask:
  class: File
  path: "${BOLD_MASK}"
out: "fwhm_out.1D"
acf: "fwhm_acf.1D"
EOF
run_tool "3dFWHMx" "${JOB_DIR}/3dFWHMx.yml"

cat >"${JOB_DIR}/3dvolreg.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "volreg"
base: 0
oned_file: "volreg.1D"
EOF
run_tool "3dvolreg" "${JOB_DIR}/3dvolreg.yml"

cat >"${JOB_DIR}/3dTshift.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "tshift"
tpattern: "alt+z"
EOF
run_tool "3dTshift" "${JOB_DIR}/3dTshift.yml"

cat >"${JOB_DIR}/3dcopy.yml" <<EOF
old_dataset:
  class: File
  path: "${BOLD_MEAN}"
new_prefix: "copy_out"
EOF
run_tool "3dcopy" "${JOB_DIR}/3dcopy.yml"

cat >"${JOB_DIR}/3dDeconvolve.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
bucket: "deconvolve"
polort: "0"
num_stimts: 1
stim_file:
  - index: 1
    file:
      class: File
      path: "${STIM_1D}"
stim_label:
  - index: 1
    label: "stim"
x1D: "deconvolve.xmat.1D"
EOF
run_tool "3dDeconvolve" "${JOB_DIR}/3dDeconvolve.yml"

XMAT_FILE="$(first_match "${OUT_DIR}/3dDeconvolve"/*xmat*.1D "${OUT_DIR}/3dDeconvolve"/*.xmat.1D)"
if [[ -n "$XMAT_FILE" ]]; then
  cat >"${JOB_DIR}/3dREMLfit.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
matrix:
  class: File
  path: "${XMAT_FILE}"
Rbuck: "remlfit"
EOF
  run_tool "3dREMLfit" "${JOB_DIR}/3dREMLfit.yml"
else
  skip_tool "3dREMLfit" "Missing X-matrix from 3dDeconvolve"
fi

cat >"${JOB_DIR}/3dUndump.yml" <<EOF
input:
  class: File
  path: "${COORDS_1D}"
prefix: "undump"
master:
  class: File
  path: "${BOLD_MEAN}"
ijk: true
EOF
run_tool "3dUndump" "${JOB_DIR}/3dUndump.yml"

cat >"${JOB_DIR}/3dClustSim.yml" <<EOF
prefix: "clustsim"
mask:
  class: File
  path: "${BOLD_MASK}"
iter: 5
pthr: "0.05"
athr: "0.1"
quiet: true
EOF
run_tool "3dClustSim" "${JOB_DIR}/3dClustSim.yml"

cat >"${JOB_DIR}/3dTcat.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "tcat"
EOF
run_tool "3dTcat" "${JOB_DIR}/3dTcat.yml"

cat >"${JOB_DIR}/3dBandpass.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "bandpass"
fbot: 0.01
ftop: 0.1
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dBandpass" "${JOB_DIR}/3dBandpass.yml"

cat >"${JOB_DIR}/3dTcorr1D.yml" <<EOF
xset:
  class: File
  path: "${BOLD_CLIP_RES}"
y1D:
  class: File
  path: "${STIM_1D}"
prefix: "tcorr1d"
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dTcorr1D" "${JOB_DIR}/3dTcorr1D.yml"

cat >"${JOB_DIR}/3dZeropad.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
prefix: "zeropad"
I: 1
S: 1
EOF
run_tool "3dZeropad" "${JOB_DIR}/3dZeropad.yml"

cat >"${JOB_DIR}/3dmaskave.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dmaskave" "${JOB_DIR}/3dmaskave.yml"

cat >"${JOB_DIR}/3dAutomask.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
prefix: "automask"
EOF
run_tool "3dAutomask" "${JOB_DIR}/3dAutomask.yml"

cat >"${JOB_DIR}/3dMVM.yml" <<EOF
prefix: "mvm_out"
table:
  - subj: "S1"
    group: "G1"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ1_A}"
  - subj: "S1"
    group: "G1"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ1_B}"
  - subj: "S2"
    group: "G2"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ2_A}"
  - subj: "S2"
    group: "G2"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ2_B}"
bsVars: "Group"
wsVars: "Cond"
mask:
  class: File
  path: "${LME_MASK}"
jobs: 1
EOF
run_tool "3dMVM" "${JOB_DIR}/3dMVM.yml"

cat >"${JOB_DIR}/3dfractionize.yml" <<EOF
template:
  class: File
  path: "${T1_RES}"
input:
  class: File
  path: "${BOLD_MASK}"
prefix: "fractionize"
clip: 0.2
EOF
run_tool "3dfractionize" "${JOB_DIR}/3dfractionize.yml"

cat >"${JOB_DIR}/3dROIstats.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
mask:
  class: File
  path: "${ROI_MASK}"
EOF
run_tool "3dROIstats" "${JOB_DIR}/3dROIstats.yml"

cat >"${JOB_DIR}/3dmerge.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
prefix: "merge"
blur_fwhm: 4
EOF
run_tool "3dmerge" "${JOB_DIR}/3dmerge.yml"

cat >"${JOB_DIR}/3dinfo.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
short: true
EOF
run_tool "3dinfo" "${JOB_DIR}/3dinfo.yml"

cat >"${JOB_DIR}/whereami.yml" <<EOF
coord:
  - 0
  - 0
  - 0
EOF
run_tool "whereami" "${JOB_DIR}/whereami.yml"

cat >"${JOB_DIR}/3dUnifize.yml" <<EOF
input:
  class: File
  path: "${T1_RES}"
prefix: "unifize"
EOF
run_tool "3dUnifize" "${JOB_DIR}/3dUnifize.yml"

cat >"${JOB_DIR}/3dMEMA.yml" <<EOF
prefix: "mema_out"
set:
  - setname: "GroupA"
    subject: "S1"
    beta:
      class: File
      path: "${BETA1}"
    tstat:
      class: File
      path: "${TSTAT1}"
  - setname: "GroupA"
    subject: "S2"
    beta:
      class: File
      path: "${BETA2}"
    tstat:
      class: File
      path: "${TSTAT2}"
mask:
  class: File
  path: "${BOLD_MASK}"
jobs: 1
EOF
run_tool "3dMEMA" "${JOB_DIR}/3dMEMA.yml"

cat >"${JOB_DIR}/3dRSFC.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
prefix: "rsfc"
fbot: 0.01
ftop: 0.1
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dRSFC" "${JOB_DIR}/3dRSFC.yml"

cat >"${JOB_DIR}/3dresample.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
prefix: "resample"
dxyz:
  - 5
  - 5
  - 5
EOF
run_tool "3dresample" "${JOB_DIR}/3dresample.yml"

cat >"${JOB_DIR}/align_epi_anat.yml" <<EOF
epi:
  class: File
  path: "${BOLD_CLIP_RES}"
anat:
  class: File
  path: "${T1_RES}"
epi_base: "0"
epi2anat: true
volreg: "off"
tshift: "off"
anat_has_skull: "no"
epi_strip: "None"
deoblique: "off"
EOF
run_tool "align_epi_anat" "${JOB_DIR}/align_epi_anat.yml"

cat >"${JOB_DIR}/3dTcorrMap.yml" <<EOF
input:
  class: File
  path: "${BOLD_CLIP_RES}"
Mean: "tcorr_mean"
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dTcorrMap" "${JOB_DIR}/3dTcorrMap.yml"

cat >"${JOB_DIR}/3dttest++.yml" <<EOF
prefix: "ttest_out"
setA:
  - class: File
    path: "${BETA1}"
  - class: File
    path: "${BETA2}"
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
run_tool "3dttest++" "${JOB_DIR}/3dttest++.yml"

cat >"${JOB_DIR}/3dcalc.yml" <<EOF
a:
  class: File
  path: "${BOLD_MEAN}"
expr: "a*2"
prefix: "calc"
EOF
run_tool "3dcalc" "${JOB_DIR}/3dcalc.yml"

cat >"${JOB_DIR}/3dLME.yml" <<EOF
prefix: "lme_out"
table:
  - subj: "S1"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ1_A}"
  - subj: "S1"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ1_B}"
  - subj: "S2"
    cond: "A"
    input_file:
      class: File
      path: "${SUBJ2_A}"
  - subj: "S2"
    cond: "B"
    input_file:
      class: File
      path: "${SUBJ2_B}"
model: "Cond"
ranEff: "~1|Subj"
mask:
  class: File
  path: "${LME_MASK}"
jobs: 1
EOF
run_tool "3dLME" "${JOB_DIR}/3dLME.yml"

cat >"${JOB_DIR}/3dANOVA3.yml" <<EOF
type: 1
alevels: 2
blevels: 2
clevels: 2
dset:
  - alevel: 1
    blevel: 1
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_1}"
  - alevel: 1
    blevel: 1
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_9}"
  - alevel: 1
    blevel: 1
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_2}"
  - alevel: 1
    blevel: 1
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_10}"
  - alevel: 1
    blevel: 2
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_3}"
  - alevel: 1
    blevel: 2
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_11}"
  - alevel: 1
    blevel: 2
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_4}"
  - alevel: 1
    blevel: 2
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_12}"
  - alevel: 2
    blevel: 1
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_5}"
  - alevel: 2
    blevel: 1
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_13}"
  - alevel: 2
    blevel: 1
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_6}"
  - alevel: 2
    blevel: 1
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_14}"
  - alevel: 2
    blevel: 2
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_7}"
  - alevel: 2
    blevel: 2
    clevel: 1
    dataset:
      class: File
      path: "${ANOVA_15}"
  - alevel: 2
    blevel: 2
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_8}"
  - alevel: 2
    blevel: 2
    clevel: 2
    dataset:
      class: File
      path: "${ANOVA_16}"
fa: "anova3_fa"
fb: "anova3_fb"
fc: "anova3_fc"
bucket: "anova3_bucket"
EOF
run_tool "3dANOVA3" "${JOB_DIR}/3dANOVA3.yml"

cat >"${JOB_DIR}/3dAllineate.yml" <<EOF
source:
  class: File
  path: "${BOLD_MEAN}"
base:
  class: File
  path: "${T1_RES}"
prefix: "allineate"
warp: shift_rotate
onepass: true
oned_matrix_save: "allineate.aff12.1D"
EOF
run_tool "3dAllineate" "${JOB_DIR}/3dAllineate.yml"

cat >"${JOB_DIR}/auto_tlrc.yml" <<EOF
input:
  class: File
  path: "${AUTO_TLRC_INPUT}"
base:
  class: File
  path: "${AUTO_TLRC_BASE_RES}"
no_ss: true
maxite: 1
EOF
run_tool "auto_tlrc" "${JOB_DIR}/auto_tlrc.yml"

cat >"${JOB_DIR}/3dBlurToFWHM.yml" <<EOF
input:
  class: File
  path: "${BOLD_MEAN}"
prefix: "blur_to_fwhm"
FWHM: 4
maxite: 1
quiet: true
EOF
run_tool "3dBlurToFWHM" "${JOB_DIR}/3dBlurToFWHM.yml"

cat >"${JOB_DIR}/3dANOVA2.yml" <<EOF
type: 1
alevels: 2
blevels: 2
dset:
  - alevel: 1
    blevel: 1
    dataset:
      class: File
      path: "${ANOVA_1}"
  - alevel: 1
    blevel: 1
    dataset:
      class: File
      path: "${ANOVA_5}"
  - alevel: 1
    blevel: 2
    dataset:
      class: File
      path: "${ANOVA_2}"
  - alevel: 1
    blevel: 2
    dataset:
      class: File
      path: "${ANOVA_6}"
  - alevel: 2
    blevel: 1
    dataset:
      class: File
      path: "${ANOVA_3}"
  - alevel: 2
    blevel: 1
    dataset:
      class: File
      path: "${ANOVA_7}"
  - alevel: 2
    blevel: 2
    dataset:
      class: File
      path: "${ANOVA_4}"
  - alevel: 2
    blevel: 2
    dataset:
      class: File
      path: "${ANOVA_8}"
fa: "anova2_fa"
fb: "anova2_fb"
bucket: "anova2_bucket"
EOF
run_tool "3dANOVA2" "${JOB_DIR}/3dANOVA2.yml"

echo "AFNI verification complete."
echo "Summary: ${SUMMARY_FILE}"
