#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/MCFLIRT
# Motion correction using FLIRT

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mcflirt'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: mcflirt.log
stderr: mcflirt.log

inputs:
  input:
    type: File
    label: Input 4D timeseries to motion-correct
    inputBinding:
      prefix: -in
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      prefix: -out
      position: 2

  # Reference options
  ref_vol:
    type: ['null', int]
    label: Reference volume number (default is middle volume)
    inputBinding:
      prefix: -refvol
  ref_file:
    type: ['null', File]
    label: External reference image for motion correction
    inputBinding:
      prefix: -reffile
  mean_vol:
    type: ['null', boolean]
    label: Register to mean volume
    inputBinding:
      prefix: -meanvol

  # Cost function
  cost:
    type:
      - 'null'
      - type: enum
        symbols: [mutualinfo, woods, corratio, normcorr, normmi, leastsquares]
    label: Cost function for optimization
    inputBinding:
      prefix: -cost

  # Transform options
  dof:
    type: ['null', int]
    label: Degrees of freedom (default 6)
    inputBinding:
      prefix: -dof
  init:
    type: ['null', File]
    label: Initial transformation matrix
    inputBinding:
      prefix: -init

  # Interpolation
  interpolation:
    type:
      - 'null'
      - type: enum
        symbols: [spline, nn, sinc]
    label: Final interpolation method
    inputBinding:
      prefix: '-'
      separate: false
      suffix: '_final'

  # Output options
  save_mats:
    type: ['null', boolean]
    label: Save transformation matrices
    inputBinding:
      prefix: -mats
  save_plots:
    type: ['null', boolean]
    label: Save motion parameter plots
    inputBinding:
      prefix: -plots
  save_rms:
    type: ['null', boolean]
    label: Save RMS displacement parameters
    inputBinding:
      prefix: -rmsabs
  stats:
    type: ['null', boolean]
    label: Produce variance and std dev images
    inputBinding:
      prefix: -stats

  # Processing options
  stages:
    type: ['null', int]
    label: Number of search stages (default 3)
    inputBinding:
      prefix: -stages
  bins:
    type: ['null', int]
    label: Number of histogram bins
    inputBinding:
      prefix: -bins
  smooth:
    type: ['null', double]
    label: Smoothing for cost function (FWHM in mm)
    inputBinding:
      prefix: -smooth
  scaling:
    type: ['null', double]
    label: Scaling factor
    inputBinding:
      prefix: -scaling
  rotation:
    type: ['null', int]
    label: Rotation tolerance scaling factor
    inputBinding:
      prefix: -rotation
  edge:
    type: ['null', boolean]
    label: Use contour for coarse search
    inputBinding:
      prefix: -edge
  gdt:
    type: ['null', boolean]
    label: Use gradient for coarse search
    inputBinding:
      prefix: -gdt

outputs:
  motion_corrected:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  motion_parameters:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output).par
  mean_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output)_mean_reg.nii.gz
        - $(inputs.output)_mean_reg.nii
  variance_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output)_variance.nii.gz
        - $(inputs.output)_variance.nii
  std_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output)_sigma.nii.gz
        - $(inputs.output)_sigma.nii
  transformation_matrices:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob: $(inputs.output).mat/MAT_*
  rms_files:
    type: ['null', File[]]
    outputBinding:
      glob:
        - $(inputs.output)_abs.rms
        - $(inputs.output)_rel.rms
        - $(inputs.output)_abs_mean.rms
        - $(inputs.output)_rel_mean.rms
  log:
    type: File
    outputBinding:
      glob: mcflirt.log
