#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dZeropad.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dZeropad'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Directional padding (positive adds, negative crops)
  I:
    type: ['null', int]
    label: Add n planes at Inferior edge
    inputBinding: {prefix: -I}
  S:
    type: ['null', int]
    label: Add n planes at Superior edge
    inputBinding: {prefix: -S}
  A:
    type: ['null', int]
    label: Add n planes at Anterior edge
    inputBinding: {prefix: -A}
  P:
    type: ['null', int]
    label: Add n planes at Posterior edge
    inputBinding: {prefix: -P}
  L:
    type: ['null', int]
    label: Add n planes at Left edge
    inputBinding: {prefix: -L}
  R:
    type: ['null', int]
    label: Add n planes at Right edge
    inputBinding: {prefix: -R}
  z:
    type: ['null', int]
    label: Add planes on each z-axis face
    inputBinding: {prefix: -z}

  # Symmetric padding to achieve target size
  RL:
    type: ['null', int]
    label: Symmetric padding to achieve n slices in R/L
    inputBinding: {prefix: -RL}
  AP:
    type: ['null', int]
    label: Symmetric padding to achieve n slices in A/P
    inputBinding: {prefix: -AP}
  IS:
    type: ['null', int]
    label: Symmetric padding to achieve n slices in I/S
    inputBinding: {prefix: -IS}

  # Automatic padding
  pad2odds:
    type: ['null', boolean]
    label: Add 0 or 1 plane per R/A/S for odd slice counts
    inputBinding: {prefix: -pad2odds}
  pad2evens:
    type: ['null', boolean]
    label: Add 0 or 1 plane per R/A/S for even slice counts
    inputBinding: {prefix: -pad2evens}
  pad2mult:
    type: ['null', int]
    label: Make each axis a multiple of N
    inputBinding: {prefix: -pad2mult}

  # Units
  mm:
    type: ['null', boolean]
    label: Interpret padding counts as millimeters
    inputBinding: {prefix: -mm}

  # Master grid
  master:
    type: ['null', File]
    label: Match volume extents from reference dataset
    inputBinding: {prefix: -master}

outputs:
  padded:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
