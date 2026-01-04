#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dinfo.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dinfo'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: 3dinfo_output.txt
stderr: 3dinfo.log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {position: 100}

  # Verbosity modes
  verb:
    type: ['null', boolean]
    label: Output extensive information
    inputBinding: {prefix: -verb}
  VERB:
    type: ['null', boolean]
    label: Additional details including slice timing
    inputBinding: {prefix: -VERB}
  short:
    type: ['null', boolean]
    label: Minimal output (default)
    inputBinding: {prefix: -short}
  no_hist:
    type: ['null', boolean]
    label: Omit history text
    inputBinding: {prefix: -no_hist}

  # Dataset properties
  exists:
    type: ['null', boolean]
    label: Returns 1 if loadable, 0 otherwise
    inputBinding: {prefix: -exists}
  id:
    type: ['null', boolean]
    label: Display idcode string
    inputBinding: {prefix: -id}
  prefix:
    type: ['null', boolean]
    label: Return dataset prefix
    inputBinding: {prefix: -prefix}
  prefix_noext:
    type: ['null', boolean]
    label: Return prefix without extensions
    inputBinding: {prefix: -prefix_noext}
  space:
    type: ['null', boolean]
    label: Show coordinate space
    inputBinding: {prefix: -space}
  is_nifti:
    type: ['null', boolean]
    label: Indicate NIFTI format
    inputBinding: {prefix: -is_nifti}
  is_oblique:
    type: ['null', boolean]
    label: Report obliquity status
    inputBinding: {prefix: -is_oblique}
  handedness:
    type: ['null', boolean]
    label: Return L or R for orientation
    inputBinding: {prefix: -handedness}

  # Dimensional information
  ni:
    type: ['null', boolean]
    label: Voxel count in i dimension
    inputBinding: {prefix: -ni}
  nj:
    type: ['null', boolean]
    label: Voxel count in j dimension
    inputBinding: {prefix: -nj}
  nk:
    type: ['null', boolean]
    label: Voxel count in k dimension
    inputBinding: {prefix: -nk}
  nt:
    type: ['null', boolean]
    label: Number of time points
    inputBinding: {prefix: -nt}
  nv:
    type: ['null', boolean]
    label: Number of sub-bricks
    inputBinding: {prefix: -nv}
  nijk:
    type: ['null', boolean]
    label: Total voxel count
    inputBinding: {prefix: -nijk}

  # Spatial parameters
  di:
    type: ['null', boolean]
    label: Signed voxel displacement in i
    inputBinding: {prefix: -di}
  dj:
    type: ['null', boolean]
    label: Signed voxel displacement in j
    inputBinding: {prefix: -dj}
  dk:
    type: ['null', boolean]
    label: Signed voxel displacement in k
    inputBinding: {prefix: -dk}
  tr:
    type: ['null', boolean]
    label: Repetition time in seconds
    inputBinding: {prefix: -tr}
  voxvol:
    type: ['null', boolean]
    label: Voxel volume in cubic mm
    inputBinding: {prefix: -voxvol}

  # Data range
  dmin:
    type: ['null', boolean]
    label: Minimum value
    inputBinding: {prefix: -dmin}
  dmax:
    type: ['null', boolean]
    label: Maximum value
    inputBinding: {prefix: -dmax}

outputs:
  info:
    type: stdout
  log:
    type: File
    outputBinding:
      glob: 3dinfo.log
