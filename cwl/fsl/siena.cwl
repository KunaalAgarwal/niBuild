#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/SIENA
# Longitudinal brain atrophy estimation between two timepoints

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'siena'

requirements:
  InlineJavascriptRequirement: {}

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: siena.log
stderr: siena.log

inputs:
  # Required inputs
  input1:
    type: File
    label: Input T1 image (timepoint 1)
    inputBinding:
      position: 1
  input2:
    type: File
    label: Input T1 image (timepoint 2)
    inputBinding:
      position: 2

  # Output options
  output_dir:
    type: ['null', string]
    label: Output directory name
    inputBinding:
      prefix: -o
      position: 3

  # Processing options
  bet_options:
    type: ['null', string]
    label: BET options (e.g., "-f 0.3")
    inputBinding:
      prefix: -B
      position: 3
  two_class:
    type: ['null', boolean]
    label: Two-class segmentation (no grey/white separation)
    inputBinding:
      prefix: "-2"
      position: 3
  t2_weighted:
    type: ['null', boolean]
    label: Inputs are T2-weighted
    inputBinding:
      prefix: -t2
      position: 3
  std_masking:
    type: ['null', boolean]
    label: Apply standard-space masking for difficult cases
    inputBinding:
      prefix: -m
      position: 3
  siena_diff_options:
    type: ['null', string]
    label: Options to pass to siena_diff (e.g., "-s -i 20")
    inputBinding:
      prefix: -S
      position: 3

  # Ventricular analysis
  ventricle_analysis:
    type: ['null', boolean]
    label: Activate ventricular analysis (VIENA)
    inputBinding:
      prefix: -V
      position: 3
  ventricle_mask:
    type: ['null', File]
    label: Custom ventricle mask
    inputBinding:
      prefix: -v
      position: 3

  # Spatial constraints
  top_threshold:
    type: ['null', double]
    label: Ignore from this height (mm) upwards in MNI space
    inputBinding:
      prefix: -t
      position: 3
  bottom_threshold:
    type: ['null', double]
    label: Ignore from this height (mm) downwards in MNI space
    inputBinding:
      prefix: -b
      position: 3

  debug:
    type: ['null', boolean]
    label: Debug mode (keep intermediate files)
    inputBinding:
      prefix: -d
      position: 3

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir || '*_to_*_siena')
  report:
    type: File
    outputBinding:
      glob: $(inputs.output_dir || '*_to_*_siena')/report.siena
  pbvc:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir || '*_to_*_siena')/report.sienax
  edge_points:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || '*_to_*_siena')/*_edge*.nii.gz
        - $(inputs.output_dir || '*_to_*_siena')/*_edge*.nii
  flow_images:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || '*_to_*_siena')/*_flow*.nii.gz
        - $(inputs.output_dir || '*_to_*_siena')/*_flow*.nii
  log:
    type: File
    outputBinding:
      glob: siena.log
