#!/usr/bin/env cwl-runner

# https://manpages.debian.org/experimental/ants/DenoiseImage.1.en.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'DenoiseImage'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

stdout: DenoiseImage.log
stderr: DenoiseImage.log

inputs:
  input_image:
    type: File
    label: Input image for denoising
    inputBinding: {prefix: -i}
  output_prefix:
    type: string
    label: Output image prefix
    inputBinding:
      prefix: -o
      valueFrom: $(self)_denoised.nii.gz
  dimensionality:
    type: ['null', int]
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {prefix: -d}

  # Optional parameters
  noise_model:
    type:
      - 'null'
      - type: enum
        symbols: [Rician, Gaussian]
    label: Noise model to employ
    inputBinding: {prefix: -n}
  mask_image:
    type: ['null', File]
    label: Mask image to limit denoising region
    inputBinding: {prefix: -x}
  shrink_factor:
    type: ['null', int]
    label: Shrink factor for faster processing (default 1)
    inputBinding: {prefix: -s}
  patch_radius:
    type: ['null', string]
    label: Patch radius (e.g., 1 or 1x1x1)
    inputBinding: {prefix: -p}
  search_radius:
    type: ['null', string]
    label: Search radius (e.g., 3 or 3x3x3)
    inputBinding: {prefix: -r}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'

outputs:
  denoised_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)_denoised.nii.gz
  noise_image:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)_noise.nii.gz
  log:
    type: File
    outputBinding:
      glob: DenoiseImage.log
