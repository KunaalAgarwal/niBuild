#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mris_ca_label
# Automatic cortical labeling based on atlas

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mris_ca_label'

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
  InlineJavascriptRequirement: {}

stdout: mris_ca_label.log
stderr: mris_ca_label.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  subject:
    type: string
    label: Subject name
    inputBinding:
      position: 1
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      position: 2
  canonsurf:
    type: File
    label: Canonical surface (e.g., sphere.reg)
    inputBinding:
      position: 3
  classifier:
    type: File
    label: Atlas classifier file (.gcs)
    inputBinding:
      position: 4
  output:
    type: string
    label: Output annotation filename
    inputBinding:
      position: 5
      valueFrom: $(runtime.outdir + "/" + self)

  # Processing options
  aseg:
    type: ['null', File]
    label: Aseg volume for additional context
    inputBinding:
      prefix: -aseg
      position: -10
  l:
    type: ['null', File]
    label: Label file to restrict annotation
    inputBinding:
      prefix: -l
      position: -9
  seed:
    type: ['null', int]
    label: Random seed
    inputBinding:
      prefix: -seed
      position: -8
  t:
    type: ['null', File]
    label: Color table for output
    inputBinding:
      prefix: -t
      position: -7

  # Atlas options
  orig:
    type: ['null', string]
    label: Original surface name
    inputBinding:
      prefix: -orig
      position: -6
  sdir:
    type: ['null', string]
    label: Subjects directory
    inputBinding:
      prefix: -sdir
      position: -5
  novar:
    type: ['null', boolean]
    label: Do not use variance in classification
    inputBinding:
      prefix: -novar
      position: -4
  nbrs:
    type: ['null', int]
    label: Number of neighbors for classification
    inputBinding:
      prefix: -nbrs
      position: -3

outputs:
  annotation:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mris_ca_label.log
