#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslreorient2std'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: $(inputs.output).log
stderr: $(inputs.output).log

inputs:
  input:
    type: File
    label: Input image to reorient
    inputBinding:
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      position: 2

outputs:
  reoriented_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: $(inputs.output).log
