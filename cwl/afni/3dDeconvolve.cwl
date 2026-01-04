#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dDeconvolve.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dDeconvolve'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  input:
    type: File
    label: Input 3D+time dataset
    inputBinding: {prefix: -input}
  bucket:
    type: string
    label: Output bucket dataset prefix
    inputBinding: {prefix: -bucket}

  # Baseline model
  polort:
    type: ['null', string]
    label: Polynomial degree for baseline (default 1, 'A' for auto)
    inputBinding: {prefix: -polort}

  # Stimulus setup
  num_stimts:
    type: ['null', int]
    label: Number of stimulus regressors
    inputBinding: {prefix: -num_stimts}

  # Stimulus timing files (multiple can be specified)
  stim_times:
    type:
      - 'null'
      - type: array
        items: string
    label: Stimulus times specification (k tname Rmodel)
    inputBinding: {prefix: -stim_times}
  stim_file:
    type:
      - 'null'
      - type: array
        items: string
    label: Stimulus file specification (k sname)
    inputBinding: {prefix: -stim_file}
  stim_label:
    type:
      - 'null'
      - type: array
        items: string
    label: Stimulus labels (k label)
    inputBinding: {prefix: -stim_label}

  # Nuisance regressors
  ortvec:
    type: ['null', File]
    label: Baseline vectors from file as nuisance regressors
    inputBinding: {prefix: -ortvec}

  # Timing interpretation
  local_times:
    type: ['null', boolean]
    label: Interpret stimulus times relative to run starts
    inputBinding: {prefix: -local_times}
  global_times:
    type: ['null', boolean]
    label: Interpret stimulus times relative to first run
    inputBinding: {prefix: -global_times}

  # Statistical output
  fout:
    type: ['null', boolean]
    label: Output F-statistics for stimulus coefficients
    inputBinding: {prefix: -fout}
  tout:
    type: ['null', boolean]
    label: Output t-statistics for individual coefficients
    inputBinding: {prefix: -tout}
  rout:
    type: ['null', boolean]
    label: Output R-squared for each stimulus
    inputBinding: {prefix: -rout}

  # Contrasts
  gltsym:
    type:
      - 'null'
      - type: array
        items: string
    label: General linear test symbolic specification
    inputBinding: {prefix: -gltsym}
  glt_label:
    type:
      - 'null'
      - type: array
        items: string
    label: GLT labels (k label)
    inputBinding: {prefix: -glt_label}

  # Matrix output
  x1D:
    type: ['null', string]
    label: Export design matrix filename
    inputBinding: {prefix: -x1D}
  x1D_stop:
    type: ['null', boolean]
    label: Stop after matrix generation
    inputBinding: {prefix: -x1D_stop}

  # Masking
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Automatically generate mask
    inputBinding: {prefix: -automask}

  # Censoring
  censor:
    type: ['null', File]
    label: Censor file for excluding time points
    inputBinding: {prefix: -censor}
  CENSORTR:
    type: ['null', string]
    label: Censor specific TRs
    inputBinding: {prefix: -CENSORTR}

  # Other outputs
  fitts:
    type: ['null', string]
    label: Output fitted model prefix
    inputBinding: {prefix: -fitts}
  errts:
    type: ['null', string]
    label: Output residuals prefix
    inputBinding: {prefix: -errts}

  # Job control
  jobs:
    type: ['null', int]
    label: Number of parallel jobs
    inputBinding: {prefix: -jobs}
  quiet:
    type: ['null', boolean]
    label: Suppress progress messages
    inputBinding: {prefix: -quiet}

outputs:
  stats:
    type: File
    outputBinding:
      glob:
        - $(inputs.bucket)+orig.HEAD
        - $(inputs.bucket)+orig.BRIK
        - $(inputs.bucket)+tlrc.HEAD
        - $(inputs.bucket)+tlrc.BRIK
        - $(inputs.bucket).nii
        - $(inputs.bucket).nii.gz
  design_matrix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.x1D)
  xmat:
    type: ['null', File]
    outputBinding:
      glob: "*.xmat.1D"
  fitted:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.fitts)+orig.*
        - $(inputs.fitts).nii*
  residuals:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.errts)+orig.*
        - $(inputs.errts).nii*
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
