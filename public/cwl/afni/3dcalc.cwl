#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dcalc.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dcalc'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  # Input datasets (up to 26 with letters a-z)
  a:
    type: File
    label: Input dataset a
    inputBinding: {prefix: -a}
  b:
    type: ['null', File]
    label: Input dataset b
    inputBinding: {prefix: -b}
  c:
    type: ['null', File]
    label: Input dataset c
    inputBinding: {prefix: -c}
  d:
    type: ['null', File]
    label: Input dataset d
    inputBinding: {prefix: -d}

  # Expression
  expr:
    type: string
    label: Mathematical expression to evaluate
    inputBinding: {prefix: -expr}

  # Output
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}
  session:
    type: ['null', string]
    label: Output session directory
    inputBinding: {prefix: -session}

  # Data type
  datum:
    type:
      - 'null'
      - type: enum
        symbols: [byte, short, float]
    label: Output data type
    inputBinding: {prefix: -datum}
  float:
    type: ['null', boolean]
    label: Force float output format
    inputBinding: {prefix: -float}
  short:
    type: ['null', boolean]
    label: Force short output format
    inputBinding: {prefix: -short}
  byte:
    type: ['null', boolean]
    label: Force byte output format
    inputBinding: {prefix: -byte}

  # Scaling
  fscale:
    type: ['null', boolean]
    label: Force scaling to maximum integer range
    inputBinding: {prefix: -fscale}
  gscale:
    type: ['null', boolean]
    label: Force single scaling factor across all sub-bricks
    inputBinding: {prefix: -gscale}
  nscale:
    type: ['null', boolean]
    label: Disable scaling
    inputBinding: {prefix: -nscale}

  # Time series options
  dt:
    type: ['null', double]
    label: TR for manufactured 3D+time datasets (seconds)
    inputBinding: {prefix: -dt}
  taxis:
    type: ['null', string]
    label: Create time axis (N:tstep)
    inputBinding: {prefix: -taxis}

  # Processing options
  verbose:
    type: ['null', boolean]
    label: Display program progress
    inputBinding: {prefix: -verbose}
  usetemp:
    type: ['null', boolean]
    label: Use temporary file for intermediate results
    inputBinding: {prefix: -usetemp}
  isola:
    type: ['null', boolean]
    label: Remove isolated non-zero voxels
    inputBinding: {prefix: -isola}

  # Coordinate system
  dicom:
    type: ['null', boolean]
    label: Use DICOM/RAI coordinate order
    inputBinding: {prefix: -dicom}
  SPM:
    type: ['null', boolean]
    label: Use SPM/LPI coordinate order
    inputBinding: {prefix: -SPM}

outputs:
  result:
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
