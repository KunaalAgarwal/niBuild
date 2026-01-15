#!/usr/bin/env bash
set -euo pipefail

# Build AFNI test image with R + required packages for 3dLME/3dLMEr/3dMVM/3dMEMA.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${AFNI_TEST_IMAGE:-fmribuild/afni-test:latest}"
DOCKERFILE_DIR="${ROOT_DIR}/docker/afni-test"

if [[ ! -f "${DOCKERFILE_DIR}/Dockerfile" ]]; then
  echo "Missing Dockerfile at ${DOCKERFILE_DIR}/Dockerfile" >&2
  exit 1
fi

docker build -t "${IMAGE_NAME}" "${DOCKERFILE_DIR}"

echo "Built ${IMAGE_NAME}"
