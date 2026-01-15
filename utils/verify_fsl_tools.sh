#!/usr/bin/env bash
set -uo pipefail
shopt -s nullglob

# One-command verification for all FSL CWL tools.
# Usage: scripts/verify_fsl_tools.sh [--rerun-passed]
#
# Requires:
# - cwltool
# - docker (to run FSL utilities for prep steps)
# - aws cli (only if data needs downloading)
#
# Data location (download script stores here by default):
#   tests/data/openneuro/<dataset-id>
#
# Outputs:
#   tests/work/fsl/{jobs,out,logs,derived,summary.tsv}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${FSL_TEST_DATA_DIR:-$ROOT_DIR/tests/data/openneuro}"
WORK_DIR="${FSL_TEST_WORK_DIR:-$ROOT_DIR/tests/work/fsl}"
JOB_DIR="${WORK_DIR}/jobs"
OUT_DIR="${WORK_DIR}/out"
LOG_DIR="${WORK_DIR}/logs"
DERIVED_DIR="${WORK_DIR}/derived"
SUMMARY_FILE="${WORK_DIR}/summary.tsv"
CWL_DIR="${ROOT_DIR}/public/cwl/fsl"
FSL_IMAGE="${FSL_DOCKER_IMAGE:-brainlife/fsl:latest}"
DOCKER_PLATFORM="${FSL_DOCKER_PLATFORM:-}"
RERUN_PASSED=0
PASS_CACHE_FILE=""

die() {
  echo "Error: $1" >&2
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --rerun-passed|--rerun-all)
      RERUN_PASSED=1
      ;;
    --help|-h)
      echo "Usage: $(basename "$0") [--rerun-passed]"
      exit 0
      ;;
    *)
      die "Unknown argument: ${arg}"
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

docker_fsl() {
  if [[ -n "$DOCKER_PLATFORM" ]]; then
    docker run --rm \
      --platform "$DOCKER_PLATFORM" \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$FSL_IMAGE" "$@"
  else
    docker run --rm \
      -v "$ROOT_DIR":"$ROOT_DIR" \
      -w "$ROOT_DIR" \
      "$FSL_IMAGE" "$@"
  fi
}

