#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FNIRT/UserGuide
# Apply warp fields to transform images

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'applywarp'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: applywarp.log
stderr: applywarp.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input image to be warped
    inputBinding:
      prefix: --in=
      separate: false
      position: 1
  reference:
    type: File
    label: Reference image
    inputBinding:
      prefix: --ref=
      separate: false
      position: 2
  output:
    type: string
    label: Output filename
    inputBinding:
      prefix: --out=
      separate: false
      position: 3

  # Warp field
  warp:
    type: ['null', File]
    label: Warp field file
    inputBinding:
      prefix: --warp=
      separate: false

  # Affine transforms
  premat:
    type: ['null', File]
    label: Pre-transform affine matrix (applied first)
    inputBinding:
      prefix: --premat=
      separate: false
  postmat:
    type: ['null', File]
    label: Post-transform affine matrix (applied last)
    inputBinding:
      prefix: --postmat=
      separate: false

  # Warp interpretation
  relwarp:
    type: ['null', boolean]
    label: Treat warp as relative (x' = x + w(x))
    inputBinding:
      prefix: --rel
  abswarp:
    type: ['null', boolean]
    label: Treat warp as absolute (x' = w(x))
    inputBinding:
      prefix: --abs

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [nn, trilinear, sinc, spline]
    label: Interpolation method
    inputBinding:
      prefix: --interp=
      separate: false

  # Supersampling
  supersample:
    type: ['null', boolean]
    label: Enable supersampling
    inputBinding:
      prefix: --super
  superlevel:
    type: ['null', string]
    label: Supersampling level (integer or 'a' for auto)
    inputBinding:
      prefix: --superlevel=
      separate: false

  # Masking
  mask:
    type: ['null', File]
    label: Mask in reference space
    inputBinding:
      prefix: --mask=
      separate: false

  # Data type
  datatype:
    type:
      - 'null'
      - type: enum
        symbols: [char, short, int, float, double]
    label: Output data type
    inputBinding:
      prefix: --datatype=
      separate: false

  padding_size:
    type: ['null', int]
    label: Padding size
    inputBinding:
      prefix: --paddingsize=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v

outputs:
  warped_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: applywarp.log
