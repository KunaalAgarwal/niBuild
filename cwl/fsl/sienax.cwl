#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/SIENA
# Cross-sectional brain volume estimation

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'sienax'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: sienax.log
stderr: sienax.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input T1-weighted image
    inputBinding:
      position: 1

  # Output options
  output_dir:
    type: ['null', string]
    label: Output directory name
    inputBinding:
      prefix: -o

  # Processing options
  bet_options:
    type: ['null', string]
    label: BET options (e.g., "-f 0.3")
    inputBinding:
      prefix: -B
  two_class:
    type: ['null', boolean]
    label: Two-class segmentation (no grey/white separation)
    inputBinding:
      prefix: -2
  t2_weighted:
    type: ['null', boolean]
    label: Input is T2-weighted
    inputBinding:
      prefix: -t2
  regional:
    type: ['null', boolean]
    label: Estimate regional volumes (peripheral GM, ventricular CSF)
    inputBinding:
      prefix: -r
  lesion_mask:
    type: ['null', File]
    label: Lesion mask to correct mislabeled GM voxels
    inputBinding:
      prefix: -lm
  fast_options:
    type: ['null', string]
    label: FAST segmentation options (e.g., "-i 20")
    inputBinding:
      prefix: -S

  # Spatial constraints
  top_threshold:
    type: ['null', double]
    label: Ignore from this height (mm) upwards in MNI space
    inputBinding:
      prefix: -t
  bottom_threshold:
    type: ['null', double]
    label: Ignore from this height (mm) downwards in MNI space
    inputBinding:
      prefix: -b

  debug:
    type: ['null', boolean]
    label: Debug mode (keep intermediate files)
    inputBinding:
      prefix: -d

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir || inputs.input.nameroot + '_sienax')
  report:
    type: File
    outputBinding:
      glob: $(inputs.output_dir || inputs.input.nameroot + '_sienax')/report.sienax
  brain_volume:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot + '_sienax')/*_brain.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot + '_sienax')/*_brain.nii
  segmentation:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir || inputs.input.nameroot + '_sienax')/*_seg.nii.gz
        - $(inputs.output_dir || inputs.input.nameroot + '_sienax')/*_seg.nii
  log:
    type: File
    outputBinding:
      glob: sienax.log