copy_from_fsl_image() {
  local src_rel="$1"
  local dest="$2"
  docker_fsl /bin/sh -c "
    for d in \"\${FSLDIR:-}\" /usr/local/fsl /usr/share/fsl /opt/fsl; do
      if [ -n \"\$d\" ] && [ -f \"\$d/${src_rel}\" ]; then
        cp \"\$d/${src_rel}\" \"${dest}\"
        exit 0
      fi
    done
    exit 1
  "
}

make_design_mat() {
  local out_file="$1"
  local num_points="$2"
  local num_waves="$3"
  python3 - "$out_file" "$num_points" "$num_waves" <<'PY'
import sys
out_file = sys.argv[1]
num_points = int(sys.argv[2])
num_waves = int(sys.argv[3])
with open(out_file, "w", encoding="utf-8") as f:
    f.write(f"/NumWaves {num_waves}\n")
    f.write(f"/NumPoints {num_points}\n")
    f.write("/PPheights " + " ".join(["1"] * num_waves) + "\n")
    f.write("/Matrix\n")
    for _ in range(num_points):
        f.write(" ".join(["1"] * num_waves) + "\n")
PY
}

make_contrast() {
  local out_file="$1"
  local num_waves="$2"
  python3 - "$out_file" "$num_waves" <<'PY'
import sys
out_file = sys.argv[1]
num_waves = int(sys.argv[2])
with open(out_file, "w", encoding="utf-8") as f:
    f.write("/ContrastName1 mean\n")
    f.write(f"/NumWaves {num_waves}\n")
    f.write("/NumContrasts 1\n")
    f.write("/Matrix\n")
    f.write(" ".join(["1"] * num_waves) + "\n")
PY
}

make_group_file() {
  local out_file="$1"
  local num_points="$2"
  python3 - "$out_file" "$num_points" <<'PY'
import sys
out_file = sys.argv[1]
num_points = int(sys.argv[2])
with open(out_file, "w", encoding="utf-8") as f:
    f.write("/NumWaves 1\n")
    f.write(f"/NumPoints {num_points}\n")
    f.write("/Matrix\n")
    for _ in range(num_points):
        f.write("1\n")
PY
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
if [[ ! -d "${DATA_DIR}/ds002979" || ! -d "${DATA_DIR}/ds003676" || ! -d "${DATA_DIR}/ds002185" ]]; then
  require_cmd aws
  "${ROOT_DIR}/utils/download_fsl_test_data.sh"
fi

# Locate key files.
DS1="${DATA_DIR}/ds002979"
DS2="${DATA_DIR}/ds003676"
DS3="${DATA_DIR}/ds002185"

T1W="$(find_one "$DS1" "*T1w*.nii*")"
BOLD="$(find_one "$DS1" "*bold*.nii*")"
BOLD_JSON="$(find_one "$DS1" "*bold*.json")"
BOLD_TR=""
if [[ -n "$BOLD_JSON" ]]; then
  BOLD_TR="$(python3 - "$BOLD_JSON" <<'PY' || true
import json
import sys
with open(sys.argv[1], "r", encoding="utf-8") as f:
    data = json.load(f)
tr = data.get("RepetitionTime")
if tr is None:
    tr = data.get("RepetitionTime".lower())
if tr is None:
    print("")
else:
    print(tr)
PY
)"
fi

T1W_3T="$(find_one "$DS2" "*ses-3T*/*T1w*.nii*")"
T1W_7T="$(find_one "$DS2" "*ses-7T*/*T1w*.nii*")"

DWI="$(find_one "$DS3" "*_dwi.nii*")"
BVEC="$(find_one "$DS3" "*_dwi.bvec")"
BVAL="$(find_one "$DS3" "*_dwi.bval")"

FMAP_AP="$(find_one "$DS1" "*dir-AP_epi.nii*")"
FMAP_PA="$(find_one "$DS1" "*dir-PA_epi.nii*")"
FMAP_AP_JSON="$(find_one "$DS1" "*dir-AP_epi.json")"
FMAP_PA_JSON="$(find_one "$DS1" "*dir-PA_epi.json")"

# Pull a standard template + FNIRT config from the FSL container (for stable FNIRT runs).
STANDARD_REF="${DERIVED_DIR}/MNI152_T1_2mm.nii.gz"
STANDARD_MASK="${DERIVED_DIR}/MNI152_T1_2mm_brain_mask_dil.nii.gz"
FNIRT_CONFIG="${DERIVED_DIR}/T1_2_MNI152_2mm.cnf"
FNIRT_CONFIG_PATCHED="${DERIVED_DIR}/T1_2_MNI152_2mm_patched.cnf"
TOPUP_CONFIG="${DERIVED_DIR}/b02b0.cnf"

if [[ ! -f "$STANDARD_REF" ]]; then
  if ! copy_from_fsl_image "data/standard/MNI152_T1_2mm.nii.gz" "$STANDARD_REF"; then
    STANDARD_REF=""
  fi
fi

if [[ -n "$STANDARD_REF" && ! -f "$STANDARD_MASK" ]]; then
  if ! copy_from_fsl_image "data/standard/MNI152_T1_2mm_brain_mask_dil.nii.gz" "$STANDARD_MASK"; then
    STANDARD_MASK=""
  fi
fi

if [[ ! -f "$FNIRT_CONFIG" ]]; then
  copy_from_fsl_image "etc/flirtsch/T1_2_MNI152_2mm.cnf" "$FNIRT_CONFIG" || true
fi

if [[ -f "$FNIRT_CONFIG" ]]; then
  python3 - "$FNIRT_CONFIG" "$FNIRT_CONFIG_PATCHED" <<'PY'
import sys

src, dst = sys.argv[1:]
with open(src, "r", encoding="utf-8") as f:
    lines = f.readlines()

out = []
for line in lines:
    stripped = line.strip()
    if stripped.startswith("--ref=") or stripped.startswith("--refmask="):
        continue
    out.append(line)

with open(dst, "w", encoding="utf-8") as f:
    f.writelines(out)
PY
fi

if [[ ! -f "$TOPUP_CONFIG" ]]; then
  copy_from_fsl_image "etc/flirtsch/b02b0.cnf" "$TOPUP_CONFIG" || true
fi

BET_OUT=""
BET_MASK=""
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/bet.yml" <<EOF
input:
  class: File
  path: "${T1W}"
output: "bet_out"
mask: true
EOF
  run_tool "bet" "${JOB_DIR}/bet.yml"
  BET_OUT="$(first_match "${OUT_DIR}/bet/bet_out.nii.gz" "${OUT_DIR}/bet/bet_out.nii")"
  BET_MASK="$(first_match "${OUT_DIR}/bet/bet_out_mask.nii.gz" "${OUT_DIR}/bet/bet_out_mask.nii")"
else
  skip_tool "bet" "missing T1w"
fi

# --- FSLMATHS (create constant image for later tools) ---
FSLMATHS_OUT=""
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/fslmaths.yml" <<EOF
input:
  class: File
  path: "${T1W}"
mul_value: 0
add_value: 1
output: "fslmaths_const"
EOF
  run_tool "fslmaths" "${JOB_DIR}/fslmaths.yml"
  FSLMATHS_OUT="$(first_match "${OUT_DIR}/fslmaths/fslmaths_const.nii.gz" "${OUT_DIR}/fslmaths/fslmaths_const.nii")"
else
  skip_tool "fslmaths" "missing T1w"
fi

# --- FSLSTATS ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/fslstats.yml" <<EOF
input:
  class: File
  path: "${T1W}"
mean: true
EOF
  run_tool "fslstats" "${JOB_DIR}/fslstats.yml"
else
  skip_tool "fslstats" "missing T1w"
fi

# --- FSLREORIENT2STD ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/fslreorient2std.yml" <<EOF
input:
  class: File
  path: "${T1W}"
output: "reorient_out"
EOF
  run_tool "fslreorient2std" "${JOB_DIR}/fslreorient2std.yml"
else
  skip_tool "fslreorient2std" "missing T1w"
fi

# --- FLIRT (produce affine for FNIRT/convertwarp) ---
FLIRT_MAT=""
if [[ -n "$T1W" ]]; then
  if [[ -z "$STANDARD_REF" ]]; then
    STANDARD_REF="$T1W"
  fi
  cat > "${JOB_DIR}/flirt.yml" <<EOF
input:
  class: File
  path: "${T1W}"
reference:
  class: File
  path: "${STANDARD_REF}"
output: "flirt_out"
output_matrix: "flirt_affine.mat"
EOF
  run_tool "flirt" "${JOB_DIR}/flirt.yml"
  FLIRT_MAT="$(first_match "${OUT_DIR}/flirt/flirt_affine.mat")"
else
  skip_tool "flirt" "missing T1w"
fi

# --- FNIRT ---
FNIRT_FIELD=""
if [[ -n "$T1W" ]]; then
  if [[ -z "$STANDARD_REF" ]]; then
    STANDARD_REF="$T1W"
  fi
  cat > "${JOB_DIR}/fnirt.yml" <<EOF
input:
  class: File
  path: "${T1W}"
reference:
  class: File
  path: "${STANDARD_REF}"
cout: "fnirt_coeff"
iout: "fnirt_warped"
fout: "fnirt_field"
EOF
  if [[ -n "$FLIRT_MAT" ]]; then
    cat >> "${JOB_DIR}/fnirt.yml" <<EOF
affine:
  class: File
  path: "${FLIRT_MAT}"
EOF
  fi
  if [[ -n "$STANDARD_MASK" ]]; then
    cat >> "${JOB_DIR}/fnirt.yml" <<EOF
refmask:
  class: File
  path: "${STANDARD_MASK}"
EOF
  fi
  if [[ -f "$FNIRT_CONFIG_PATCHED" && "${FSL_FNIRT_USE_CONFIG:-0}" == "1" ]]; then
    cat >> "${JOB_DIR}/fnirt.yml" <<EOF
config:
  class: File
  path: "${FNIRT_CONFIG_PATCHED}"
EOF
  fi
  run_tool "fnirt" "${JOB_DIR}/fnirt.yml"
  FNIRT_FIELD="$(first_match "${OUT_DIR}/fnirt/fnirt_field.nii.gz" "${OUT_DIR}/fnirt/fnirt_field.nii")"
else
  skip_tool "fnirt" "missing T1w"
fi

# --- CONVERTWARP (from fnirt warp + affine) ---
WARP_FIELD=""
if [[ -n "$FNIRT_FIELD" && -n "$FLIRT_MAT" ]]; then
  if [[ -z "$STANDARD_REF" ]]; then
    STANDARD_REF="$T1W"
  fi
  cat > "${JOB_DIR}/convertwarp.yml" <<EOF
reference:
  class: File
  path: "${STANDARD_REF}"
output: "convertwarp_out"
warp1:
  class: File
  path: "${FNIRT_FIELD}"
premat:
  class: File
  path: "${FLIRT_MAT}"
EOF
  run_tool "convertwarp" "${JOB_DIR}/convertwarp.yml"
  WARP_FIELD="$(first_match "${OUT_DIR}/convertwarp/convertwarp_out.nii.gz" "${OUT_DIR}/convertwarp/convertwarp_out.nii")"
else
  skip_tool "convertwarp" "missing fnirt field or affine"
fi

# --- APPLYWARP ---
if [[ -n "$WARP_FIELD" && -n "$T1W" ]]; then
  if [[ -z "$STANDARD_REF" ]]; then
    STANDARD_REF="$T1W"
  fi
  cat > "${JOB_DIR}/applywarp.yml" <<EOF
input:
  class: File
  path: "${T1W}"
reference:
  class: File
  path: "${STANDARD_REF}"
output: "applywarp_out"
warp:
  class: File
  path: "${WARP_FIELD}"
EOF
  run_tool "applywarp" "${JOB_DIR}/applywarp.yml"
else
  skip_tool "applywarp" "missing warp field or T1w"
fi

# --- INVWARP ---
if [[ -n "$WARP_FIELD" ]]; then
  if [[ -z "$STANDARD_REF" ]]; then
    STANDARD_REF="$T1W"
  fi
  cat > "${JOB_DIR}/invwarp.yml" <<EOF
warp:
  class: File
  path: "${WARP_FIELD}"
reference:
  class: File
  path: "${STANDARD_REF}"
output: "invwarp_out"
EOF
  run_tool "invwarp" "${JOB_DIR}/invwarp.yml"
else
  skip_tool "invwarp" "missing warp field"
fi

# --- FAST ---
if [[ -n "$BET_OUT" ]]; then
  cat > "${JOB_DIR}/fast.yml" <<EOF
input:
  class: File
  path: "${BET_OUT}"
output: "fast_out"
EOF
  run_tool "fast" "${JOB_DIR}/fast.yml"
else
  skip_tool "fast" "missing BET output"
fi

# --- RUN_FIRST_ALL ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/run_first_all.yml" <<EOF
input:
  class: File
  path: "${T1W}"
output: "first_out"
EOF
  run_tool "run_first_all" "${JOB_DIR}/run_first_all.yml"
else
  skip_tool "run_first_all" "missing T1w"
fi

# --- SIENAX ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/sienax.yml" <<EOF
input:
  class: File
  path: "${T1W}"
output_dir: "sienax_out"
EOF
  run_tool "sienax" "${JOB_DIR}/sienax.yml"
else
  skip_tool "sienax" "missing T1w"
fi

# --- FSL_ANAT (reduced runtime flags) ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/fsl_anat.yml" <<EOF
input:
  class: File
  path: "${T1W}"
output_dir: "fsl_anat_out"
noreorient: true
nocrop: true
nobias: true
noreg: true
nononlinreg: true
noseg: true
nosubcortseg: true
nocleanup: true
EOF
  run_tool "fsl_anat" "${JOB_DIR}/fsl_anat.yml"
else
  skip_tool "fsl_anat" "missing T1w"
fi

# --- MCFLIRT ---
if [[ -n "$BOLD" ]]; then
  cat > "${JOB_DIR}/mcflirt.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
output: "mcflirt_out"
EOF
  run_tool "mcflirt" "${JOB_DIR}/mcflirt.yml"
else
  skip_tool "mcflirt" "missing BOLD"
fi

# --- SLICETIMER ---
if [[ -n "$BOLD" ]]; then
  cat > "${JOB_DIR}/slicetimer.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
output: "slicetimer_out"
slice_order:
  interleaved: true
EOF
  if [[ -n "$BOLD_TR" ]]; then
    cat >> "${JOB_DIR}/slicetimer.yml" <<EOF
tr: ${BOLD_TR}
EOF
  fi
  run_tool "slicetimer" "${JOB_DIR}/slicetimer.yml"
else
  skip_tool "slicetimer" "missing BOLD"
fi

# --- SUSAN ---
if [[ -n "$T1W" ]]; then
  cat > "${JOB_DIR}/susan.yml" <<EOF
input:
  class: File
  path: "${T1W}"
brightness_threshold: 100
fwhm: 5
output: "susan_out"
EOF
  run_tool "susan" "${JOB_DIR}/susan.yml"
else
  skip_tool "susan" "missing T1w"
fi

# --- FSLROI ---
if [[ -n "$BOLD" ]]; then
  cat > "${JOB_DIR}/fslroi.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
output: "roi_out"
t_min: 0
t_size: 1
EOF
  run_tool "fslroi" "${JOB_DIR}/fslroi.yml"
else
  skip_tool "fslroi" "missing BOLD"
fi

# --- FSLSPLIT ---
SPLIT_FILES=()
if [[ -n "$BOLD" ]]; then
  cat > "${JOB_DIR}/fslsplit.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
output_basename: "bold_split"
dimension: t
EOF
  run_tool "fslsplit" "${JOB_DIR}/fslsplit.yml"
  SPLIT_FILES=( "${OUT_DIR}/fslsplit"/bold_split*.nii* )
  if [[ "${#SPLIT_FILES[@]}" -lt 2 ]]; then
    SPLIT_FILES=()
  fi
else
  skip_tool "fslsplit" "missing BOLD"
fi

# --- FSLMERGE ---
MERGED_4D=""
if [[ "${#SPLIT_FILES[@]}" -ge 2 ]]; then
  cat > "${JOB_DIR}/fslmerge.yml" <<EOF
dimension: t
output: "bold_merge"
input_files:
  - class: File
    path: "${SPLIT_FILES[0]}"
  - class: File
    path: "${SPLIT_FILES[1]}"
EOF
  run_tool "fslmerge" "${JOB_DIR}/fslmerge.yml"
  MERGED_4D="$(first_match "${OUT_DIR}/fslmerge/bold_merge.nii.gz" "${OUT_DIR}/fslmerge/bold_merge.nii")"
else
  skip_tool "fslmerge" "missing split volumes"
fi

# --- BOLD MEAN + MASK (for fslmeants/fugue) ---
BOLD_MEAN=""
BOLD_MASK=""
if [[ -n "$BOLD" ]]; then
  BOLD_MEAN="${DERIVED_DIR}/bold_mean.nii.gz"
  BOLD_MASK="${DERIVED_DIR}/bold_mean_brain_mask.nii.gz"
  docker_fsl fslmaths "${BOLD}" -Tmean "${BOLD_MEAN}" >/dev/null 2>&1 || true
  if [[ -f "$BOLD_MEAN" ]]; then
    docker_fsl bet "${BOLD_MEAN}" "${DERIVED_DIR}/bold_mean_brain" -m >/dev/null 2>&1 || true
  fi
  if [[ ! -f "$BOLD_MASK" ]]; then
    BOLD_MASK=""
  fi
fi

# --- FSLMEANTS ---
if [[ -n "$BOLD" && ( -n "$BOLD_MASK" || -n "$BET_MASK" ) ]]; then
  cat > "${JOB_DIR}/fslmeants.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
mask:
  class: File
  path: "${BOLD_MASK:-$BET_MASK}"
output: "meants.txt"
EOF
  run_tool "fslmeants" "${JOB_DIR}/fslmeants.yml"
else
  skip_tool "fslmeants" "missing BOLD or usable mask"
fi

# --- MELODIC ---
MELODIC_IC=""
if [[ -n "$BOLD" ]]; then
  cat > "${JOB_DIR}/melodic.yml" <<EOF
input_files:
  class: File
  path: "${BOLD}"
output_dir: "melodic_out"
dim: 5
EOF
  run_tool "melodic" "${JOB_DIR}/melodic.yml"
  MELODIC_IC="$(first_match "${OUT_DIR}/melodic/melodic_out/melodic_IC.nii.gz" "${OUT_DIR}/melodic/melodic_out/melodic_IC.nii")"
else
  skip_tool "melodic" "missing BOLD"
fi

# --- FILM_GLS ---
if [[ -n "$BOLD" ]]; then
  N_VOLS="$(docker_fsl fslnvols "${BOLD}" 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$N_VOLS" ]]; then
    FILM_DESIGN="${DERIVED_DIR}/film_gls.mat"
    make_design_mat "$FILM_DESIGN" "$N_VOLS" 1
    cat > "${JOB_DIR}/film_gls.yml" <<EOF
