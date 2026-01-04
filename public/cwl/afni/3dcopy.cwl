#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dcopy.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dcopy'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.new_prefix).log
stderr: $(inputs.new_prefix).log

inputs:
  old_dataset:
    type: File
    label: Source dataset to copy
    inputBinding: {position: 1}
  new_prefix:
    type: string
    label: New dataset prefix
    inputBinding: {position: 2}

  # Options
  verb:
    type: ['null', boolean]
    label: Print progress reports
    inputBinding: {prefix: -verb}
  denote:
    type: ['null', boolean]
    label: Remove Notes from the file
    inputBinding: {prefix: -denote}

outputs:
  copied:
    type: File
    outputBinding:
      glob:
        - $(inputs.new_prefix)+orig.HEAD
        - $(inputs.new_prefix)+orig.BRIK
        - $(inputs.new_prefix)+tlrc.HEAD
        - $(inputs.new_prefix)+tlrc.BRIK
        - $(inputs.new_prefix).nii
        - $(inputs.new_prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.new_prefix).log
