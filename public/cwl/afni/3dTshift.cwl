#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dTshift.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dTshift'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input 3D+time dataset
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Timing options
  TR:
    type: ['null', double]
    label: TR in seconds (overrides header value)
    inputBinding: {prefix: -TR}
  tzero:
    type: ['null', double]
    label: Align each slice to this time offset
    inputBinding: {prefix: -tzero}
  slice:
    type: ['null', int]
    label: Align to temporal offset of this slice number
    inputBinding: {prefix: -slice}
  tpattern:
    type: ['null', string]
    label: Slice timing pattern (alt+z, alt-z, seq+z, seq-z, @filename)
    inputBinding: {prefix: -tpattern}

  # Data handling
  ignore:
    type: ['null', int]
    label: Ignore the first N points (default 0)
    inputBinding: {prefix: -ignore}
  rlt:
    type: ['null', boolean]
    label: Remove mean and linear trend from output
    inputBinding: {prefix: -rlt}
  rlt_plus:
    type: ['null', boolean]
    label: Remove trend then restore only mean to output
    inputBinding: {prefix: -rlt+}
  no_detrend:
    type: ['null', boolean]
    label: Do not remove or restore linear trend
    inputBinding: {prefix: -no_detrend}

  # Interpolation methods (mutually exclusive)
  Fourier:
    type: ['null', boolean]
    label: Fourier interpolation (default, most accurate)
    inputBinding: {prefix: -Fourier}
  linear:
    type: ['null', boolean]
    label: Linear interpolation (least accurate)
    inputBinding: {prefix: -linear}
  cubic:
    type: ['null', boolean]
    label: Cubic Lagrange polynomial interpolation
    inputBinding: {prefix: -cubic}
  quintic:
    type: ['null', boolean]
    label: Quintic Lagrange polynomial interpolation
    inputBinding: {prefix: -quintic}
  heptic:
    type: ['null', boolean]
    label: Heptic Lagrange polynomial interpolation
    inputBinding: {prefix: -heptic}
  wsinc5:
    type: ['null', boolean]
    label: Weighted sinc interpolation (plus/minus 5)
    inputBinding: {prefix: -wsinc5}
  wsinc9:
    type: ['null', boolean]
    label: Weighted sinc interpolation (plus/minus 9)
    inputBinding: {prefix: -wsinc9}

  # Advanced options
  voxshift:
    type: ['null', File]
    label: Dataset with voxel-wise shift fractions per TR
    inputBinding: {prefix: -voxshift}
  verbose:
    type: ['null', boolean]
    label: Print lots of messages while program runs
    inputBinding: {prefix: -verbose}

outputs:
  shifted:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+orig.BRIK.gz
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
