#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dBlurToFWHM.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dBlurToFWHM'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input dataset to be smoothed
    inputBinding: {prefix: -input}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Target smoothness (one required)
  FWHM:
    type: ['null', double]
    label: Target 3D FWHM in mm
    inputBinding: {prefix: -FWHM}
  FWHMxy:
    type: ['null', double]
    label: Target 2D (x,y)-plane FWHM in mm (no z-axis blurring)
    inputBinding: {prefix: -FWHMxy}

  # Reference dataset
  blurmaster:
    type: ['null', File]
    label: Reference dataset controlling smoothness
    inputBinding: {prefix: -blurmaster}

  # Mask options
  mask:
    type: ['null', File]
    label: Mask dataset limiting blurring to masked voxels
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Generate automatic mask from input dataset
    inputBinding: {prefix: -automask}

  # Algorithm options
  maxite:
    type: ['null', int]
    label: Maximum iteration count
    inputBinding: {prefix: -maxite}
  rate:
    type: ['null', double]
    label: Scaling factor adjusting blurring speed (0.05-3.5)
    inputBinding: {prefix: -rate}
  nbhd:
    type: ['null', string]
    label: Neighborhood for local smoothness computation
    inputBinding: {prefix: -nbhd}
  ACF:
    type: ['null', boolean]
    label: Use autocorrelation function method for smoothness estimation
    inputBinding: {prefix: -ACF}

  # Detrending options
  detrend:
    type: ['null', boolean]
    label: Remove polynomial trends from blurmaster (default)
    inputBinding: {prefix: -detrend}
  nodetrend:
    type: ['null', boolean]
    label: Disable detrending
    inputBinding: {prefix: -nodetrend}
  detin:
    type: ['null', boolean]
    label: Detrend input dataset before and after blurring
    inputBinding: {prefix: -detin}

  # Other options
  unif:
    type: ['null', boolean]
    label: Standardize voxel-wise MAD before blurring
    inputBinding: {prefix: -unif}
  temper:
    type: ['null', boolean]
    label: Enhance spatial uniformity of smoothness
    inputBinding: {prefix: -temper}
  quiet:
    type: ['null', boolean]
    label: Suppress verbose progress messages
    inputBinding: {prefix: -quiet}

outputs:
  blurred:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+orig.BRIK.gz
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
