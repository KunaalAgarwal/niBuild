#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/whereami.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'whereami'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: whereami_output.txt
stderr: whereami.log

inputs:
  # Coordinate input (one of these required)
  coord:
    type:
      - 'null'
      - type: array
        items: double
    label: Brain location in mm (x y z)
    inputBinding: {position: 1}
  coord_file:
    type: ['null', File]
    label: Input coordinates from file
    inputBinding: {prefix: -coord_file}

  # Coordinate orientation
  lpi:
    type: ['null', boolean]
    label: Input uses LPI/SPM orientation
    inputBinding: {prefix: -lpi}
  rai:
    type: ['null', boolean]
    label: Input uses RAI/DICOM orientation
    inputBinding: {prefix: -rai}

  # Atlas selection
  atlas:
    type: ['null', string]
    label: Specify atlas(es) to use
    inputBinding: {prefix: -atlas}
  show_atlas_code:
    type: ['null', boolean]
    label: Show integer code to area label map
    inputBinding: {prefix: -show_atlas_code}
  show_atlas_region:
    type: ['null', string]
    label: Show region using symbolic notation (Atlas:Side:Area)
    inputBinding: {prefix: -show_atlas_region}

  # Mask output
  mask_atlas_region:
    type: ['null', string]
    label: Create mask for specified region
    inputBinding: {prefix: -mask_atlas_region}
  prefix:
    type: ['null', string]
    label: Output prefix for mask datasets
    inputBinding: {prefix: -prefix}

  # Template space
  space:
    type: ['null', string]
    label: Template space (MNI, TLRC, etc.)
    inputBinding: {prefix: -space}
  dset:
    type: ['null', File]
    label: Determine template space from reference dataset
    inputBinding: {prefix: -dset}

  # Search parameters
  max_areas:
    type: ['null', int]
    label: Maximum distinct areas to report
    inputBinding: {prefix: -max_areas}
  max_search_radius:
    type: ['null', double]
    label: Maximum search distance
    inputBinding: {prefix: -max_search_radius}
  min_prob:
    type: ['null', double]
    label: Minimum probability threshold for probabilistic atlases
    inputBinding: {prefix: -min_prob}

  # ROI overlap analysis
  bmask:
    type: ['null', File]
    label: Report overlap of non-zero voxels with atlas regions
    inputBinding: {prefix: -bmask}
  omask:
    type: ['null', File]
    label: Report each ROI overlap separately
    inputBinding: {prefix: -omask}

  # Output format
  classic:
    type: ['null', boolean]
    label: Standard output format
    inputBinding: {prefix: -classic}
  tab:
    type: ['null', boolean]
    label: Tab-delimited output format
    inputBinding: {prefix: -tab}

outputs:
  output:
    type: stdout
  mask_output:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.prefix)+tlrc.*
        - $(inputs.prefix)+orig.*
        - $(inputs.prefix).nii*
  log:
    type: File
    outputBinding:
      glob: whereami.log