input:
  class: File
  path: "${BOLD}"
design_file:
  class: File
  path: "${FILM_DESIGN}"
results_dir: "film_gls_results"
EOF
    run_tool "film_gls" "${JOB_DIR}/film_gls.yml"
  else
    skip_tool "film_gls" "could not determine BOLD volume count"
  fi
else
  skip_tool "film_gls" "missing BOLD"
fi

# --- RANDOMISE (group 4D with 2 volumes) ---
if [[ -n "$MERGED_4D" ]]; then
  GROUP_POINTS=2
  GROUP_DESIGN="${DERIVED_DIR}/group.mat"
  GROUP_CON="${DERIVED_DIR}/group.con"
  make_design_mat "$GROUP_DESIGN" "$GROUP_POINTS" 1
  make_contrast "$GROUP_CON" 1
  cat > "${JOB_DIR}/randomise.yml" <<EOF
input:
  class: File
  path: "${MERGED_4D}"
output: "randomise_out"
design_mat:
  class: File
  path: "${GROUP_DESIGN}"
tcon:
  class: File
  path: "${GROUP_CON}"
num_perm: 10
EOF
  if [[ -n "$BOLD_MASK" ]]; then
    cat >> "${JOB_DIR}/randomise.yml" <<EOF
mask:
  class: File
  path: "${BOLD_MASK}"
