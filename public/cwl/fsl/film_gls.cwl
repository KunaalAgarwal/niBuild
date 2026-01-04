#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FEAT
# General linear model fitting with prewhitening

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'film_gls'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: film_gls.log
stderr: film_gls.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input 4D data file
    inputBinding:
      position: 1
  design_file:
    type: File
    label: Design matrix file (.mat)
    inputBinding:
      position: 2
  threshold:
    type: ['null', double]
    label: Threshold for FILM estimation (default 1000)
    default: 1000.0
    inputBinding:
      position: 3

  # Output options
  results_dir:
    type: ['null', string]
    label: Results directory name
    inputBinding:
      prefix: -rn

  # Autocorrelation options
  autocorr_noestimate:
    type: ['null', boolean]
    label: Do not estimate autocorrelation
    inputBinding:
      prefix: -noest
  autocorr_estimate_only:
    type: ['null', boolean]
    label: Only estimate autocorrelation (no GLM)
    inputBinding:
      prefix: -ac
  smooth_autocorr:
    type: ['null', boolean]
    label: Smooth autocorrelation estimates
    inputBinding:
      prefix: -sa
  fit_armodel:
    type: ['null', boolean]
    label: Fit autoregressive model
    inputBinding:
      prefix: -ar
  use_pava:
    type: ['null', boolean]
    label: Estimate autocorrelation using PAVA
    inputBinding:
      prefix: -pava
  tukey_window:
    type: ['null', int]
    label: Tukey window size for autocorrelation
    inputBinding:
      prefix: -tukey
  multitaper_product:
    type: ['null', int]
    label: Multitaper with slepian tapers
    inputBinding:
      prefix: -mt

  # Susan options
  brightness_threshold:
    type: ['null', int]
    label: Susan brightness threshold
    inputBinding:
      prefix: -epith
  mask_size:
    type: ['null', int]
    label: Susan mask size
    inputBinding:
      prefix: -ms

  # Output options
  full_data:
    type: ['null', boolean]
    label: Output full data/verbose
    inputBinding:
      prefix: -v
  output_pwdata:
    type: ['null', boolean]
    label: Output prewhitened data
    inputBinding:
      prefix: -output_pwdata

outputs:
  results:
    type: Directory
    outputBinding:
      glob: $(inputs.results_dir || 'results')
  dof:
    type: File
    outputBinding:
      glob: $(inputs.results_dir || 'results')/dof
  residual4d:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.results_dir || 'results')/res4d.nii.gz
        - $(inputs.results_dir || 'results')/res4d.nii
  param_estimates:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.results_dir || 'results')/pe*.nii.gz
        - $(inputs.results_dir || 'results')/pe*.nii
  sigmasquareds:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.results_dir || 'results')/sigmasquareds.nii.gz
        - $(inputs.results_dir || 'results')/sigmasquareds.nii
  threshac1:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.results_dir || 'results')/threshac1.nii.gz
        - $(inputs.results_dir || 'results')/threshac1.nii
  log:
    type: File
    outputBinding:
      glob: film_gls.log
