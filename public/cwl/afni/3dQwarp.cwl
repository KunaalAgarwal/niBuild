#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dQwarp.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dQwarp'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  source:
    type: File
    label: Source dataset to be warped
    inputBinding: {prefix: -source}
  base:
    type: File
    label: Base/template dataset
    inputBinding: {prefix: -base}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Alignment options
  allineate:
    type: ['null', boolean]
    label: Perform preliminary affine alignment via 3dAllineate
    inputBinding: {prefix: -allineate}
  allin:
    type: ['null', boolean]
    label: Short form of -allineate
    inputBinding: {prefix: -allin}
  allinfast:
    type: ['null', boolean]
    label: Fast affine alignment
    inputBinding: {prefix: -allinfast}

  # Blur options
  blur:
    type: ['null', string]
    label: Gaussian smoothing in voxels FWHM (one or two values)
    inputBinding: {prefix: -blur}
  pblur:
    type: ['null', boolean]
    label: Progressive blurring scaled with patch size
    inputBinding: {prefix: -pblur}

  # Warp control
  minpatch:
    type: ['null', int]
    label: Minimum patch size (odd integer, default 25)
    inputBinding: {prefix: -minpatch}
  maxlev:
    type: ['null', int]
    label: Maximum refinement level
    inputBinding: {prefix: -maxlev}
  inilev:
    type: ['null', int]
    label: Initial refinement level
    inputBinding: {prefix: -inilev}

  # Initial warp
  iniwarp:
    type: ['null', File]
    label: Initial warp dataset
    inputBinding: {prefix: -iniwarp}
  duplo:
    type: ['null', boolean]
    label: Start with coarse resolution warping
    inputBinding: {prefix: -duplo}

  # Output control
  nowarp:
    type: ['null', boolean]
    label: Do not save the warp transformation
    inputBinding: {prefix: -nowarp}
  iwarp:
    type: ['null', boolean]
    label: Compute and save inverse warp
    inputBinding: {prefix: -iwarp}
  nodset:
    type: ['null', boolean]
    label: Do not save warped source dataset
    inputBinding: {prefix: -nodset}

  # Masking
  emask:
    type: ['null', File]
    label: Exclusion mask dataset
    inputBinding: {prefix: -emask}
  noweight:
    type: ['null', boolean]
    label: Do not use weighting
    inputBinding: {prefix: -noweight}

  # Penalty options
  penfac:
    type: ['null', double]
    label: Penalty factor for warp smoothness
    inputBinding: {prefix: -penfac}

  # Verbosity
  verb:
    type: ['null', boolean]
    label: Verbose output
    inputBinding: {prefix: -verb}
  quiet:
    type: ['null', boolean]
    label: Suppress progress messages
    inputBinding: {prefix: -quiet}

outputs:
  warped:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)+*.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  warp:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_WARP+*.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  inverse_warp:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_WARPINV+*.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
