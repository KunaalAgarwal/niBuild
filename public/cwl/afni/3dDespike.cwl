#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dDespike.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dDespike'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

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

  # Processing options
  ignore:
    type: ['null', int]
    label: Ignore the first I points in the time series
    inputBinding: {prefix: -ignore}
  corder:
    type: ['null', int]
    label: Curve fit order (default NT/30)
    inputBinding: {prefix: -corder}
  cut:
    type: ['null', string]
    label: Spike threshold values (default "2.5 4.0")
    inputBinding: {prefix: -cut}

  # Mask options
  nomask:
    type: ['null', boolean]
    label: Process all voxels instead of using auto-mask
    inputBinding: {prefix: -nomask}
  dilate:
    type: ['null', int]
    label: Dilation iterations for automask (default 4)
    inputBinding: {prefix: -dilate}

  # Algorithm options
  localedit:
    type: ['null', boolean]
    label: Use alternative spike replacement method
    inputBinding: {prefix: -localedit}
  NEW:
    type: ['null', boolean]
    label: Use faster fitting method for long series
    inputBinding: {prefix: -NEW}
  NEW25:
    type: ['null', boolean]
    label: More aggressive despiking than NEW
    inputBinding: {prefix: -NEW25}
  OLD:
    type: ['null', boolean]
    label: Disable NEW processing if enabled
    inputBinding: {prefix: -OLD}

  # Output options
  ssave:
    type: ['null', string]
    label: Save spikiness measure to 3D+time dataset
    inputBinding: {prefix: -ssave}
  quiet:
    type: ['null', boolean]
    label: Suppress informational messages
    inputBinding: {prefix: -quiet}

outputs:
  despiked:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  spikiness:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.ssave)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
