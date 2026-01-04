#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dfractionize.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dfractionize'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  template:
    type: File
    label: Template dataset defining output grid
    inputBinding: {prefix: -template}
  input:
    type: File
    label: Input dataset to fractionize
    inputBinding: {prefix: -input}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Threshold
  clip:
    type: ['null', double]
    label: Occupancy threshold (0-1 fraction, 1-100 percent, 100+ direct value)
    inputBinding: {prefix: -clip}

  # Transformation
  warp:
    type: ['null', File]
    label: Transformation from +orig to input coordinates
    inputBinding: {prefix: -warp}

  # Preservation mode
  preserve:
    type: ['null', boolean]
    label: Copy nonzero input values instead of creating fractional mask
    inputBinding: {prefix: -preserve}
  vote:
    type: ['null', boolean]
    label: Use voting mechanism (same as -preserve)
    inputBinding: {prefix: -vote}

outputs:
  fractionized:
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