EOF
  fi
  run_tool "randomise" "${JOB_DIR}/randomise.yml"
else
  skip_tool "randomise" "missing merged 4D input"
fi

# --- CLUSTER ---
CLUSTER_INPUT="$(first_match "${OUT_DIR}/randomise/randomise_out_tstat1.nii.gz" "${OUT_DIR}/randomise/randomise_out_tstat1.nii" "${FSLMATHS_OUT}")"
if [[ -n "$CLUSTER_INPUT" ]]; then
  cat > "${JOB_DIR}/cluster.yml" <<EOF
input:
  class: File
  path: "${CLUSTER_INPUT}"
threshold: 1.0
oindex: "cluster_index"
othresh: "cluster_thresh"
EOF
  run_tool "cluster" "${JOB_DIR}/cluster.yml"
else
  skip_tool "cluster" "missing cluster input"
fi

# --- DUAL_REGRESSION ---
if [[ -n "$MELODIC_IC" && -n "$BOLD" ]]; then
  DUALREG_DESIGN="${DERIVED_DIR}/dualreg.mat"
  DUALREG_CON="${DERIVED_DIR}/dualreg.con"
  make_design_mat "$DUALREG_DESIGN" 1 1
  make_contrast "$DUALREG_CON" 1
  cat > "${JOB_DIR}/dual_regression.yml" <<EOF
