#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/DualRegression
# Dual regression for group ICA analysis

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'dual_regression'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: dual_regression.log
stderr: dual_regression.log

inputs:
  # Required inputs
  group_IC_maps:
    type: File
    label: Group ICA spatial maps (melodic_IC.nii.gz)
    inputBinding:
      position: 1
  des_norm:
    type: int
    label: Variance normalize timeseries (0=no, 1=yes)
    inputBinding:
      position: 2
  design_mat:
    type: File
    label: Design matrix file (.mat)
    inputBinding:
      position: 3
  design_con:
    type: File
    label: Contrast file (.con)
    inputBinding:
      position: 4
  n_perm:
    type: int
    label: Number of permutations for randomise
    inputBinding:
      position: 5
  output_dir:
    type: string
    label: Output directory name
    inputBinding:
      position: 6
  input_files:
    type: File[]
    label: List of input 4D files (one per subject)
    inputBinding:
      position: 7

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir)
  stage1_timeseries:
    type: File[]
    outputBinding:
      glob: $(inputs.output_dir)/dr_stage1_subject*.txt
  stage2_spatial_maps:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output_dir)/dr_stage2_subject*.nii.gz
        - $(inputs.output_dir)/dr_stage2_subject*.nii
  stage3_tstats:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output_dir)/dr_stage3_ic*_tstat*.nii.gz
        - $(inputs.output_dir)/dr_stage3_ic*_tstat*.nii
  stage3_corrp:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output_dir)/dr_stage3_ic*_tfce_corrp_tstat*.nii.gz
        - $(inputs.output_dir)/dr_stage3_ic*_tfce_corrp_tstat*.nii
  log:
    type: File
    outputBinding:
      glob: dual_regression.log
