#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Usage: fslroi <input> <output> <xmin> <xsize> <ymin> <ysize> <zmin> <zsize>
# or:    fslroi <input> <output> <tmin> <tsize>
# Note: indexing (in both time and space) starts with 0 not 1
# Note: arguments are minimum index and size (not maximum index)

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslroi'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: $(inputs.output).log
stderr: $(inputs.output).log

inputs:
  input:
    type: File
    label: Input image
    inputBinding:
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      position: 2

  # Spatial ROI extraction (3D)
  x_min:
    type: ['null', int]
    label: Minimum x index
    inputBinding:
      position: 3
  x_size:
    type: ['null', int]
    label: Size in x dimension
    inputBinding:
      position: 4
  y_min:
    type: ['null', int]
    label: Minimum y index
    inputBinding:
      position: 5
  y_size:
    type: ['null', int]
    label: Size in y dimension
    inputBinding:
      position: 6
  z_min:
    type: ['null', int]
    label: Minimum z index
    inputBinding:
      position: 7
  z_size:
    type: ['null', int]
    label: Size in z dimension
    inputBinding:
      position: 8

  # Temporal ROI extraction (4D)
  t_min:
    type: ['null', int]
    label: Minimum time index
    inputBinding:
      position: 9
  t_size:
    type: ['null', int]
    label: Number of time points to extract
    inputBinding:
      position: 10

outputs:
  roi_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: $(inputs.output).log
