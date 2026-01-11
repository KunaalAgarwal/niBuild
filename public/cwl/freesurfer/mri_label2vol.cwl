#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_label2vol
# Converts surface labels to volume space

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_label2vol'

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

stdout: mri_label2vol.log
stderr: mri_label2vol.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Input options (mutually exclusive: label, annot, or seg)
  label:
    type: ['null', File]
    label: Label file to convert
    inputBinding:
      prefix: --label
      position: 1
  annot:
    type: ['null', File]
    label: Annotation file to convert
    inputBinding:
      prefix: --annot
      position: 1
  seg:
    type: ['null', File]
    label: Segmentation file to convert
    inputBinding:
      prefix: --seg
      position: 1

  # Required reference options
  temp:
    type: File
    label: Template volume for output geometry
    inputBinding:
      prefix: --temp
      position: 2
  output:
    type: string
    label: Output volume filename
    inputBinding:
      prefix: --o
      position: 3

  # Registration options
  reg:
    type: ['null', File]
    label: Registration file (source to anat)
    inputBinding:
      prefix: --reg
      position: 4
  identity:
    type: ['null', boolean]
    label: Use identity matrix for registration
    inputBinding:
      prefix: --identity
      position: 5

  # Subject options
  subject:
    type: ['null', string]
    label: Subject name for surface labels
    inputBinding:
      prefix: --subject
      position: 6
  hemi:
    type:
      - 'null'
      - type: enum
        symbols: [lh, rh]
    label: Hemisphere for surface labels
    inputBinding:
      prefix: --hemi
      position: 7

  # Projection options
  proj:
    type: ['null', string]
    label: Projection method and parameters (frac/abs start stop delta)
    inputBinding:
      prefix: --proj
      position: 8
  fill_thresh:
    type: ['null', double]
    label: Fill threshold (0-1)
    inputBinding:
      prefix: --fillthresh
      position: 9

  # Label value options
  label_voxel_volume:
    type: ['null', boolean]
    label: Fill with voxel volume instead of 1
    inputBinding:
      prefix: --label-voxel-volume
      position: 10
  native_vox2ras:
    type: ['null', boolean]
    label: Use native vox2ras
    inputBinding:
      prefix: --native-vox2ras
      position: 11

  # Surface options
  surf:
    type: ['null', string]
    label: Surface name for projection (default white)
    inputBinding:
      prefix: --surf
      position: 12

  # Other options
  hits:
    type: ['null', string]
    label: Save hits volume
    inputBinding:
      prefix: --hits
      position: 13
  labvoxvol:
    type: ['null', boolean]
    label: Label with voxel volume
    inputBinding:
      prefix: --labvoxvol
      position: 14

outputs:
  label_volume:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  hits_volume:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.hits)
  log:
    type: File
    outputBinding:
      glob: mri_label2vol.log
