#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dTcorrMap.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dTcorrMap'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: 3dTcorrMap.log
stderr: 3dTcorrMap.log

inputs:
  input:
    type: File
    label: Input 3D+time dataset
    inputBinding: {prefix: -input}

  # Seed options
  seed:
    type: ['null', File]
    label: Seed 3D+time dataset for cross-correlation
    inputBinding: {prefix: -seed}

  # Masking
  mask:
    type: ['null', File]
    label: Voxel mask for processing
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Create mask from input dataset
    inputBinding: {prefix: -automask}

  # Preprocessing
  polort:
    type: ['null', int]
    label: Remove polynomial trends (-1 to 19, default 1)
    inputBinding: {prefix: -polort}
  bpass:
    type: ['null', string]
    label: Bandpass frequencies L H in Hz
    inputBinding: {prefix: -bpass}
  ort:
    type: ['null', File]
    label: Remove reference time series via regression
    inputBinding: {prefix: -ort}
  Gblur:
    type: ['null', double]
    label: Gaussian blur kernel width in mm
    inputBinding: {prefix: -Gblur}
  Mseed:
    type: ['null', double]
    label: Average seed over radius in mm
    inputBinding: {prefix: -Mseed}

  # Output options
  Mean:
    type: ['null', string]
    label: Save average correlations prefix
    inputBinding: {prefix: -Mean}
  Zmean:
    type: ['null', string]
    label: Save Fisher-transformed mean prefix
    inputBinding: {prefix: -Zmean}
  Qmean:
    type: ['null', string]
    label: Save RMS correlation prefix
    inputBinding: {prefix: -Qmean}
  Thresh:
    type: ['null', string]
    label: Count voxels exceeding threshold (tt pp)
    inputBinding: {prefix: -Thresh}
  CorrMap:
    type: ['null', string]
    label: Output complete correlation map prefix
    inputBinding: {prefix: -CorrMap}
  Aexpr:
    type: ['null', string]
    label: Average custom correlation expression (expr ppp)
    inputBinding: {prefix: -Aexpr}
  Hist:
    type: ['null', string]
    label: Generate correlation histogram (N ppp)
    inputBinding: {prefix: -Hist}

outputs:
  mean_corr:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.Mean)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  zmean_corr:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.Zmean)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  corrmap:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.CorrMap)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: 3dTcorrMap.log
