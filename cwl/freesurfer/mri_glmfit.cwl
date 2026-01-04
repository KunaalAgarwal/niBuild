#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_glmfit
# General linear model on surface or volume data

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_glmfit'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_glmfit.log
stderr: mri_glmfit.log

inputs:
  # Required inputs
  y:
    type: File
    label: Input data file
    inputBinding:
      prefix: --y
      position: 1
  glmdir:
    type: string
    label: Output GLM directory
    inputBinding:
      prefix: --glmdir
      position: 2

  # Design specification
  fsgd:
    type: ['null', File]
    label: FreeSurfer Group Descriptor file
    inputBinding:
      prefix: --fsgd
      position: 3
  design:
    type: ['null', File]
    label: Design matrix file
    inputBinding:
      prefix: --X
      position: 4
  osgm:
    type: ['null', boolean]
    label: One-sample group mean
    inputBinding:
      prefix: --osgm
      position: 5

  # Contrast options
  C:
    type: ['null', 'File[]']
    label: Contrast matrix file(s)
    inputBinding:
      prefix: --C
      position: 6

  # Surface options
  surface:
    type: ['null', string]
    label: Surface subject and hemisphere (e.g., fsaverage lh)
    inputBinding:
      prefix: --surface
      position: 7
  cortex:
    type: ['null', boolean]
    label: Use cortex label as mask
    inputBinding:
      prefix: --cortex
      position: 8

  # Smoothing options
  fwhm:
    type: ['null', double]
    label: Smooth input by FWHM in mm
    inputBinding:
      prefix: --fwhm
      position: 9
  var_fwhm:
    type: ['null', double]
    label: Smooth variance by FWHM in mm
    inputBinding:
      prefix: --var-fwhm
      position: 10

  # Mask options
  mask:
    type: ['null', File]
    label: Mask volume or label
    inputBinding:
      prefix: --mask
      position: 11
  mask_inv:
    type: ['null', boolean]
    label: Invert mask
    inputBinding:
      prefix: --mask-inv
      position: 12
  prune:
    type: ['null', boolean]
    label: Prune design matrix
    inputBinding:
      prefix: --prune
      position: 13
  no_prune:
    type: ['null', boolean]
    label: Do not prune
    inputBinding:
      prefix: --no-prune
      position: 14

  # Analysis options
  wls:
    type: ['null', File]
    label: Weighted least squares variance file
    inputBinding:
      prefix: --wls
      position: 15
  self:
    type: ['null', int]
    label: Self regressor column
    inputBinding:
      prefix: --self
      position: 16
  pca:
    type: ['null', boolean]
    label: Perform PCA on residuals
    inputBinding:
      prefix: --pca
      position: 17

  # Output options
  save_eres:
    type: ['null', boolean]
    label: Save residual error
    inputBinding:
      prefix: --eres-save
      position: 18
  save_yhat:
    type: ['null', boolean]
    label: Save signal estimate
    inputBinding:
      prefix: --yhat-save
      position: 19
  nii:
    type: ['null', boolean]
    label: Use NIfTI output format
    inputBinding:
      prefix: --nii
      position: 20
  nii_gz:
    type: ['null', boolean]
    label: Use compressed NIfTI output
    inputBinding:
      prefix: --nii.gz
      position: 21

  # Simulation options
  sim:
    type: ['null', string]
    label: Simulation parameters (nulltype nsim thresh csd)
    inputBinding:
      prefix: --sim
      position: 22
  sim_sign:
    type:
      - 'null'
      - type: enum
        symbols: [abs, pos, neg]
    label: Simulation sign
    inputBinding:
      prefix: --sim-sign
      position: 23

  # Other options
  seed:
    type: ['null', int]
    label: Random seed
    inputBinding:
      prefix: --seed
      position: 24
  synth:
    type: ['null', boolean]
    label: Replace input with Gaussian noise
    inputBinding:
      prefix: --synth
      position: 25
  allowsubjrep:
    type: ['null', boolean]
    label: Allow subject repetition in FSGD
    inputBinding:
      prefix: --allowsubjrep
      position: 26

outputs:
  glm_dir:
    type: Directory
    outputBinding:
      glob: $(inputs.glmdir)
  log:
    type: File
    outputBinding:
      glob: mri_glmfit.log
