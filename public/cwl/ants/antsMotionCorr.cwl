#!/usr/bin/env cwl-runner

# https://manpages.ubuntu.com/manpages/bionic/man1/antsMotionCorr.1.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsMotionCorr'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

requirements:
  InlineJavascriptRequirement: {}

stdout: antsMotionCorr.log
stderr: antsMotionCorr.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  fixed_image:
    type: File
    label: Fixed/reference 3D image
  moving_image:
    type: File
    label: Moving 4D time series image
  output_prefix:
    type: string
    label: Output transform prefix
    inputBinding:
      prefix: -o
      valueFrom: '[$(self),$(self)_corrected.nii.gz,$(self)_avg.nii.gz]'

  # Metric specification
  metric:
    type: string
    label: Metric specification (e.g., MI[fixed,moving,1,32,Regular,0.1])
    inputBinding:
      prefix: -m
      valueFrom: $(self.replace("{fixed}", inputs.fixed_image.path).replace("{moving}", inputs.moving_image.path))
  transform:
    type: string
    label: Transform type (e.g., Rigid[0.1] or Affine[0.1])
    inputBinding: {prefix: -t}

  # Multi-resolution parameters
  iterations:
    type: string
    label: Iterations at each level (e.g., 100x50x30)
    inputBinding: {prefix: -i}
  shrink_factors:
    type: string
    label: Shrink factors at each level (e.g., 4x2x1)
    inputBinding: {prefix: -f}
  smoothing_sigmas:
    type: string
    label: Smoothing sigmas at each level (e.g., 2x1x0)
    inputBinding: {prefix: -s}

  # Optional parameters
  num_images:
    type: ['null', int]
    label: Number of images to use from time series
    inputBinding: {prefix: -n}
  use_fixed_reference:
    type: ['null', boolean]
    label: Use fixed reference for all time points
    inputBinding:
      prefix: -u
      valueFrom: '1'
  use_scale_estimator:
    type: ['null', boolean]
    label: Use scale estimator
    inputBinding:
      prefix: -e
      valueFrom: '1'
  write_displacement:
    type: ['null', boolean]
    label: Write 4D displacement field
    inputBinding:
      prefix: -w
      valueFrom: '1'
  average_image:
    type: ['null', boolean]
    label: Average the input time series
    inputBinding: {prefix: -a}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'

outputs:
  corrected_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)_corrected.nii.gz
  average_image:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)_avg.nii.gz
  motion_parameters:
    type: File[]
    outputBinding:
      glob: $(inputs.output_prefix)MOCOparams.csv
  displacement_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)Warp.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsMotionCorr.log
