#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_segment
# White matter segmentation

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_segment'

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

stdout: mri_segment.log
stderr: mri_segment.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  input:
    type: File
    label: Input normalized volume (white matter ~110)
    inputBinding:
      position: 50
  output:
    type: string
    label: Output segmentation filename
    inputBinding:
      position: 51

  # Segmentation thresholds
  wlo:
    type: ['null', double]
    label: White matter low intensity threshold
    inputBinding:
      prefix: -wlo
      position: 1
  whi:
    type: ['null', double]
    label: White matter high intensity threshold
    inputBinding:
      prefix: -whi
      position: 2
  glo:
    type: ['null', double]
    label: Gray matter low intensity threshold
    inputBinding:
      prefix: -glo
      position: 3
  ghi:
    type: ['null', double]
    label: Gray matter high intensity threshold
    inputBinding:
      prefix: -ghi
      position: 4

  # Processing options
  thicken:
    type: ['null', int]
    label: Thicken option (0 to disable)
    inputBinding:
      prefix: -thicken
      position: 5
  nseg:
    type: ['null', int]
    label: Number of segmentation classes
    inputBinding:
      prefix: -nseg
      position: 6

  # MPRAGE options
  mprage:
    type: ['null', boolean]
    label: Assume MPRAGE contrast (darker gray matter)
    inputBinding:
      prefix: -mprage
      position: 7

  # Slope options
  slope:
    type: ['null', double]
    label: Slope for threshold adjustment
    inputBinding:
      prefix: -slope
      position: 8

  # Other options
  nmin:
    type: ['null', int]
    label: Minimum number of white matter voxels
    inputBinding:
      prefix: -nmin
      position: 9
  keep:
    type: ['null', boolean]
    label: Keep intermediate files
    inputBinding:
      prefix: -keep
      position: 10

outputs:
  segmentation:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mri_segment.log
