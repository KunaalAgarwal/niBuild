#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dttest++.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dttest++'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Input sets
  setA:
    type:
      - File
      - type: array
        items: File
    label: Primary sample set (required)
    inputBinding: {prefix: -setA}
  setB:
    type:
      - 'null'
      - File
      - type: array
        items: File
    label: Secondary sample set for 2-sample comparison
    inputBinding: {prefix: -setB}
  labelA:
    type: ['null', string]
    label: Name for set A in output labels
    inputBinding: {prefix: -labelA}
  labelB:
    type: ['null', string]
    label: Name for set B in output labels
    inputBinding: {prefix: -labelB}

  # Covariates
  covariates:
    type: ['null', File]
    label: Text file with covariate table
    inputBinding: {prefix: -covariates}
  center:
    type:
      - 'null'
      - type: enum
        symbols: [NONE, DIFF, SAME]
    label: Covariate centering method
    inputBinding: {prefix: -center}

  # Test options
  paired:
    type: ['null', boolean]
    label: Conduct paired-sample t-test
    inputBinding: {prefix: -paired}
  unpooled:
    type: ['null', boolean]
    label: Compute variance separately for each set
    inputBinding: {prefix: -unpooled}
  BminusA:
    type: ['null', boolean]
    label: Reverse subtraction order to B - A
    inputBinding: {prefix: -BminusA}
  rankize:
    type: ['null', boolean]
    label: Convert data and covariates into ranks
    inputBinding: {prefix: -rankize}
  toz:
    type: ['null', boolean]
    label: Convert t-statistics to z-scores
    inputBinding: {prefix: -toz}
  zskip:
    type: ['null', int]
    label: Skip zero values in voxel analysis
    inputBinding: {prefix: -zskip}

  # Output options
  resid:
    type: ['null', string]
    label: Save residuals to separate dataset
    inputBinding: {prefix: -resid}
  no1sam:
    type: ['null', boolean]
    label: Omit 1-sample test results in 2-sample analysis
    inputBinding: {prefix: -no1sam}
  nomeans:
    type: ['null', boolean]
    label: Exclude mean sub-bricks from output
    inputBinding: {prefix: -nomeans}
  notests:
    type: ['null', boolean]
    label: Exclude statistical test sub-bricks
    inputBinding: {prefix: -notests}

  # Masking and smoothing
  mask:
    type: ['null', File]
    label: Restrict analysis to mask region
    inputBinding: {prefix: -mask}
  exblur:
    type: ['null', double]
    label: Apply additional Gaussian smoothing (FWHM in mm)
    inputBinding: {prefix: -exblur}

  # Cluster simulation
  Clustsim:
    type: ['null', int]
    label: Run cluster simulations for thresholding
    inputBinding: {prefix: -Clustsim}
  ETAC:
    type: ['null', int]
    label: Multi-threshold clustering with equitable FPR control
    inputBinding: {prefix: -ETAC}

  # Processing options
  brickwise:
    type: ['null', boolean]
    label: Process multiple sub-bricks separately
    inputBinding: {prefix: -brickwise}
  singletonA:
    type: ['null', string]
    label: Test single value against group mean
    inputBinding: {prefix: -singletonA}

  # Other options
  debug:
    type: ['null', boolean]
    label: Print detailed analysis information
    inputBinding: {prefix: -debug}

outputs:
  stats:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  residuals:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.resid)+orig.*
        - $(inputs.resid)+tlrc.*
        - $(inputs.resid).nii*
  clustsim:
    type: ['null', File]
    outputBinding:
      glob: "*.ClustSim.*"
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