group_IC_maps:
  class: File
  path: "${MELODIC_IC}"
des_norm: 0
design_mat:
  class: File
  path: "${DUALREG_DESIGN}"
design_con:
  class: File
  path: "${DUALREG_CON}"
n_perm: 10
output_dir: "dualreg_out"
input_files:
  - class: File
    path: "${BOLD}"
EOF
  run_tool "dual_regression" "${JOB_DIR}/dual_regression.yml"
else
  skip_tool "dual_regression" "missing melodic ICs or BOLD"
fi

# --- FLAMEO ---
if [[ -n "$MERGED_4D" && ( -n "$BOLD_MASK" || -n "$BET_MASK" ) ]]; then
  FLAMEO_COVSPLIT="${DERIVED_DIR}/flameo.covsplit"
  make_group_file "$FLAMEO_COVSPLIT" "${GROUP_POINTS:-2}"
  cat > "${JOB_DIR}/flameo.yml" <<EOF
cope_file:
  class: File
  path: "${MERGED_4D}"
mask_file:
  class: File
  path: "${BOLD_MASK:-$BET_MASK}"
design_file:
  class: File
  path: "${GROUP_DESIGN}"
t_con_file:
  class: File
  path: "${GROUP_CON}"
cov_split_file:
  class: File
  path: "${FLAMEO_COVSPLIT}"
