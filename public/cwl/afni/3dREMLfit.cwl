#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dREMLfit.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dREMLfit'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.Rbuck).log
stderr: $(inputs.Rbuck).log

inputs:
  input:
    type: File
    label: Input time series dataset
    inputBinding: {prefix: -input}
  matrix:
    type: File
    label: Regression matrix from 3dDeconvolve (.xmat.1D file)
    inputBinding: {prefix: -matrix}

  # Masking
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Automatically generate mask
    inputBinding: {prefix: -automask}
  STATmask:
    type: ['null', File]
    label: Separate mask for FDR curve computation
    inputBinding: {prefix: -STATmask}

  # Main output options
  Rbuck:
    type: string
    label: Output betas and statistics from REML
    inputBinding: {prefix: -Rbuck}
  Rbeta:
    type: ['null', string]
    label: Save beta weights from REML estimation
    inputBinding: {prefix: -Rbeta}
  Rvar:
    type: ['null', string]
    label: Save ARMA parameters and variance estimates
    inputBinding: {prefix: -Rvar}
  Rfitts:
    type: ['null', string]
    label: Save fitted model time series
    inputBinding: {prefix: -Rfitts}
  Rerrts:
    type: ['null', string]
    label: Save residuals (data minus fitted model)
    inputBinding: {prefix: -Rerrts}
  Rwherr:
    type: ['null', string]
    label: Save whitened residuals
    inputBinding: {prefix: -Rwherr}
  Rglt:
    type: ['null', string]
    label: Save GLT results
    inputBinding: {prefix: -Rglt}

  # ARMA parameter control
  MAXa:
    type: ['null', double]
    label: Maximum AR parameter (default 0.8, range 0.1-0.9)
    inputBinding: {prefix: -MAXa}
  MAXb:
    type: ['null', double]
    label: Maximum MA parameter (default 0.8, range 0.1-0.9)
    inputBinding: {prefix: -MAXb}
  Grid:
    type: ['null', int]
    label: Grid resolution for (a,b) search (default 3, range 3-7)
    inputBinding: {prefix: -Grid}
  NEGcor:
    type: ['null', boolean]
    label: Allow negative correlations
    inputBinding: {prefix: -NEGcor}
  ABfile:
    type: ['null', File]
    label: Read pre-estimated (a,b) parameters from dataset
    inputBinding: {prefix: -ABfile}

  # Baseline/regressor options
  addbase:
    type: ['null', File]
    label: Append baseline columns from .1D file
    inputBinding: {prefix: -addbase}
  slibase:
    type: ['null', File]
    label: Append slice-specific baseline regressors
    inputBinding: {prefix: -slibase}
  dsort:
    type: ['null', File]
    label: Include voxel-wise baseline regressors
    inputBinding: {prefix: -dsort}

  # Statistics output
  fout:
    type: ['null', boolean]
    label: Include F-statistics in bucket
    inputBinding: {prefix: -fout}
  tout:
    type: ['null', boolean]
    label: Include t-statistics in bucket
    inputBinding: {prefix: -tout}
  rout:
    type: ['null', boolean]
    label: Include R-squared statistics in bucket
    inputBinding: {prefix: -rout}
  noFDR:
    type: ['null', boolean]
    label: Disable FDR curve computation
    inputBinding: {prefix: -noFDR}

  # Contrasts
  gltsym:
    type:
      - 'null'
      - type: array
        items: string
    label: Define custom contrasts (symbolic GLT)
    inputBinding: {prefix: -gltsym}

  # Other options
  GOFORIT:
    type: ['null', boolean]
    label: Force processing despite rank-deficiency warnings
    inputBinding: {prefix: -GOFORIT}
  usetemp:
    type: ['null', boolean]
    label: Write intermediate data to disk (reduces RAM)
    inputBinding: {prefix: -usetemp}
  verb:
    type: ['null', boolean]
    label: Enable verbose progress messages
    inputBinding: {prefix: -verb}

outputs:
  stats:
    type: File
    outputBinding:
      glob:
        - $(inputs.Rbuck)+orig.HEAD
        - $(inputs.Rbuck)+orig.BRIK
        - $(inputs.Rbuck)+tlrc.HEAD
        - $(inputs.Rbuck)+tlrc.BRIK
        - $(inputs.Rbuck).nii
        - $(inputs.Rbuck).nii.gz
  betas:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.Rbeta)+orig.*
        - $(inputs.Rbeta)+tlrc.*
        - $(inputs.Rbeta).nii*
  variance:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.Rvar)+orig.*
        - $(inputs.Rvar)+tlrc.*
        - $(inputs.Rvar).nii*
  fitted:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.Rfitts)+orig.*
        - $(inputs.Rfitts)+tlrc.*
        - $(inputs.Rfitts).nii*
  residuals:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.Rerrts)+orig.*
        - $(inputs.Rerrts)+tlrc.*
        - $(inputs.Rerrts).nii*
  log:
    type: File
    outputBinding:
      glob: $(inputs.Rbuck).log
