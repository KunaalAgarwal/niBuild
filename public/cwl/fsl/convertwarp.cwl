#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FNIRT/UserGuide
# Combine or convert between warp formats

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'convertwarp'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: convertwarp.log
stderr: convertwarp.log

inputs:
  # Required inputs
  reference:
    type: File
    label: Reference image in target space
    inputBinding:
      prefix: --ref=
      separate: false
      position: 1
  output:
    type: string
    label: Output warp filename
    inputBinding:
      prefix: --out=
      separate: false
      position: 2

  # Input warps
  warp1:
    type: ['null', File]
    label: First warp field
    inputBinding:
      prefix: --warp1=
      separate: false
  warp2:
    type: ['null', File]
    label: Second warp field (applied after warp1)
    inputBinding:
      prefix: --warp2=
      separate: false

  # Affine transforms
  premat:
    type: ['null', File]
    label: Pre-transform affine matrix (applied first)
    inputBinding:
      prefix: --premat=
      separate: false
  midmat:
    type: ['null', File]
    label: Mid-warp affine transform
    inputBinding:
      prefix: --midmat=
      separate: false
  postmat:
    type: ['null', File]
    label: Post-transform affine matrix (applied last)
    inputBinding:
      prefix: --postmat=
      separate: false

  # Shift map (for fieldmap-based corrections)
  shiftmap:
    type: ['null', File]
    label: Shift map (fieldmap) file
    inputBinding:
      prefix: --shiftmap=
      separate: false
  shiftdir:
    type:
      - 'null'
      - type: enum
        symbols: [x, y, z, x-, y-, z-]
    label: Shift direction
    inputBinding:
      prefix: --shiftdir=
      separate: false

  # Warp interpretation (input)
  abswarp:
    type: ['null', boolean]
    label: Treat input warps as absolute
    inputBinding:
      prefix: --absout
  relwarp:
    type: ['null', boolean]
    label: Treat input warps as relative
    inputBinding:
      prefix: --relout

  # Output format
  out_abswarp:
    type: ['null', boolean]
    label: Output warp as absolute
    inputBinding:
      prefix: --absout
  out_relwarp:
    type: ['null', boolean]
    label: Output warp as relative
    inputBinding:
      prefix: --relout

  # Jacobian constraints
  cons_jacobian:
    type: ['null', boolean]
    label: Constrain Jacobian
    inputBinding:
      prefix: --constrainj
  jacobian_min:
    type: ['null', double]
    label: Minimum Jacobian
    inputBinding:
      prefix: --jmin=
      separate: false
  jacobian_max:
    type: ['null', double]
    label: Maximum Jacobian
    inputBinding:
      prefix: --jmax=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: --verbose

outputs:
  combined_warp:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: convertwarp.log
