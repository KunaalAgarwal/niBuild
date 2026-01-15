#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FNIRT/UserGuide
# Invert a warp field

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'invwarp'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: invwarp.log
stderr: invwarp.log

inputs:
  # Required inputs
  warp:
    type: File
    label: Warp field to invert
    inputBinding:
      prefix: --warp=
      separate: false
      position: 1
  reference:
    type: File
    label: Reference image in target space
    inputBinding:
      prefix: --ref=
      separate: false
      position: 2
  output:
    type: string
    label: Output inverted warp filename
    inputBinding:
      prefix: --out=
      separate: false
      position: 3

  # Warp interpretation (mutually exclusive)
  relative:
    type: ['null', boolean]
    label: Treat warp as relative displacements
    inputBinding:
      prefix: --rel
  absolute:
    type: ['null', boolean]
    label: Treat warp as absolute coordinates
    inputBinding:
      prefix: --abs

  # Jacobian constraints
  noconstraint:
    type: ['null', boolean]
    label: Disable Jacobian constraint
    inputBinding:
      prefix: --noconstraint
  jacobian_min:
    type: ['null', double]
    label: Minimum Jacobian (default 0.01)
    inputBinding:
      prefix: --jmin=
      separate: false
  jacobian_max:
    type: ['null', double]
    label: Maximum Jacobian (default 100.0)
    inputBinding:
      prefix: --jmax=
      separate: false

  # Iteration options
  niter:
    type: ['null', int]
    label: Number of gradient descent iterations
    inputBinding:
      prefix: --niter=
      separate: false
  regularise:
    type: ['null', double]
    label: Regularization strength (default 1.0)
    inputBinding:
      prefix: --regularise=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: --verbose
  debug:
    type: ['null', boolean]
    label: Debug mode
    inputBinding:
      prefix: --debug

outputs:
  inverse_warp:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: invwarp.log
