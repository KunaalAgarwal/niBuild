#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dMEMA.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dMEMA'

hints:
  DockerRequirement:
    dockerPull: fmribuild/afni-test:latest

requirements:
  InlineJavascriptRequirement: {}

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output filename prefix
    inputBinding: {prefix: -prefix}

  # Data specification
  set:
    type:
      type: array
      items:
        type: record
        name: mema_set
        fields:
          setname:
            type: string
          subject:
            type: string
          beta:
            type: File
          tstat:
            type: File
    label: Data set specification (SETNAME subject beta_dset t_dset)
  groups:
    type: ['null', string]
    label: Names of 1-2 groups for comparison
    inputBinding: {prefix: -groups}

  # Masking
  mask:
    type: ['null', File]
    label: Process voxels within mask only
    inputBinding: {prefix: -mask}
  max_zeros:
    type: ['null', string]
    label: Skip voxels with more than N zero beta coefficients
    inputBinding: {prefix: -max_zeros}

  # Covariates
  covariates:
    type: ['null', File]
    label: Text file with covariate table
    inputBinding: {prefix: -covariates}
  covariates_center:
    type: ['null', string]
    label: Centering points for covariates
    inputBinding: {prefix: -covariates_center}
  covariates_model:
    type: ['null', string]
    label: Intercept/slope model across groups
    inputBinding: {prefix: -covariates_model}

  # Statistical options
  HKtest:
    type: ['null', boolean]
    label: Apply Hartung-Knapp adjustment to t-statistics
    inputBinding: {prefix: -HKtest}
  model_outliers:
    type: ['null', boolean]
    label: Model outlier betas using Laplace distribution
    inputBinding: {prefix: -model_outliers}
  residual_Z:
    type: ['null', boolean]
    label: Output residuals and Z-values for outliers
    inputBinding: {prefix: -residual_Z}
  unequal_variance:
    type: ['null', boolean]
    label: Model different variability between groups
    inputBinding: {prefix: -unequal_variance}

  # Missing data handling
  missing_data:
    type: ['null', string]
    label: Handle missing data (0 or file specification)
    inputBinding: {prefix: -missing_data}

  # Processing
  jobs:
    type: ['null', int]
    label: Number of parallel processors
    inputBinding: {prefix: -jobs}
  verb:
    type: ['null', int]
    label: Verbosity level (0=quiet)
    inputBinding: {prefix: -verb}

arguments:
  - valueFrom: |
      ${
        var args = [];
        if (inputs.set && inputs.set.length) {
          var grouped = {};
          inputs.set.forEach(function(entry) {
            if (!grouped[entry.setname]) {
              grouped[entry.setname] = [];
            }
            grouped[entry.setname].push(entry);
          });
          Object.keys(grouped).forEach(function(name) {
            args.push("-set", name);
            grouped[name].forEach(function(entry) {
              args.push(entry.subject);
              args.push(entry.beta.path);
              args.push(entry.tstat.path);
            });
          });
        }
        return args;
      }
    position: 1

outputs:
  stats:
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
