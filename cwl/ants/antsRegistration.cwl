#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/wiki/Anatomy-of-an-antsRegistration-call

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsRegistration'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

requirements:
  InlineJavascriptRequirement: {}

stdout: antsRegistration.log
stderr: antsRegistration.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  output_prefix:
    type: string
    label: Output transform prefix
    inputBinding:
      prefix: -o
      valueFrom: '[$(self),$(self)Warped.nii.gz,$(self)InverseWarped.nii.gz]'

  # Fixed and moving images
  fixed_image:
    type: File
    label: Fixed/reference image
  moving_image:
    type: File
    label: Moving image to register

  # Stage-based registration parameters (simplified interface)
  # For advanced usage, users would specify full metric/transform strings
  metric:
    type: string
    label: Metric specification (e.g., MI[fixed,moving,1,32,Regular,0.25])
    inputBinding:
      prefix: -m
      valueFrom: $(self.replace("{fixed}", inputs.fixed_image.path).replace("{moving}", inputs.moving_image.path))
  transform:
    type: string
    label: Transform specification (e.g., Rigid[0.1])
    inputBinding: {prefix: -t}
  convergence:
    type: string
    label: Convergence specification (e.g., [1000x500x250x100,1e-6,10])
    inputBinding: {prefix: -c}
  shrink_factors:
    type: string
    label: Shrink factors per level (e.g., 8x4x2x1)
    inputBinding: {prefix: -f}
  smoothing_sigmas:
    type: string
    label: Smoothing sigmas per level (e.g., 3x2x1x0vox)
    inputBinding: {prefix: -s}

  # Optional parameters
  initial_moving_transform:
    type: ['null', File]
    label: Initial transform for moving image
    inputBinding: {prefix: -r}
  masks:
    type: ['null', string]
    label: Mask specification (fixedMask,movingMask or single mask)
    inputBinding: {prefix: -x}
  use_histogram_matching:
    type: ['null', boolean]
    label: Use histogram matching
    inputBinding:
      prefix: -u
      valueFrom: '1'
  winsorize_image_intensities:
    type: ['null', string]
    label: Winsorize intensities (e.g., [0.005,0.995])
    inputBinding: {prefix: -w}
  use_float:
    type: ['null', boolean]
    label: Use float precision instead of double
    inputBinding: {prefix: --float}
  interpolation:
    type:
      - 'null'
      - type: enum
        symbols: [Linear, NearestNeighbor, Gaussian, BSpline, CosineWindowedSinc, WelchWindowedSinc, HammingWindowedSinc, LanczosWindowedSinc]
    label: Interpolation method
    inputBinding: {prefix: -n}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'
  write_composite_transform:
    type: ['null', boolean]
    label: Write composite transform
    inputBinding:
      prefix: -z
      valueFrom: '1'

outputs:
  warped_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)Warped.nii.gz
  inverse_warped_image:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)InverseWarped.nii.gz
  forward_transforms:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output_prefix)*GenericAffine.mat
        - $(inputs.output_prefix)*Warp.nii.gz
  inverse_transforms:
    type: File[]
    outputBinding:
      glob: $(inputs.output_prefix)*InverseWarp.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsRegistration.log
