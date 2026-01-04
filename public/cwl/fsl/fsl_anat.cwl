#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/fsl_anat
# Comprehensive anatomical processing pipeline

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fsl_anat'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fsl_anat.log
stderr: fsl_anat.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input structural image
    inputBinding:
      prefix: -i
  output_dir:
    type: ['null', string]
    label: Output directory name
    inputBinding:
      prefix: -o

  # Image type
  t2:
    type: ['null', boolean]
    label: Input is T2-weighted (default T1)
    inputBinding:
      prefix: --t2

  # Processing options
  weakbias:
    type: ['null', boolean]
    label: Use weak bias field correction
    inputBinding:
      prefix: --weakbias
  nobias:
    type: ['null', boolean]
    label: Skip bias field correction
    inputBinding:
      prefix: --nobias
  noreg:
    type: ['null', boolean]
    label: Skip registration to standard space
    inputBinding:
      prefix: --noreg
  nononlinreg:
    type: ['null', boolean]
    label: Skip non-linear registration
    inputBinding:
      prefix: --nononlinreg
  noseg:
    type: ['null', boolean]
    label: Skip tissue segmentation
    inputBinding:
      prefix: --noseg
  nosubcortseg:
    type: ['null', boolean]
    label: Skip subcortical segmentation (FIRST)
    inputBinding:
      prefix: --nosubcortseg
  nocleanup:
    type: ['null', boolean]
    label: Do not remove intermediate files
    inputBinding:
      prefix: --nocleanup

  # Bias field options
  betfparam:
    type: ['null', double]
    label: BET -f parameter (brain extraction threshold)
    inputBinding:
      prefix: --betfparam
  bias_smoothing:
    type: ['null', double]
    label: Bias field smoothing (mm)
    inputBinding:
      prefix: -s

  # Cropping
  clobber:
    type: ['null', boolean]
    label: Overwrite existing output directory
    inputBinding:
      prefix: --clobber
  nosearch:
    type: ['null', boolean]
    label: Do not search for existing .anat directory
    inputBinding:
      prefix: --nosearch

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir || inputs.input.nameroot).anat
  t1:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1.nii
  t1_brain:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_brain.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_brain.nii
  t1_brain_mask:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_brain_mask.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_brain_mask.nii
  t1_biascorr:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_biascorr.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_biascorr.nii
  t1_biascorr_brain:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_biascorr_brain.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_biascorr_brain.nii
  mni_to_t1_nonlin_warp:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/MNI_to_T1_nonlin_field.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/MNI_to_T1_nonlin_field.nii
  t1_to_mni_nonlin_warp:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_to_MNI_nonlin_field.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_to_MNI_nonlin_field.nii
  segmentation:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_fast_seg.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/T1_fast_seg.nii
  subcortical_seg:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot).anat/first_results/T1_first_all_fast_firstseg.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot).anat/first_results/T1_first_all_fast_firstseg.nii
  log:
    type: File
    outputBinding:
      glob: fsl_anat.log
