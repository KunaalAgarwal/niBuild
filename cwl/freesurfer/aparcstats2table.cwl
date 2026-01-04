#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/aparcstats2table
# Collects parcellation stats across subjects into table

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'aparcstats2table'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: aparcstats2table.log
stderr: aparcstats2table.log

inputs:
  # Required inputs
  subjects:
    type: 'string[]'
    label: List of subject names
    inputBinding:
      prefix: --subjects
      position: 1
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      prefix: --hemi
      position: 2
  tablefile:
    type: string
    label: Output table filename
    inputBinding:
      prefix: --tablefile
      position: 3

  # Parcellation options
  parc:
    type: ['null', string]
    label: Parcellation name (default aparc)
    inputBinding:
      prefix: --parc
      position: 4

  # Measurement options
  meas:
    type:
      - 'null'
      - type: enum
        symbols: [area, volume, thickness, thicknessstd, meancurv, gauscurv, foldind, curvind]
    label: Measurement to extract
    inputBinding:
      prefix: --meas
      position: 5

  # Delimiter options
  delimiter:
    type:
      - 'null'
      - type: enum
        symbols: [tab, comma, space, semicolon]
    label: Delimiter for output table
    inputBinding:
      prefix: --delimiter
      position: 6

  # Subjects file option
  subjectsfile:
    type: ['null', File]
    label: File containing subject list
    inputBinding:
      prefix: --subjectsfile
      position: 7

  # Other options
  skip:
    type: ['null', boolean]
    label: Skip subjects with missing data
    inputBinding:
      prefix: --skip
      position: 8
  parcid_only:
    type: ['null', boolean]
    label: Only output parcellation IDs
    inputBinding:
      prefix: --parcid-only
      position: 9
  common_parcs:
    type: ['null', boolean]
    label: Only output parcels common to all subjects
    inputBinding:
      prefix: --common-parcs
      position: 10
  report_rois:
    type: ['null', boolean]
    label: Report which ROIs differ
    inputBinding:
      prefix: --report-rois
      position: 11
  transpose:
    type: ['null', boolean]
    label: Transpose output table
    inputBinding:
      prefix: --transpose
      position: 12

outputs:
  table:
    type: File
    outputBinding:
      glob: $(inputs.tablefile)
  log:
    type: File
    outputBinding:
      glob: aparcstats2table.log
