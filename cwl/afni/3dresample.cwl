#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dresample.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dresample'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {prefix: -input}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Grid specification
  master:
    type: ['null', File]
    label: Align grid to master dataset
    inputBinding: {prefix: -master}
  dxyz:
    type: ['null', string]
    label: Resample to new voxel dimensions (dx dy dz in mm)
    inputBinding: {prefix: -dxyz}

  # Orientation
  orient:
    type: ['null', string]
    label: Reorient to new axis order (3-char code from APS, IRL)
    inputBinding: {prefix: -orient}

  # Resampling method
  rmode:
    type:
      - 'null'
      - type: enum
        symbols: [NN, Li, Cu, Bk]
    label: Resampling method (NN=nearest neighbor, Li=linear, Cu=cubic, Bk=blocky)
    inputBinding: {prefix: -rmode}

  # Boundary handling
  bound_type:
    type:
      - 'null'
      - type: enum
        symbols: [FOV, SLAB, CENT_ORIG, CENT]
    label: Boundary preservation method
    inputBinding: {prefix: -bound_type}

  # Scaling options
  upsample:
    type: ['null', int]
    label: Upsample voxels by factor (makes voxels smaller)
    inputBinding: {prefix: -upsample}
  downsample:
    type: ['null', int]
    label: Downsample voxels by factor (makes voxels larger)
    inputBinding: {prefix: -downsample}
  delta_scale:
    type: ['null', double]
    label: Generalized voxel size rescaling (<1 upsample, >1 downsample)
    inputBinding: {prefix: -delta_scale}

  # Debug
  debug:
    type: ['null', int]
    label: Debug level (0-2)
    inputBinding: {prefix: -debug}

outputs:
  resampled:
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
