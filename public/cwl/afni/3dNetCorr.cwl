#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dNetCorr.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dNetCorr'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output file name prefix
    inputBinding: {prefix: -prefix}
  inset:
    type: File
    label: Input 4D time series dataset
    inputBinding: {prefix: -inset}
  in_rois:
    type: File
    label: ROI mask with distinct integer labels
    inputBinding: {prefix: -in_rois}

  # Optional parameters
  mask:
    type: ['null', File]
    label: Brain mask for correlation calculation
    inputBinding: {prefix: -mask}
  fish_z:
    type: ['null', boolean]
    label: Fisher Z-transform correlation coefficients
    inputBinding: {prefix: -fish_z}
  part_corr:
    type: ['null', boolean]
    label: Calculate partial correlation matrices
    inputBinding: {prefix: -part_corr}

  # Time series output options
  ts_out:
    type: ['null', boolean]
    label: Output mean time series per ROI
    inputBinding: {prefix: -ts_out}
  ts_label:
    type: ['null', boolean]
    label: Insert ROI label at start of each time series line
    inputBinding: {prefix: -ts_label}
  ts_indiv:
    type: ['null', boolean]
    label: Create directories with individual ROI time series
    inputBinding: {prefix: -ts_indiv}
  ts_wb_corr:
    type: ['null', boolean]
    label: Generate whole brain correlation maps per ROI
    inputBinding: {prefix: -ts_wb_corr}
  ts_wb_Z:
    type: ['null', boolean]
    label: Generate whole brain Fisher Z-score maps per ROI
    inputBinding: {prefix: -ts_wb_Z}

  # Weighting options
  weight_ts:
    type: ['null', File]
    label: Apply weights to ROI time series
    inputBinding: {prefix: -weight_ts}
  weight_corr:
    type: ['null', File]
    label: Apply weights for weighted Pearson correlation
    inputBinding: {prefix: -weight_corr}

  # Output format
  nifti:
    type: ['null', boolean]
    label: Output maps as NIFTI instead of BRIK/HEAD
    inputBinding: {prefix: -nifti}

  # Error handling
  push_thru_many_zeros:
    type: ['null', boolean]
    label: Continue even with >10% null time series in ROIs
    inputBinding: {prefix: -push_thru_many_zeros}
  allow_roi_zeros:
    type: ['null', boolean]
    label: Permit ROIs with all-zero time series
    inputBinding: {prefix: -allow_roi_zeros}
  automask_off:
    type: ['null', boolean]
    label: Disable automatic masking
    inputBinding: {prefix: -automask_off}

outputs:
  correlation_matrix:
    type: File
    outputBinding:
      glob: $(inputs.prefix)_000.netcc
  time_series:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_000.netts
  wb_corr_maps:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.prefix)_*_000_WB*.nii*
        - $(inputs.prefix)_*_000_WB*+orig.*
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
