#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dUnifize.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dUnifize'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {prefix: -input}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Image type
  T2:
    type: ['null', boolean]
    label: Process input as T2-weighted (inverts contrast)
    inputBinding: {prefix: -T2}
  EPI:
    type: ['null', boolean]
    label: Process T2/T2* weighted EPI time series
    inputBinding: {prefix: -EPI}

  # Processing options
  GM:
    type: ['null', boolean]
    label: Scale to unifize gray matter intensities
    inputBinding: {prefix: -GM}
  Urad:
    type: ['null', double]
    label: Radius in voxels for processing ball (default 18.3)
    inputBinding: {prefix: -Urad}
  clfrac:
    type: ['null', double]
    label: Automask clip level fraction (0.1-0.9, default 0.2)
    inputBinding: {prefix: -clfrac}

  # Algorithm options
  noduplo:
    type: ['null', boolean]
    label: Disable half-size volume processing step
    inputBinding: {prefix: -noduplo}
  nosquash:
    type: ['null', boolean]
    label: Disable reduction of large intensity values
    inputBinding: {prefix: -nosquash}
  T2up:
    type: ['null', double]
    label: Upper percentile for T2-T1 inversion (90-100)
    inputBinding: {prefix: -T2up}
  rbt:
    type: ['null', string]
    label: Algorithm parameters (radius bottom_percentile top_percentile)
    inputBinding: {prefix: -rbt}

  # Output options
  ssave:
    type: ['null', string]
    label: Save white matter scale factors to dataset
    inputBinding: {prefix: -ssave}
  amsave:
    type: ['null', string]
    label: Save automask-ed input dataset
    inputBinding: {prefix: -amsave}
  quiet:
    type: ['null', boolean]
    label: Suppress progress messages
    inputBinding: {prefix: -quiet}

outputs:
  unifized:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+orig.BRIK.gz
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  scale_factors:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.ssave)+orig.HEAD
        - $(inputs.ssave)+orig.BRIK
        - $(inputs.ssave).nii
        - $(inputs.ssave).nii.gz
  automask:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.amsave)+orig.HEAD
        - $(inputs.amsave)+orig.BRIK
        - $(inputs.amsave).nii
        - $(inputs.amsave).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
