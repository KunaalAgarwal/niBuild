#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  levels:
    type: int
    label: Number of factor levels
    inputBinding: {prefix: -levels}
  dset:
    type:
      type: array
      items: string
    label: Dataset specifications (level filename pairs)
    inputBinding: {prefix: -dset}
  bucket:
    type: string
    label: Output bucket dataset prefix
    inputBinding: {prefix: -bucket}

  # Output options
  ftr:
    type: ['null', string]
    label: F-statistic for treatment effect output prefix
    inputBinding: {prefix: -ftr}
  mean:
    type:
      - 'null'
      - type: array
        items: string
    label: Estimate of factor level mean (level prefix pairs)
    inputBinding: {prefix: -mean}
  diff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between factor levels (level1 level2 prefix)
    inputBinding: {prefix: -diff}
  contr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast in factor levels (coefficients prefix)
    inputBinding: {prefix: -contr}

  # Optional flags
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  voxel:
    type: ['null', int]
    label: Screen output for specific voxel
    inputBinding: {prefix: -voxel}
  debug:
    type: ['null', int]
    label: Debug level
    inputBinding: {prefix: -debug}
  old_method:
    type: ['null', boolean]
    label: Use previous ANOVA computation approach
    inputBinding: {prefix: -old_method}
  OK:
    type: ['null', boolean]
    label: Confirm understanding of contrast limitations
    inputBinding: {prefix: -OK}
  assume_sph:
    type: ['null', boolean]
    label: Assume sphericity for zero-sum contrasts
    inputBinding: {prefix: -assume_sph}

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
  f_stat:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.ftr)+orig.*
        - $(inputs.ftr)+tlrc.*
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
