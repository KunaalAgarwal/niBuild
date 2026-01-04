#!/usr/bin/env cwl-runner

# https://manpages.ubuntu.com/manpages/focal/man1/antsApplyTransforms.1.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsApplyTransforms'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: antsApplyTransforms.log
stderr: antsApplyTransforms.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {prefix: -d}
  input_image:
    type: File
    label: Input image to transform
    inputBinding: {prefix: -i}
  reference_image:
    type: File
    label: Reference image defining output space
    inputBinding: {prefix: -r}
  output_image:
    type: string
    label: Output transformed image filename
    inputBinding: {prefix: -o}

  # Transform specification
  transforms:
    type: File[]
    label: Transform files (applied in reverse order - last specified first)
    inputBinding:
      prefix: -t
      separate: true

  # Optional parameters
  interpolation:
    type:
      - 'null'
      - type: enum
        symbols: [Linear, NearestNeighbor, Gaussian, BSpline, CosineWindowedSinc, WelchWindowedSinc, HammingWindowedSinc, LanczosWindowedSinc, GenericLabel, MultiLabel]
    label: Interpolation method
    inputBinding: {prefix: -n}
  default_value:
    type: ['null', double]
    label: Default voxel value for out-of-bounds points
    inputBinding: {prefix: -f}
  input_image_type:
    type:
      - 'null'
      - type: enum
        symbols: ['0', '1', '2', '3']
    label: Input image type (0=scalar, 1=vector, 2=tensor, 3=time-series)
    inputBinding: {prefix: -e}
  use_float:
    type: ['null', boolean]
    label: Use float instead of double for computations
    inputBinding: {prefix: --float}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'

outputs:
  transformed_image:
    type: File
    outputBinding:
      glob: $(inputs.output_image)
  log:
    type: File
    outputBinding:
      glob: antsApplyTransforms.log
