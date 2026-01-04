#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_aparc2aseg
# Combines cortical parcellation with subcortical segmentation

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_aparc2aseg'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_aparc2aseg.log
stderr: mri_aparc2aseg.log

inputs:
  # Required inputs
  subject:
    type: string
    label: Subject name
    inputBinding:
      prefix: --s
      position: 1

  # Output options
  output:
    type: ['null', string]
    label: Output volume filename
    inputBinding:
      prefix: --o
      position: 2
  volmask:
    type: ['null', File]
    label: Volume mask for output
    inputBinding:
      prefix: --volmask
      position: 3

  # Annotation options
  annot:
    type: ['null', string]
    label: Parcellation name (default aparc)
    inputBinding:
      prefix: --annot
      position: 4
  a2005s:
    type: ['null', boolean]
    label: Use aparc.a2005s parcellation
    inputBinding:
      prefix: --a2005s
      position: 5
  a2009s:
    type: ['null', boolean]
    label: Use aparc.a2009s parcellation
    inputBinding:
      prefix: --a2009s
      position: 6

  # Label ID options
  labelwm:
    type: ['null', boolean]
    label: Also label white matter parcels
    inputBinding:
      prefix: --labelwm
      position: 7
  rip_unknown:
    type: ['null', boolean]
    label: Rip unknown label
    inputBinding:
      prefix: --rip-unknown
      position: 8
  hypo_as_wm:
    type: ['null', boolean]
    label: Label hypointensities as white matter
    inputBinding:
      prefix: --hypo-as-wm
      position: 9

  # Ribbon options
  noribbon:
    type: ['null', boolean]
    label: Do not use ribbon constraint
    inputBinding:
      prefix: --noribbon
      position: 10
  ribbon:
    type: ['null', File]
    label: Use specified ribbon file
    inputBinding:
      prefix: --ribbon
      position: 11

  # Other options
  ctxseg:
    type: ['null', boolean]
    label: Create segmentation of cortex
    inputBinding:
      prefix: --ctxseg
      position: 12
  wmparc_dmax:
    type: ['null', double]
    label: Distance max for WM parcellation
    inputBinding:
      prefix: --wmparc-dmax
      position: 13
  ctxgmrmax:
    type: ['null', double]
    label: Radius for cortical GM assignment
    inputBinding:
      prefix: --crs-test
      position: 14

outputs:
  aparc_aseg:
    type: File
    outputBinding:
      glob:
        - $(inputs.output)
        - "*aparc+aseg*.mgz"
        - "*aparc+aseg*.nii.gz"
  log:
    type: File
    outputBinding:
      glob: mri_aparc2aseg.log
