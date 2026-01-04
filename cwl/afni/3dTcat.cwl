#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dTcat.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dTcat'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type:
      - File
      - type: array
        items: File
    label: Input dataset(s) to concatenate
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Alternative output naming
  session:
    type: ['null', string]
    label: Output dataset session directory
    inputBinding: {prefix: -session}
  glueto:
    type: ['null', File]
    label: Append bricks to the end of this dataset
    inputBinding: {prefix: -glueto}

  # Trend removal options
  rlt:
    type: ['null', boolean]
    label: Remove linear trends in each voxel time series
    inputBinding: {prefix: -rlt}
  rlt_plus:
    type: ['null', boolean]
    label: Remove trends while restoring individual dataset means
    inputBinding: {prefix: -rlt+}
  rlt_plusplus:
    type: ['null', boolean]
    label: Remove trends while restoring overall mean
    inputBinding: {prefix: -rlt++}

  # Label and timing options
  relabel:
    type: ['null', boolean]
    label: Replace sub-brick labels with input dataset name
    inputBinding: {prefix: -relabel}
  tpattern:
    type: ['null', string]
    label: Timing pattern for output dataset
    inputBinding: {prefix: -tpattern}
  tr:
    type: ['null', double]
    label: Repetition time in seconds for output dataset
    inputBinding: {prefix: -tr}

  # Other options
  verb:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding: {prefix: -verb}
  dry:
    type: ['null', boolean]
    label: Test run without making changes
    inputBinding: {prefix: -dry}

outputs:
  concatenated:
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
