#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_normalize
# Intensity normalization for T1 images

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_normalize'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_normalize.log
stderr: mri_normalize.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input volume
    inputBinding:
      position: 50
  output:
    type: string
    label: Output normalized volume filename
    inputBinding:
      position: 51

  # Normalization options
  gradient:
    type: ['null', double]
    label: Max intensity/mm gradient (default 1)
    inputBinding:
      prefix: -g
      position: 1
  niters:
    type: ['null', int]
    label: Number of 3D normalization iterations
    inputBinding:
      prefix: -n
      position: 2

  # Mask options
  mask:
    type: ['null', File]
    label: Input mask file
    inputBinding:
      prefix: -mask
      position: 3
  noskull:
    type: ['null', boolean]
    label: Do not normalize skull regions
    inputBinding:
      prefix: -noskull
      position: 4

  # Segmentation options
  aseg:
    type: ['null', File]
    label: Input segmentation for guidance
    inputBinding:
      prefix: -aseg
      position: 5
  noaseg:
    type: ['null', boolean]
    label: Do not use aseg for normalization
    inputBinding:
      prefix: -noaseg
      position: 6

  # Control point options
  control_points:
    type: ['null', File]
    label: Control points file
    inputBinding:
      prefix: -f
      position: 7
  seed:
    type: ['null', int]
    label: Random seed
    inputBinding:
      prefix: -seed
      position: 8

  # Bias field options
  bias:
    type: ['null', double]
    label: Bias field FWHM
    inputBinding:
      prefix: -b
      position: 9
  sigma:
    type: ['null', double]
    label: Sigma for bias field smoothing
    inputBinding:
      prefix: -sigma
      position: 10

  # Brain options
  brain_mask:
    type: ['null', File]
    label: Brain mask volume
    inputBinding:
      prefix: -brainmask
      position: 11

  # MPRAGE options
  mprage:
    type: ['null', boolean]
    label: Assume darker gray matter (MPRAGE)
    inputBinding:
      prefix: -mprage
      position: 12

  # Conform options
  conform:
    type: ['null', boolean]
    label: Conform to 256^3 and 1mm
    inputBinding:
      prefix: -conform
      position: 13

  # White matter options
  gentle:
    type: ['null', boolean]
    label: Perform gentler normalization
    inputBinding:
      prefix: -gentle
      position: 14

  # Output options
  disable_logging:
    type: ['null', boolean]
    label: Disable logging
    inputBinding:
      prefix: -nolog
      position: 15

outputs:
  normalized:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mri_normalize.log
