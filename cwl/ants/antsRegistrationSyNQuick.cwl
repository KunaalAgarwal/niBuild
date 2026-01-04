#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsRegistrationSyNQuick.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsRegistrationSyNQuick.sh'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: antsRegistrationSyNQuick.log
stderr: antsRegistrationSyNQuick.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  fixed_image:
    type: File
    label: Fixed/reference image
    inputBinding: {prefix: -f}
  moving_image:
    type: File
    label: Moving/target image to register
    inputBinding: {prefix: -m}
  output_prefix:
    type: string
    label: Output prefix for transform files
    inputBinding: {prefix: -o}

  # Optional parameters
  transform_type:
    type:
      - 'null'
      - type: enum
        symbols: [t, r, a, s, sr, so, b, br, bo]
    label: Transform type (t=translation, r=rigid, a=affine, s=SyN, b=b-spline SyN)
    inputBinding: {prefix: -t}
  num_threads:
    type: ['null', int]
    label: Number of threads
    inputBinding: {prefix: -n}
  precision:
    type:
      - 'null'
      - type: enum
        symbols: [f, d]
    label: Precision (f=float, d=double)
    inputBinding: {prefix: -p}
  masks:
    type: ['null', string]
    label: Mask images (fixedMask,movingMask)
    inputBinding: {prefix: -x}
  initial_transform:
    type: ['null', File]
    label: Initial transform
    inputBinding: {prefix: -i}
  histogram_matching:
    type: ['null', boolean]
    label: Use histogram matching
    inputBinding:
      prefix: -j
      valueFrom: '1'
  reproducible:
    type: ['null', boolean]
    label: Enable reproducible mode with fixed random seed
    inputBinding:
      prefix: -y
      valueFrom: '1'
  collapse_transforms:
    type: ['null', boolean]
    label: Collapse output transforms
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
  affine_transform:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)0GenericAffine.mat
  warp_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)1Warp.nii.gz
  inverse_warp_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)1InverseWarp.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsRegistrationSyNQuick.log
