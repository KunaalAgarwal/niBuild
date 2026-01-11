#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dDeconvolve.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dDeconvolve'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

requirements:
  InlineJavascriptRequirement: {}
  SchemaDefRequirement:
    types:
      - name: stim_times_spec
        type: record
        fields:
          index:
            type: int
          file:
            type: File
          model:
            type: string
      - name: stim_file_spec
        type: record
        fields:
          index:
            type: int
          file:
            type: File
      - name: stim_label_spec
        type: record
        fields:
          index:
            type: int
          label:
            type: string

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
      type: array
      items: stim_times_spec
    default: []
    label: Stimulus times specification (k tname Rmodel)
  stim_file:
    type:
      type: array
      items: stim_file_spec
    default: []
    label: Stimulus file specification (k sname)
  stim_label:
    type:
      type: array
      items: stim_label_spec
    default: []
    label: Stimulus labels (k label)

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
        items:
          type: record
          name: glt_label_spec
          fields:
            index:
              type: int
              inputBinding:
                prefix: -glt_label
                position: 1
            label:
              type: string
              inputBinding:
                position: 2
    label: GLT labels (k label)

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

arguments:
  - valueFrom: |
      ${
        var args = [];
        (inputs.stim_times || []).forEach(function(entry) {
          var stimPath = entry.file.path || entry.file.basename;
          args.push("-stim_times", entry.index.toString(), stimPath, entry.model);
        });
        (inputs.stim_file || []).forEach(function(entry) {
          var stimPath = entry.file.path || entry.file.basename;
          args.push("-stim_file", entry.index.toString(), stimPath);
        });
        (inputs.stim_label || []).forEach(function(entry) {
          args.push("-stim_label", entry.index.toString(), entry.label);
        });
        return args;
      }
    position: 1

outputs:
  stats:
    type: File
    outputBinding:
      glob: $(inputs.bucket)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
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
      glob: $(inputs.fitts)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  residuals:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.errts)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
