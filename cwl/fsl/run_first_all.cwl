#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FIRST
# Subcortical structure segmentation

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'run_first_all'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: run_first_all.log
stderr: run_first_all.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input T1-weighted image
    inputBinding:
      prefix: -i
  output:
    type: string
    label: Output basename
    inputBinding:
      prefix: -o

  # Options
  brain_extracted:
    type: ['null', boolean]
    label: Input is already brain extracted
    inputBinding:
      prefix: -b
  method:
    type:
      - 'null'
      - type: enum
        symbols: [auto, fast, none]
    label: Boundary correction method
    inputBinding:
      prefix: -m
  structures:
    type: ['null', string]
    label: Run only on specified structures (comma-separated list)
    inputBinding:
      prefix: -s
  affine:
    type: ['null', File]
    label: Use this affine matrix for registration
    inputBinding:
      prefix: -a
  three_stage:
    type: ['null', boolean]
    label: Use 3-stage registration
    inputBinding:
      prefix: -3
  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v
  debug:
    type: ['null', boolean]
    label: Debug mode (don't delete temporary files)
    inputBinding:
      prefix: -d

outputs:
  segmentation_files:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output)_all_fast_firstseg.nii.gz
        - $(inputs.output)_all_fast_origsegs.nii.gz
        - $(inputs.output)-*_first.nii.gz
  vtk_meshes:
    type: File[]
    outputBinding:
      glob: $(inputs.output)-*.vtk
  bvars:
    type: File[]
    outputBinding:
      glob: $(inputs.output)-*.bvars
  log:
    type: File
    outputBinding:
      glob: run_first_all.log
