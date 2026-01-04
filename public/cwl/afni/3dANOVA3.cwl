#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA3.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA3'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  type:
    type: int
    label: ANOVA model type (1-5 for different random/fixed combinations)
    inputBinding: {prefix: -type}
  alevels:
    type: int
    label: Number of levels for factor A
    inputBinding: {prefix: -alevels}
  blevels:
    type: int
    label: Number of levels for factor B
    inputBinding: {prefix: -blevels}
  clevels:
    type: int
    label: Number of levels for factor C
    inputBinding: {prefix: -clevels}
  dset:
    type:
      type: array
      items: string
    label: Dataset specifications (level_A level_B level_C filename)
    inputBinding: {prefix: -dset}
  bucket:
    type: string
    label: Output bucket dataset prefix
    inputBinding: {prefix: -bucket}

  # Output options - main effects
  fa:
    type: ['null', string]
    label: F-statistic for factor A
    inputBinding: {prefix: -fa}
  fb:
    type: ['null', string]
    label: F-statistic for factor B
    inputBinding: {prefix: -fb}
  fc:
    type: ['null', string]
    label: F-statistic for factor C
    inputBinding: {prefix: -fc}

  # Output options - interactions
  fab:
    type: ['null', string]
    label: F-statistic for A x B interaction
    inputBinding: {prefix: -fab}
  fac:
    type: ['null', string]
    label: F-statistic for A x C interaction
    inputBinding: {prefix: -fac}
  fbc:
    type: ['null', string]
    label: F-statistic for B x C interaction
    inputBinding: {prefix: -fbc}
  fabc:
    type: ['null', string]
    label: F-statistic for A x B x C interaction
    inputBinding: {prefix: -fabc}

  # Mean outputs
  amean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor A
    inputBinding: {prefix: -amean}
  bmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor B
    inputBinding: {prefix: -bmean}
  cmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor C
    inputBinding: {prefix: -cmean}

  # Optional flags
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  debug:
    type: ['null', int]
    label: Debug level
    inputBinding: {prefix: -debug}

outputs:
  stats:
    type: File
    outputBinding:
      glob:
        - $(inputs.bucket)+orig.HEAD
        - $(inputs.bucket)+orig.BRIK
        - $(inputs.bucket)+tlrc.HEAD
        - $(inputs.bucket)+tlrc.BRIK
        - $(inputs.bucket).nii
        - $(inputs.bucket).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
