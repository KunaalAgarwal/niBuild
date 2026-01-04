#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_annotation2label
# Converts surface annotation to individual label files

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_annotation2label'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_annotation2label.log
stderr: mri_annotation2label.log

inputs:
  # Required inputs
  subject:
    type: string
    label: Subject name
    inputBinding:
      prefix: --subject
      position: 1
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      prefix: --hemi
      position: 2

  # Annotation options
  annotation:
    type: ['null', string]
    label: Annotation name (default aparc)
    inputBinding:
      prefix: --annotation
      position: 3
  surface:
    type: ['null', string]
    label: Surface name (default white)
    inputBinding:
      prefix: --surface
      position: 4

  # Output options
  outdir:
    type: string
    label: Output directory for label files
    inputBinding:
      prefix: --outdir
      position: 5
  labelbase:
    type: ['null', string]
    label: Base name for output labels
    inputBinding:
      prefix: --labelbase
      position: 6

  # Border options
  border:
    type: ['null', string]
    label: Output border file
    inputBinding:
      prefix: --border
      position: 7
  borderdilate:
    type: ['null', int]
    label: Dilate border by N
    inputBinding:
      prefix: --borderdilate
      position: 8

  # Other options
  ctab:
    type: ['null', File]
    label: Color table file
    inputBinding:
      prefix: --ctab
      position: 9
  seg:
    type: ['null', boolean]
    label: Output segmentation instead of labels
    inputBinding:
      prefix: --seg
      position: 10

outputs:
  labels:
    type: Directory
    outputBinding:
      glob: $(inputs.outdir)
  border_file:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.border)
  log:
    type: File
    outputBinding:
      glob: mri_annotation2label.log
