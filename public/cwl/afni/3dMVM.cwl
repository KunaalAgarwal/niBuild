#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dMVM.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dMVM'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output filename prefix
    inputBinding: {prefix: -prefix}
  dataTable:
    type: File
    label: Data structure file with header
    inputBinding: {prefix: -dataTable}

  # Model specification
  bsVars:
    type: ['null', string]
    label: Between-subjects factors and quantitative variables formula
    inputBinding: {prefix: -bsVars}
  wsVars:
    type: ['null', string]
    label: Within-subject factors formula
    inputBinding: {prefix: -wsVars}
  qVars:
    type: ['null', string]
    label: Quantitative variables (covariates) list
    inputBinding: {prefix: -qVars}
  qVarCenters:
    type: ['null', string]
    label: Centering values for quantitative variables
    inputBinding: {prefix: -qVarCenters}

  # General linear tests
  num_glt:
    type: ['null', int]
    label: Number of general linear t-tests
    inputBinding: {prefix: -num_glt}
  gltLabel:
    type:
      - 'null'
      - type: array
        items: string
    label: GLT labels (k label pairs)
    inputBinding: {prefix: -gltLabel}
  gltCode:
    type:
      - 'null'
      - type: array
        items: string
    label: GLT coding specifications
    inputBinding: {prefix: -gltCode}

  # General linear F-tests
  num_glf:
    type: ['null', int]
    label: Number of general linear F-tests
    inputBinding: {prefix: -num_glf}
  glfLabel:
    type:
      - 'null'
      - type: array
        items: string
    label: GLF labels
    inputBinding: {prefix: -glfLabel}
  glfCode:
    type:
      - 'null'
      - type: array
        items: string
    label: GLF coding specifications
    inputBinding: {prefix: -glfCode}

  # Advanced options
  mVar:
    type: ['null', string]
    label: Treat within-subject levels as simultaneous variables
    inputBinding: {prefix: -mVar}
  SS_type:
    type: ['null', int]
    label: Sum of squares type (2 or 3)
    inputBinding: {prefix: -SS_type}
  wsMVT:
    type: ['null', boolean]
    label: Within-subject multivariate testing
    inputBinding: {prefix: -wsMVT}
  SC:
    type: ['null', boolean]
    label: Output sphericity-corrected F-statistics
    inputBinding: {prefix: -SC}
  GES:
    type: ['null', boolean]
    label: Report generalized eta-squared effect sizes
    inputBinding: {prefix: -GES}

  # Masking and processing
  mask:
    type: ['null', File]
    label: Process voxels within mask only
    inputBinding: {prefix: -mask}
  jobs:
    type: ['null', int]
    label: Number of parallel processors
    inputBinding: {prefix: -jobs}

outputs:
  stats:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+tlrc.HEAD
        - $(inputs.prefix)+tlrc.BRIK
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
