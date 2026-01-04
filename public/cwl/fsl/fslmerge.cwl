#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Usage: fslmerge <-t|-x|-y|-z|-a|-tr> <output> <file1> <file2> ...
# Concatenates images in time, x, y, z, or auto dimension

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslmerge'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: $(inputs.output).log
stderr: $(inputs.output).log

inputs:
  dimension:
    type:
      type: enum
      symbols: [t, x, y, z, a]
    label: Dimension to merge along (t=time, x, y, z, a=auto)
    inputBinding:
      prefix: '-'
      separate: false
      position: 1
  output:
    type: string
    label: Output merged filename
    inputBinding:
      position: 2
  input_files:
    type: File[]
    label: Input files to merge
    inputBinding:
      position: 3

  # Optional TR specification (only with -t)
  tr:
    type: ['null', double]
    label: TR in seconds (when merging in time)
    inputBinding:
      position: 100

outputs:
  merged_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: $(inputs.output).log
