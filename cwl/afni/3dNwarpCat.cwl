#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dNwarpCat.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dNwarpCat'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output dataset prefix for concatenated warp
    inputBinding: {prefix: -prefix}

  # Warp inputs (can specify multiple)
  warp1:
    type: File
    label: First warp input
    inputBinding: {prefix: -warp1}
  warp2:
    type: ['null', File]
    label: Second warp input
    inputBinding: {prefix: -warp2}
  warp3:
    type: ['null', File]
    label: Third warp input
    inputBinding: {prefix: -warp3}
  warp4:
    type: ['null', File]
    label: Fourth warp input
    inputBinding: {prefix: -warp4}

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [linear, quintic, wsinc5]
    label: Interpolation mode (default wsinc5)
    inputBinding: {prefix: -interp}

  # Options
  iwarp:
    type: ['null', boolean]
    label: Invert final output warp before writing
    inputBinding: {prefix: -iwarp}
  space:
    type: ['null', string]
    label: Attach atlas space marker string
    inputBinding: {prefix: -space}
  expad:
    type: ['null', int]
    label: Pad nonlinear warps by specified voxels
    inputBinding: {prefix: -expad}
  verb:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding: {prefix: -verb}

outputs:
  concatenated_warp:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+tlrc.HEAD
        - $(inputs.prefix)+tlrc.BRIK
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
