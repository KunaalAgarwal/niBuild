#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/bbregister
# Boundary-based registration of EPI to FreeSurfer anatomy

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'bbregister'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: bbregister.log
stderr: bbregister.log

inputs:
  # Required inputs
  subject:
    type: string
    label: FreeSurfer subject name
    inputBinding:
      prefix: --s
      position: 1
  source_file:
    type: File
    label: Source (moveable) volume to register
    inputBinding:
      prefix: --mov
      position: 2
  out_reg_file:
    type: string
    label: Output registration file (.dat)
    inputBinding:
      prefix: --reg
      position: 3

  # Contrast type (required - choose one)
  contrast_type:
    type:
      - 'null'
      - type: enum
        symbols: [t1, t2, bold, dti]
    label: Contrast type of source image
    inputBinding:
      position: 4
      valueFrom: |
        ${
          if (self == 't1') return '--t1';
          if (self == 't2') return '--t2';
          if (self == 'bold') return '--bold';
          if (self == 'dti') return '--dti';
          return '';
        }

  # Initialization options
  init:
    type:
      - 'null'
      - type: enum
        symbols: [coreg, rr, spm, fsl, header, best]
    label: Registration initialization method
    inputBinding:
      prefix: --init
      position: 5
  init_fsl:
    type: ['null', boolean]
    label: Initialize using FSL FLIRT
    inputBinding:
      prefix: --init-fsl
      position: 6
  init_spm:
    type: ['null', boolean]
    label: Initialize using SPM spm_coreg
    inputBinding:
      prefix: --init-spm
      position: 7
  init_rr:
    type: ['null', boolean]
    label: Initialize using mri_robust_register
    inputBinding:
      prefix: --init-rr
      position: 8
  init_reg:
    type: ['null', File]
    label: Initialize with existing registration file
    inputBinding:
      prefix: --init-reg
      position: 9

  # Degrees of freedom
  dof:
    type:
      - 'null'
      - type: enum
        symbols: ['6', '9', '12']
    label: Degrees of freedom (6=rigid, 9=+scaling, 12=affine)
    inputBinding:
      prefix: --dof
      position: 10

  # Output options
  lta:
    type: ['null', boolean]
    label: Output as LTA format
    inputBinding:
      prefix: --lta
      position: 11
  fslmat:
    type: ['null', string]
    label: Output FSL-style matrix file
    inputBinding:
      prefix: --fslmat
      position: 12

  # Processing options
  int:
    type: ['null', File]
    label: Intermediate volume for registration
    inputBinding:
      prefix: --int
      position: 13
  mid_frame:
    type: ['null', boolean]
    label: Use middle frame of source
    inputBinding:
      prefix: --mid-frame
      position: 14
  frame:
    type: ['null', int]
    label: Use specific frame of source (0-based)
    inputBinding:
      prefix: --frame
      position: 15

  # BET options
  fsl_bet_mov:
    type: ['null', boolean]
    label: Apply BET to moveable volume
    inputBinding:
      prefix: --fsl-bet-mov
      position: 16
  no_fsl_bet_mov:
    type: ['null', boolean]
    label: Do not apply BET to moveable volume
    inputBinding:
      prefix: --no-fsl-bet-mov
      position: 17

  # Other options
  tmp:
    type: ['null', string]
    label: Temporary directory
    inputBinding:
      prefix: --tmp
      position: 18
  nocleanup:
    type: ['null', boolean]
    label: Do not delete temporary files
    inputBinding:
      prefix: --nocleanup
      position: 19

outputs:
  out_reg:
    type: File
    outputBinding:
      glob: $(inputs.out_reg_file)*
  out_fsl_mat:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.fslmat)
  mincost:
    type: ['null', File]
    outputBinding:
      glob: "*.mincost"
  log:
    type: File
    outputBinding:
      glob: bbregister.log
