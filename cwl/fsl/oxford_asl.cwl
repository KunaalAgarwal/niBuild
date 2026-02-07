#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/oxford_asl
# Complete ASL processing pipeline

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'oxford_asl'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: oxford_asl.log
stderr: oxford_asl.err.log

inputs:
  input:
    type: File
    label: Input ASL data
    inputBinding:
      prefix: -i
      position: 1
  output_dir:
    type: string
    label: Output directory name
    inputBinding:
      prefix: -o
      position: 2

  # Optional parameters
  mask:
    type: ['null', File]
    label: Mask in native ASL space
    inputBinding:
      prefix: -m
  spatial:
    type: ['null', boolean]
    label: Perform analysis with automatic spatial smoothing of CBF
    inputBinding:
      prefix: --spatial
  structural:
    type: ['null', File]
    label: Structural (T1) image (already BETed)
    inputBinding:
      prefix: -s
  casl:
    type: ['null', boolean]
    label: Data is CASL/pCASL (continuous ASL) rather than pASL
    inputBinding:
      prefix: --casl
  artsupp:
    type: ['null', boolean]
    label: Arterial suppression (vascular crushing) was used
    inputBinding:
      prefix: --artsupp
  tis:
    type: ['null', string]
    label: Inversion times (comma-separated)
    inputBinding:
      prefix: --tis
  bolus:
    type: ['null', double]
    label: Bolus duration (seconds)
    inputBinding:
      prefix: --bolus
  bat:
    type: ['null', double]
    label: Bolus arrival time (seconds)
    inputBinding:
      prefix: --bat
  t1:
    type: ['null', double]
    label: Tissue T1 value (default 1.3)
    inputBinding:
      prefix: --t1
  t1b:
    type: ['null', double]
    label: Blood T1 value (default 1.65)
    inputBinding:
      prefix: --t1b
  slicedt:
    type: ['null', double]
    label: Timing difference between slices (default 0)
    inputBinding:
      prefix: --slicedt
  calib:
    type: ['null', File]
    label: Calibration (M0) image
    inputBinding:
      prefix: -c
  M0:
    type: ['null', double]
    label: Precomputed M0 value
    inputBinding:
      prefix: --M0
  alpha:
    type: ['null', double]
    label: Inversion efficiency (default 0.98 pASL, 0.85 cASL)
    inputBinding:
      prefix: --alpha
  tr:
    type: ['null', double]
    label: TR of calibration data (default 3.2s)
    inputBinding:
      prefix: --tr
  wp:
    type: ['null', boolean]
    label: Use white paper quantification
    inputBinding:
      prefix: --wp
  senscorr:
    type: ['null', boolean]
    label: Use bias field from segmentation for sensitivity correction
    inputBinding:
      prefix: --senscorr
  vars:
    type: ['null', boolean]
    label: Also save parameter estimated variances
    inputBinding:
      prefix: --vars
  report:
    type: ['null', boolean]
    label: Report mean perfusion within GM mask (requires structural)
    inputBinding:
      prefix: --report
  norm:
    type: ['null', boolean]
    label: Output perfusion maps normalised by GM mean (requires structural)
    inputBinding:
      prefix: --norm

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir)
  perfusion:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/native_space/perfusion.nii.gz
  arrival:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/native_space/arrival.nii.gz
  log:
    type: File
    outputBinding:
      glob: oxford_asl.log
