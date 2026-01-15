#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/asegstats2table
# Collects subcortical stats across subjects into table

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'asegstats2table'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:7.4.1

requirements:
  EnvVarRequirement:
    envDef:
      - envName: SUBJECTS_DIR
        envValue: $(inputs.subjects_dir.path)
      - envName: FS_LICENSE
        envValue: $(inputs.fs_license.path)

stdout: asegstats2table.log
stderr: asegstats2table.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  subjects:
    type: 'string[]'
    label: List of subject names
    inputBinding:
      prefix: --subjects
      position: 1
  tablefile:
    type: string
    label: Output table filename
    inputBinding:
      prefix: --tablefile
      position: 2

  # Measurement options
  meas:
    type:
      - 'null'
      - type: enum
        symbols: [volume, mean]
    label: Measurement to extract (default volume)
    inputBinding:
      prefix: --meas
      position: 3

  # Stats file options
  statsfile:
    type: ['null', string]
    label: Stats file name (default aseg.stats)
    inputBinding:
      prefix: --statsfile
      position: 4

  # Delimiter options
  delimiter:
    type:
      - 'null'
      - type: enum
        symbols: [tab, comma, space, semicolon]
    label: Delimiter for output table
    inputBinding:
      prefix: --delimiter
      position: 5

  # Subjects file option
  subjectsfile:
    type: ['null', File]
    label: File containing subject list
    inputBinding:
      prefix: --subjectsfile
      position: 6

  # Segmentation options
  segno:
    type: ['null', 'int[]']
    label: Only output specific segmentation numbers
    inputBinding:
      prefix: --segno
      position: 7
  segids:
    type: ['null', File]
    label: File with segmentation IDs to extract
    inputBinding:
      prefix: --segids
      position: 8

  # Other options
  skip:
    type: ['null', boolean]
    label: Skip subjects with missing data
    inputBinding:
      prefix: --skip
      position: 9
  all_segs:
    type: ['null', boolean]
    label: Include all segmentations
    inputBinding:
      prefix: --all-segs
      position: 10
  common_segs:
    type: ['null', boolean]
    label: Only output segs common to all subjects
    inputBinding:
      prefix: --common-segs
      position: 11
  transpose:
    type: ['null', boolean]
    label: Transpose output table
    inputBinding:
      prefix: --transpose
      position: 12
  etiv:
    type: ['null', boolean]
    label: Include estimated total intracranial volume
    inputBinding:
      prefix: --etiv
      position: 13
  etiv_only:
    type: ['null', boolean]
    label: Only output eTIV
    inputBinding:
      prefix: --etiv-only
      position: 14
  eulerNo:
    type: ['null', boolean]
    label: Include Euler number
    inputBinding:
      prefix: --euler
      position: 15

outputs:
  table:
    type: File
    outputBinding:
      glob: $(inputs.tablefile)
  log:
    type: File
    outputBinding:
      glob: asegstats2table.log
