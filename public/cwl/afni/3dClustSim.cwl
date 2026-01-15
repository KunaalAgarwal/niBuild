#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dClustSim.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dClustSim'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output filename prefix
    inputBinding: {prefix: -prefix}

  # Volume specification
  nxyz:
    type: ['null', string]
    label: Size of 3D grid (n1 n2 n3, default 64 64 32)
    inputBinding: {prefix: -nxyz}
  dxyz:
    type: ['null', string]
    label: Voxel dimensions in mm (d1 d2 d3, default 3.5 3.5 3.5)
    inputBinding: {prefix: -dxyz}
  mask:
    type: ['null', File]
    label: Mask dataset defining analysis region
    inputBinding: {prefix: -mask}
  BALL:
    type: ['null', boolean]
    label: Restrict simulation to spherical volume
    inputBinding: {prefix: -BALL}
  inset:
    type:
      - 'null'
      - type: array
        items: File
    label: Use these volumes as simulations
    inputBinding: {prefix: -inset}

  # Smoothing parameters
  fwhm:
    type: ['null', double]
    label: Gaussian filter width in mm (not recommended)
    inputBinding: {prefix: -fwhm}
  acf:
    type: ['null', string]
    label: ACF parameters (a b c) from 3dFWHMx
    inputBinding: {prefix: -acf}
  nopad:
    type: ['null', boolean]
    label: Disable edge padding
    inputBinding: {prefix: -nopad}

  # Thresholding
  pthr:
    type: ['null', string]
    label: Per-voxel p-value thresholds
    inputBinding: {prefix: -pthr}
  athr:
    type: ['null', string]
    label: Whole-volume alpha significance levels
    inputBinding: {prefix: -athr}

  # Simulation control
  iter:
    type: ['null', int]
    label: Number of Monte Carlo simulations (default 10000)
    inputBinding: {prefix: -iter}
  seed:
    type: ['null', int]
    label: Random number seed
    inputBinding: {prefix: -seed}

  # Output format
  niml:
    type: ['null', boolean]
    label: Output in NIML/XML format
    inputBinding: {prefix: -niml}
  both:
    type: ['null', boolean]
    label: Output both NIML and .1D formats
    inputBinding: {prefix: -both}
  nodec:
    type: ['null', boolean]
    label: Remove decimal places from thresholds
    inputBinding: {prefix: -nodec}
  quiet:
    type: ['null', boolean]
    label: Suppress progress messages
    inputBinding: {prefix: -quiet}

outputs:
  clustsim_1D:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob: $(inputs.prefix).NN*.1D
  clustsim_niml:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob: $(inputs.prefix).NN*.niml
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