run_mode: ols
log_dir: "flameo_stats"
EOF
  run_tool "flameo" "${JOB_DIR}/flameo.yml"
else
  skip_tool "flameo" "missing merged 4D or usable mask"
fi

# --- TOPUP ---
if [[ -n "$FMAP_AP" && -n "$FMAP_PA" && -n "$FMAP_AP_JSON" && -n "$FMAP_PA_JSON" ]]; then
  TOPUP_IN="${DERIVED_DIR}/topup_input.nii.gz"
  AP_B0="${DERIVED_DIR}/fmap_ap_0.nii.gz"
  PA_B0="${DERIVED_DIR}/fmap_pa_0.nii.gz"
  docker_fsl fslroi "${FMAP_AP}" "${AP_B0}" 0 1 >/dev/null 2>&1 || true
  docker_fsl fslroi "${FMAP_PA}" "${PA_B0}" 0 1 >/dev/null 2>&1 || true

  if [[ -f "$AP_B0" && -f "$PA_B0" ]]; then
    docker_fsl fslmerge -t "${TOPUP_IN}" "${AP_B0}" "${PA_B0}" >/dev/null 2>&1 || true
    AP_VOLS=1
    PA_VOLS=1
  else
    docker_fsl fslmerge -t "${TOPUP_IN}" "${FMAP_AP}" "${FMAP_PA}" >/dev/null 2>&1 || true
    AP_VOLS="$(docker_fsl fslnvols "${FMAP_AP}" 2>/dev/null | tr -d '[:space:]' || true)"
    PA_VOLS="$(docker_fsl fslnvols "${FMAP_PA}" 2>/dev/null | tr -d '[:space:]' || true)"
  fi

  if [[ -z "$AP_VOLS" || "$AP_VOLS" -lt 1 ]]; then
    AP_VOLS=1
  fi
  if [[ -z "$PA_VOLS" || "$PA_VOLS" -lt 1 ]]; then
    PA_VOLS=1
  fi
  if [[ -f "$TOPUP_IN" ]]; then
    ACQPARAMS="${DERIVED_DIR}/acqparams.txt"
    python3 - "$FMAP_AP_JSON" "$FMAP_PA_JSON" "$ACQPARAMS" "$AP_VOLS" "$PA_VOLS" <<'PY'
