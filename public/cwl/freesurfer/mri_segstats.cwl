#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_segstats
# Computes statistics from segmentation

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_segstats'

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

stdout: mri_segstats.log
stderr: mri_segstats.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Segmentation input
  seg:
    type: File
    label: Segmentation volume
    inputBinding:
      prefix: --seg
      position: 1

  # Output options
  sum:
    type: string
    label: Output summary file
    inputBinding:
      prefix: --sum
      position: 2

  # Input volume for intensity stats
  in:
    type: ['null', File]
    label: Input volume for intensity statistics
    inputBinding:
      prefix: --in
      position: 3

  # Color table options
  ctab:
    type: ['null', File]
    label: Color table file (e.g., FreeSurferColorLUT.txt)
    inputBinding:
      prefix: --ctab
      position: 4
  ctab_default:
    type: ['null', boolean]
    label: Use default FreeSurfer color table
    inputBinding:
      prefix: --ctab-default
      position: 5

  # Annotation input
  annot:
    type: ['null', string]
    label: Annotation (subject hemi parc)
    inputBinding:
      prefix: --annot
      position: 6
  slabel:
    type: ['null', string]
    label: Surface label (subject hemi label)
    inputBinding:
      prefix: --slabel
      position: 7

  # Filtering options
  id:
    type: ['null', 'int[]']
    label: Only report these segmentation IDs
    inputBinding:
      prefix: --id
      position: 8
  excludeid:
    type: ['null', int]
    label: Exclude this segmentation ID (usually 0)
    inputBinding:
      prefix: --excludeid
      position: 9
  excl_ctxgmwm:
    type: ['null', boolean]
    label: Exclude cortex GM and WM
    inputBinding:
      prefix: --excl-ctxgmwm
      position: 10
  nonempty:
    type: ['null', boolean]
    label: Only report non-empty segmentations
    inputBinding:
      prefix: --nonempty
      position: 11

  # Mask options
  mask:
    type: ['null', File]
    label: Mask volume
    inputBinding:
      prefix: --mask
      position: 12
  maskthresh:
    type: ['null', double]
    label: Mask threshold
    inputBinding:
      prefix: --maskthresh
      position: 13
  maskinvert:
    type: ['null', boolean]
    label: Invert mask
    inputBinding:
      prefix: --maskinvert
      position: 14

  # Subject options
  subject:
    type: ['null', string]
    label: Subject name
    inputBinding:
      prefix: --subject
      position: 15

  # Output options
  avgwf:
    type: ['null', string]
    label: Output average waveform file
    inputBinding:
      prefix: --avgwf
      position: 16
  avgwfvol:
    type: ['null', string]
    label: Output average waveform as volume
    inputBinding:
      prefix: --avgwfvol
      position: 17
  sfavg:
    type: ['null', string]
    label: Spatial-frame average file
    inputBinding:
      prefix: --sfavg
      position: 18

  # Brain volume options
  brain_vol_from_seg:
    type: ['null', boolean]
    label: Compute brain volume from segmentation
    inputBinding:
      prefix: --brain-vol-from-seg
      position: 19
  brainmask:
    type: ['null', File]
    label: Brain mask file
    inputBinding:
      prefix: --brainmask
      position: 20

  # Partial volume options
  pv:
    type: ['null', File]
    label: Partial volume file
    inputBinding:
      prefix: --pv
      position: 21

  # Robust stats
  robust:
    type: ['null', double]
    label: Compute robust statistics (percent)
    inputBinding:
      prefix: --robust
      position: 22

  # Euler number
  euler:
    type: ['null', boolean]
    label: Report Euler number
    inputBinding:
      prefix: --euler
      position: 23

outputs:
  summary:
    type: File
    outputBinding:
      glob: $(inputs.sum)
  avgwf_file:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.avgwf)
  avgwfvol_file:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.avgwfvol)
  log:
    type: File
    outputBinding:
      glob: mri_segstats.log
