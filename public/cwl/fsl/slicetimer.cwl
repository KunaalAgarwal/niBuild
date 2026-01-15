#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FLIRT
# Slice timing correction

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'slicetimer'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: slicetimer.log
stderr: slicetimer.log

inputs:
  input:
    type: File
    label: Input 4D timeseries
    inputBinding:
      prefix: --in=
      separate: false
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      prefix: --out=
      separate: false
      position: 2

  # Timing parameters
  tr:
    type: ['null', double]
    label: TR in seconds
    inputBinding:
      prefix: --repeat=
      separate: false
  global_shift:
    type: ['null', double]
    label: Global shift as fraction of TR (0-1, default 0.5)
    inputBinding:
      prefix: --tglobal=
      separate: false

  # Slice order options (mutually exclusive)
  slice_order:
    type:
      - 'null'
      - type: record
        name: interleaved
        fields:
          interleaved:
            type: boolean
            label: Interleaved slice order (odd slices first)
            inputBinding: {prefix: --odd, position: 3}
      - type: record
        name: down
        fields:
          down:
            type: boolean
            label: Reverse slice order (top to bottom)
            inputBinding: {prefix: --down, position: 3}
      - type: record
        name: custom_order
        fields:
          custom_order:
            type: File
            label: Custom slice order file
            inputBinding: {prefix: --ocustom=, position: 3, separate: false}
      - type: record
        name: custom_timings
        fields:
          custom_timings:
            type: File
            label: Custom slice timings file (fractions of TR)
            inputBinding: {prefix: --tcustom=, position: 3, separate: false}

  # Slice direction
  direction:
    type: ['null', int]
    label: Slice acquisition direction (1=x, 2=y, 3=z, default 3)
    inputBinding:
      prefix: --direction=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v

outputs:
  slice_time_corrected:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  log:
    type: File
    outputBinding:
      glob: slicetimer.log