import json
import sys

def parse_params(path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    ped = data.get("PhaseEncodingDirection")
    trt = data.get("TotalReadoutTime")
    if trt is None:
        trt = data.get("TotalReadoutTime".lower())
    if trt is None:
        trt = 0.05
    return ped, float(trt)

def ped_to_vec(ped):
    mapping = {
        "i": (1, 0, 0),
        "i-": (-1, 0, 0),
        "j": (0, 1, 0),
        "j-": (0, -1, 0),
        "k": (0, 0, 1),
        "k-": (0, 0, -1),
    }
    return mapping.get(ped, (0, 1, 0))

ap_ped, ap_trt = parse_params(sys.argv[1])
pa_ped, pa_trt = parse_params(sys.argv[2])
ap_n = int(sys.argv[4])
pa_n = int(sys.argv[5])

with open(sys.argv[3], "w", encoding="utf-8") as f:
    ap_vec = ped_to_vec(ap_ped)
    pa_vec = ped_to_vec(pa_ped)
    for _ in range(ap_n):
        f.write(f"{ap_vec[0]} {ap_vec[1]} {ap_vec[2]} {ap_trt}\n")
    for _ in range(pa_n):
        f.write(f"{pa_vec[0]} {pa_vec[1]} {pa_vec[2]} {pa_trt}\n")
PY
    cat > "${JOB_DIR}/topup.yml" <<EOF
input:
  class: File
  path: "${TOPUP_IN}"
encoding_file:
  class: File
  path: "${ACQPARAMS}"
output: "topup_out"
EOF
    if [[ -f "$TOPUP_CONFIG" ]]; then
      cat >> "${JOB_DIR}/topup.yml" <<EOF
config:
  class: File
  path: "${TOPUP_CONFIG}"
EOF
    fi
    cat >> "${JOB_DIR}/topup.yml" <<EOF
miter: "1"
subsamp: "1"
fwhm: "4"
EOF
    run_tool "topup" "${JOB_DIR}/topup.yml"
  else
    skip_tool "topup" "failed to build topup input"
  fi
else
  skip_tool "topup" "missing fmap AP/PA or JSON"
fi

# --- FUGUE ---
if [[ -n "$BOLD" && -n "$BOLD_MEAN" ]]; then
  FUGUE_SOURCE=""
  if [[ -f "$BOLD_MEAN" ]]; then
    FUGUE_SOURCE="$BOLD_MEAN"
  else
    FUGUE_SOURCE="${DERIVED_DIR}/fugue_source.nii.gz"
    docker_fsl fslroi "${BOLD}" "${FUGUE_SOURCE}" 0 1 >/dev/null 2>&1 || true
  fi

  FUGUE_INPUT="${DERIVED_DIR}/fugue_input.nii.gz"
  if [[ -f "$FUGUE_SOURCE" ]]; then
    docker_fsl fslmaths "${FUGUE_SOURCE}" -subsamp2 -subsamp2 "${FUGUE_INPUT}" >/dev/null 2>&1 || true
    if [[ ! -f "$FUGUE_INPUT" ]]; then
      cp "$FUGUE_SOURCE" "$FUGUE_INPUT"
    fi
  fi

  if [[ -f "$FUGUE_INPUT" ]]; then
    SHIFT_MAP="${DERIVED_DIR}/zero_shift.nii.gz"
    docker_fsl fslmaths "${FUGUE_INPUT}" -mul 0 "${SHIFT_MAP}" >/dev/null 2>&1 || true
    cat > "${JOB_DIR}/fugue.yml" <<EOF
input:
  class: File
  path: "${FUGUE_INPUT}"
loadshift:
  class: File
  path: "${SHIFT_MAP}"
unwarp: "fugue_unwarp"
dwell: 0.0005
unwarpdir: y
EOF
    run_tool "fugue" "${JOB_DIR}/fugue.yml"
  else
    skip_tool "fugue" "failed to create fugue input"
  fi
else
  skip_tool "fugue" "missing BOLD mean/shift map"
fi

# --- FSLMELODIC-DEPENDENT OUTPUTS already covered ---

# --- SIENA ---
if [[ -n "$T1W_3T" && -n "$T1W_7T" ]]; then
  SIENA_T1A="${DERIVED_DIR}/siena_t1a.nii.gz"
  SIENA_T1B="${DERIVED_DIR}/siena_t1b.nii.gz"
  SIENA_SUBSAMP="${FSL_SIENA_SUBSAMP:-7}"
  SIENA_SUBSAMP_ARGS=()
  for ((i=0; i<SIENA_SUBSAMP; i++)); do
    SIENA_SUBSAMP_ARGS+=("-subsamp2")
  done
  # Use aggressively downsampled T1s to keep runtime low.
  docker_fsl fslmaths "${T1W_3T}" "${SIENA_SUBSAMP_ARGS[@]}" "${SIENA_T1A}" >/dev/null 2>&1 || true
  docker_fsl fslmaths "${T1W_7T}" "${SIENA_SUBSAMP_ARGS[@]}" "${SIENA_T1B}" >/dev/null 2>&1 || true
  if [[ ! -f "$SIENA_T1A" ]]; then
    SIENA_T1A="$T1W_3T"
  fi
  if [[ ! -f "$SIENA_T1B" ]]; then
    SIENA_T1B="$T1W_7T"
  fi
  cat > "${JOB_DIR}/siena.yml" <<EOF
input1:
  class: File
  path: "${SIENA_T1A}"
input2:
  class: File
  path: "${SIENA_T1B}"
output_dir: "siena_out"
EOF
  run_tool "siena" "${JOB_DIR}/siena.yml"
else
  skip_tool "siena" "missing longitudinal T1w"
fi

# --- PROBTRACKX2 (requires bedpostx preprocessing) ---
if [[ -n "$DWI" && -n "$BVEC" && -n "$BVAL" ]]; then
  BEDPOSTX_DIR="${DERIVED_DIR}/bedpostx"
  mkdir -p "$BEDPOSTX_DIR"
  cp "$DWI" "${BEDPOSTX_DIR}/data.nii.gz"
  cp "$BVAL" "${BEDPOSTX_DIR}/bvals"
  cp "$BVEC" "${BEDPOSTX_DIR}/bvecs"

  # Create a basic brain mask for bedpostx.
  docker_fsl fslroi "${BEDPOSTX_DIR}/data.nii.gz" "${BEDPOSTX_DIR}/b0.nii.gz" 0 1 >/dev/null 2>&1 || true
  docker_fsl bet "${BEDPOSTX_DIR}/b0.nii.gz" "${BEDPOSTX_DIR}/nodif_brain" -m >/dev/null 2>&1 || true

  if docker_fsl bedpostx "${BEDPOSTX_DIR}" >/dev/null 2>&1; then
    BEDPOSTX_OUT="${BEDPOSTX_DIR}.bedpostX"
    SAMPLES_PATH="${BEDPOSTX_OUT}/merged"
    MASK_PATH="${BEDPOSTX_OUT}/nodif_brain_mask.nii.gz"
    if [[ -f "$MASK_PATH" ]]; then
      cat > "${JOB_DIR}/probtrackx2.yml" <<EOF
samples: "${SAMPLES_PATH}"
mask:
  class: File
  path: "${MASK_PATH}"
seed:
  class: File
  path: "${MASK_PATH}"
output_dir: "probtrackx_out"
EOF
      run_tool "probtrackx2" "${JOB_DIR}/probtrackx2.yml"
    else
      skip_tool "probtrackx2" "bedpostx outputs missing"
    fi
  else
    skip_tool "probtrackx2" "bedpostx failed"
  fi
else
  skip_tool "probtrackx2" "missing DWI/bvec/bval"
fi

PASS_COUNT="$(awk -F $'\t' 'NR>1 && $2=="PASS" {c++} END {print c+0}' "$SUMMARY_FILE")"
FAIL_COUNT="$(awk -F $'\t' 'NR>1 && $2=="FAIL" {c++} END {print c+0}' "$SUMMARY_FILE")"
SKIP_COUNT="$(awk -F $'\t' 'NR>1 && $2=="SKIP" {c++} END {print c+0}' "$SUMMARY_FILE")"

echo "Verification complete."
echo "Summary: ${SUMMARY_FILE}"
echo "Results: PASS=${PASS_COUNT} FAIL=${FAIL_COUNT} SKIP=${SKIP_COUNT}"
