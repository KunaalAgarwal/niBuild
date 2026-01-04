#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FUGUE
# EPI distortion correction using fieldmap

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fugue'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fugue.log
stderr: fugue.log

inputs:
  # Input image
  input:
    type: File
    label: EPI image to unwarp
    inputBinding:
      prefix: -i

  # Fieldmap inputs (one of these is required)
  phasemap:
    type: ['null', File]
    label: Unwrapped phase image (or two-echo phase difference)
    inputBinding:
      prefix: -p
  loadfmap:
    type: ['null', File]
    label: Pre-calculated fieldmap in rad/s
    inputBinding:
      prefix: --loadfmap
  loadshift:
    type: ['null', File]
    label: Pre-calculated voxel shift map
    inputBinding:
      prefix: --loadshift

  # Output options
  unwarp:
    type: ['null', string]
    label: Output unwarped image filename
    inputBinding:
      prefix: -u
  warp:
    type: ['null', string]
    label: Output forward warped image filename
    inputBinding:
      prefix: -w
  savefmap:
    type: ['null', string]
    label: Save fieldmap in rad/s
    inputBinding:
      prefix: --savefmap
  saveshift:
    type: ['null', string]
    label: Save voxel shift map
    inputBinding:
      prefix: --saveshift

  # Sequence parameters
  dwell:
    type: ['null', double]
    label: EPI dwell time / echo spacing (seconds)
    inputBinding:
      prefix: --dwell
  asym:
    type: ['null', double]
    label: Asymmetry time (echo time difference) in ms
    inputBinding:
      prefix: --asym

  # Unwarp direction
  unwarpdir:
    type:
      - 'null'
      - type: enum
        symbols: [x, y, z, x-, y-, z-]
    label: Phase-encode / unwarp direction
    inputBinding:
      prefix: --unwarpdir

  # Mask
  mask:
    type: ['null', File]
    label: Brain mask image
    inputBinding:
      prefix: --mask

  # Regularization options
  smooth2:
    type: ['null', double]
    label: 2D Gaussian smoothing sigma
    inputBinding:
      prefix: -s
  smooth3:
    type: ['null', double]
    label: 3D Gaussian smoothing sigma
    inputBinding:
      prefix: --smooth3
  median:
    type: ['null', boolean]
    label: Apply 2D median filter
    inputBinding:
      prefix: -m
  poly:
    type: ['null', int]
    label: 3D polynomial fitting degree
    inputBinding:
      prefix: --poly
  fourier:
    type: ['null', int]
    label: 3D sinusoidal fitting degree
    inputBinding:
      prefix: --fourier
  despike:
    type: ['null', boolean]
    label: Apply despiking filter
    inputBinding:
      prefix: --despike

  # Processing options
  phaseconj:
    type: ['null', boolean]
    label: Use phase conjugate method
    inputBinding:
      prefix: --phaseconj
  nokspace:
    type: ['null', boolean]
    label: Use image-space forward warping
    inputBinding:
      prefix: --nokspace
  icorr:
    type: ['null', boolean]
    label: Apply intensity correction
    inputBinding:
      prefix: --icorr
  icorronly:
    type: ['null', boolean]
    label: Only apply intensity correction (no unwarp)
    inputBinding:
      prefix: --icorronly

  # 4D processing
  noextend:
    type: ['null', boolean]
    label: Do not extend shifted voxels outside FOV
    inputBinding:
      prefix: --noextend

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v

outputs:
  unwarped_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.unwarp).nii.gz
        - $(inputs.unwarp).nii
  warped_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.warp).nii.gz
        - $(inputs.warp).nii
  fieldmap_output:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.savefmap).nii.gz
        - $(inputs.savefmap).nii
  shiftmap_output:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.saveshift).nii.gz
        - $(inputs.saveshift).nii
  log:
    type: File
    outputBinding:
      glob: fugue.log
