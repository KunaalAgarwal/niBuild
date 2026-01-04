#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/Tracula
# Post-registration processing for diffusion (part of TRACULA pipeline)

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'dmri_postreg'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: dmri_postreg.log
stderr: dmri_postreg.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input diffusion volume
    inputBinding:
      prefix: --i
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      prefix: --o
      position: 2

  # Registration options
  reg:
    type: ['null', File]
    label: Registration file (DWI to anatomy)
    inputBinding:
      prefix: --reg
      position: 3
  xfm:
    type: ['null', File]
    label: Transformation matrix
    inputBinding:
      prefix: --xfm
      position: 4

  # Reference options
  ref:
    type: ['null', File]
    label: Reference volume
    inputBinding:
      prefix: --ref
      position: 5

  # Mask options
  mask:
    type: ['null', File]
    label: Brain mask
    inputBinding:
      prefix: --mask
      position: 6

  # Subject options
  subject:
    type: ['null', string]
    label: FreeSurfer subject name
    inputBinding:
      prefix: --s
      position: 7

  # Interpolation options
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [nearest, trilin, cubic]
    label: Interpolation method
    inputBinding:
      prefix: --interp
      position: 8

  # Other options
  noresample:
    type: ['null', boolean]
    label: Do not resample
    inputBinding:
      prefix: --noresample
      position: 9

outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: dmri_postreg.log
