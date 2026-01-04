#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Usage: fslsplit <input> [output_basename] [-t|-x|-y|-z]
# Splits a 4D file into separate 3D files

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslsplit'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fslsplit.log
stderr: fslsplit.log

inputs:
  input:
    type: File
    label: Input 4D image
    inputBinding:
      position: 1
  output_basename:
    type: ['null', string]
    label: Output basename for split files
    inputBinding:
      position: 2

  # Split dimension (mutually exclusive)
  dimension:
    type:
      - 'null'
      - type: enum
        symbols: [t, x, y, z]
    label: Dimension to split along (t=time, x, y, z)
    inputBinding:
      prefix: '-'
      separate: false
      position: 3

outputs:
  split_files:
    type: File[]
    outputBinding:
      glob:
        - "*.nii.gz"
        - "*.nii"
  log:
    type: File
    outputBinding:
      glob: fslsplit.log
