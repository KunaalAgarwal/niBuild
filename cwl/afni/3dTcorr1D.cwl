#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dTcorr1D.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dTcorr1D'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  xset:
    type: File
    label: Input 3D+time dataset
    inputBinding: {position: 100}
  y1D:
    type: File
    label: 1D reference time series file
    inputBinding: {position: 101}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Correlation method (mutually exclusive)
  pearson:
    type: ['null', boolean]
    label: Pearson product moment correlation (default)
    inputBinding: {prefix: -pearson}
  spearman:
    type: ['null', boolean]
    label: Spearman rank correlation
    inputBinding: {prefix: -spearman}
  quadrant:
    type: ['null', boolean]
    label: Quadrant correlation coefficient
    inputBinding: {prefix: -quadrant}
  ktaub:
    type: ['null', boolean]
    label: Kendall tau_b coefficient
    inputBinding: {prefix: -ktaub}
  dot:
    type: ['null', boolean]
    label: Calculate dot product instead of correlation
    inputBinding: {prefix: -dot}

  # Transform
  Fisher:
    type: ['null', boolean]
    label: Apply Fisher (arctanh) transformation
    inputBinding: {prefix: -Fisher}

  # Masking
  mask:
    type: ['null', File]
    label: Only process voxels nonzero in mask
    inputBinding: {prefix: -mask}

  # Output format
  float:
    type: ['null', boolean]
    label: Save results in float format (default)
    inputBinding: {prefix: -float}
  short:
    type: ['null', boolean]
    label: Save results in scaled short format
    inputBinding: {prefix: -short}

outputs:
  correlation:
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
