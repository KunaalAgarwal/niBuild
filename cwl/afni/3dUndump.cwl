#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dUndump.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dUndump'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input coordinate text file
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Grid specification (one required)
  master:
    type: ['null', File]
    label: Master dataset determining output geometry
    inputBinding: {prefix: -master}
  dimen:
    type: ['null', string]
    label: Set output dimensions (I J K voxels)
    inputBinding: {prefix: -dimen}

  # Masking
  mask:
    type: ['null', File]
    label: Mask controlling which voxels receive values
    inputBinding: {prefix: -mask}

  # Data type
  datum:
    type:
      - 'null'
      - type: enum
        symbols: [byte, short, float]
    label: Voxel data type (default short)
    inputBinding: {prefix: -datum}

  # Values
  dval:
    type: ['null', double]
    label: Default value for unspecified input voxels (default 1)
    inputBinding: {prefix: -dval}
  fval:
    type: ['null', double]
    label: Fill value for unlisted voxels (default 0)
    inputBinding: {prefix: -fval}

  # Coordinate interpretation
  ijk:
    type: ['null', boolean]
    label: Input coordinates as (i,j,k) index triples
    inputBinding: {prefix: -ijk}
  xyz:
    type: ['null', boolean]
    label: Input coordinates as (x,y,z) spatial mm coordinates
    inputBinding: {prefix: -xyz}
  orient:
    type: ['null', string]
    label: Coordinate order (3-letter code)
    inputBinding: {prefix: -orient}

  # Shape options
  srad:
    type: ['null', double]
    label: Sphere radius around each input point
    inputBinding: {prefix: -srad}
  cubes:
    type: ['null', boolean]
    label: Use cubes instead of spheres
    inputBinding: {prefix: -cubes}

  # ROI options
  ROImask:
    type: ['null', File]
    label: Specify voxel values via ROI dataset labels
    inputBinding: {prefix: -ROImask}

  # Other options
  head_only:
    type: ['null', boolean]
    label: Create only .HEAD file
    inputBinding: {prefix: -head_only}
  allow_NaN:
    type: ['null', boolean]
    label: Permit NaN floating-point values
    inputBinding: {prefix: -allow_NaN}

outputs:
  dataset:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+tlrc.HEAD
        - $(inputs.prefix)+tlrc.BRIK
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
