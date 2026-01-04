#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/SUSAN
# Reduces noise while preserving edges

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'susan'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: susan.log
stderr: susan.log

inputs:
  input:
    type: File
    label: Input image
    inputBinding:
      position: 1
  brightness_threshold:
    type: double
    label: Brightness threshold (should be > noise and < edge contrast)
    inputBinding:
      position: 2
  fwhm:
    type: double
    label: Spatial extent (FWHM in mm)
    inputBinding:
      position: 3
  dimension:
    type: ['null', int]
    label: Dimensionality (2=2D, 3=3D, default 3)
    default: 3
    inputBinding:
      position: 4
  use_median:
    type: ['null', int]
    label: Use median (1) or mean (0) for brightness calculation (default 1)
    default: 1
    inputBinding:
      position: 5
  n_usans:
    type: ['null', int]
    label: Number of USAN areas to use (0, 1, or 2)
    default: 0
    inputBinding:
      position: 6
  output:
    type: string
    label: Output filename
    inputBinding:
      position: 100

outputs:
  smoothed_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
        - $(inputs.output)
  log:
    type: File
    outputBinding:
      glob: susan.log
