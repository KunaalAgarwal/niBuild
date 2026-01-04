#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA2.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA2'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  type:
    type: int
    label: ANOVA model type (1=random A, 2=random B, 3=both fixed)
    inputBinding: {prefix: -type}
  alevels:
    type: int
    label: Number of levels for factor A
    inputBinding: {prefix: -alevels}
  blevels:
    type: int
    label: Number of levels for factor B
    inputBinding: {prefix: -blevels}
  dset:
    type:
      type: array
      items: string
    label: Dataset specifications (level_A level_B filename)
    inputBinding: {prefix: -dset}
  bucket:
    type: string
    label: Output bucket dataset prefix
    inputBinding: {prefix: -bucket}

  # Output options
  fa:
    type: ['null', string]
    label: F-statistic for factor A
    inputBinding: {prefix: -fa}
  fb:
    type: ['null', string]
    label: F-statistic for factor B
    inputBinding: {prefix: -fb}
  fab:
    type: ['null', string]
    label: F-statistic for interaction
    inputBinding: {prefix: -fab}
  amean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor A (level prefix)
    inputBinding: {prefix: -amean}
  bmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor B (level prefix)
    inputBinding: {prefix: -bmean}
  adiff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between levels of A (level1 level2 prefix)
    inputBinding: {prefix: -adiff}
  bdiff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between levels of B (level1 level2 prefix)
    inputBinding: {prefix: -bdiff}
  acontr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast for factor A
    inputBinding: {prefix: -acontr}
  bcontr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast for factor B
    inputBinding: {prefix: -bcontr}

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
