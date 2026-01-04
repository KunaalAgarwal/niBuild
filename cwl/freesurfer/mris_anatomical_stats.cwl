#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mris_anatomical_stats
# Computes surface-based morphometric measures

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mris_anatomical_stats'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mris_anatomical_stats.log
stderr: mris_anatomical_stats.log

inputs:
  # Required inputs
  subject:
    type: string
    label: Subject name
    inputBinding:
      position: 50
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      position: 51

  # Annotation/parcellation options
  annotation:
    type: ['null', File]
    label: Annotation file for parcellation
    inputBinding:
      prefix: -a
      position: 1
  tablefile:
    type: ['null', string]
    label: Output table filename
    inputBinding:
      prefix: -f
      position: 2

  # Surface options
  white:
    type: ['null', string]
    label: White surface name (default white)
    inputBinding:
      position: 52
  pial:
    type: ['null', string]
    label: Pial surface name
    inputBinding:
      prefix: -pial
      position: 3

  # Label options
  label:
    type: ['null', File]
    label: Limit stats to label region
    inputBinding:
      prefix: -l
      position: 4
  cortex:
    type: ['null', File]
    label: Cortex label file
    inputBinding:
      prefix: -cortex
      position: 5

  # Thickness options
  th3:
    type: ['null', boolean]
    label: Use tetrahedra for volume (recommended)
    inputBinding:
      prefix: -th3
      position: 6
  thickness:
    type: ['null', string]
    label: Thickness file name
    inputBinding:
      prefix: -t
      position: 7

  # Output options
  b:
    type: ['null', boolean]
    label: Report total brain volume
    inputBinding:
      prefix: -b
      position: 8
  noglobal:
    type: ['null', boolean]
    label: Do not compute global stats
    inputBinding:
      prefix: -noglobal
      position: 9
  log:
    type: ['null', string]
    label: Log file name
    inputBinding:
      prefix: -log
      position: 10

  # Color table
  ctab:
    type: ['null', File]
    label: Color table file
    inputBinding:
      prefix: -ctab
      position: 11

  # Format options
  mgz:
    type: ['null', boolean]
    label: Use mgz format
    inputBinding:
      prefix: -mgz
      position: 12

outputs:
  stats_table:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.tablefile)
  stats:
    type: ['null', File]
    outputBinding:
      glob: "*.stats"
  log_file:
    type: File
    outputBinding:
      glob: mris_anatomical_stats.log
