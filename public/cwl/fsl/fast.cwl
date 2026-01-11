#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/docs/#/structural/fast
# brain extraction should be done with BET first.

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fast'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: $(inputs.output).log
stderr: $(inputs.output).log

inputs:
  input:
    type: File
    inputBinding: {position: 50} # arbitrary position, should be the last input
  output:
    type: string
    label: Output filename prefix
    inputBinding: {prefix: -o, separate: false}

  # OPTIONAL PARAMETERS
  nclass:
    type: ['null', int]
    label: Number of tissue classes
    inputBinding: {prefix: -n, separate: false}
  iterations:
    type: ['null', int]
    label: Number of iterations during bias-field removal
    inputBinding: {prefix: -I, separate: false}
  lowpass:
    type: ['null', double]
    label: bias field smoothing extent (FWHM) in mm
    inputBinding: {prefix: -l, separate: false}
  image_type:
    type: ['null', int]
    label: Image type (e.g. 1="T1", 2="T2", 3="PD")
    inputBinding: {prefix: -t, separate: false}
  fhard:
    type: ['null', double]
    label: initial segmentation spatial smoothness (during bias field estimation)
    inputBinding: {prefix: -f}
  segments: # may need to add an output later
    type: ['null', boolean]
    label: Outputs a separate binary segmentation file for each tissue type
    inputBinding: {prefix: -g}
  bias_field:
    type: ['null', boolean]
    label: Outputs estimated bias field
    inputBinding: {prefix: -b}
  bias_corrected_image:
    type: ['null', boolean]
    label: Outputs bias-corrected image
    inputBinding: {prefix: -B}
  nobias:
    type: ['null', boolean]
    label: Do not remove bias field
    inputBinding: {prefix: -N}
  channels:
    type: ['null', int]
    label: Number of channels to use
    inputBinding: {prefix: -S, separate: false}
  initialization_iterations:
    type: ['null', int]
    label: initial number of segmentation-initialisation iterations
    inputBinding: {prefix: -W, separate: false}
  mixel:
    type: ['null', double]
    label: spatial smoothness for mixeltype
    inputBinding: {prefix: -R, separate: false}
  fixed:
    type: ['null', int]
    label: number of main-loop iterations after bias-field removal
    inputBinding: {prefix: -O, separate: false}
  hyper:
    type: ['null', double]
    label: segmentation spatial smoothness
    inputBinding: {prefix: -H, separate: false}
  manualseg:
    type: ['null', File]
    label: Manual segmentation file
    inputBinding: {prefix: -s, separate: false}
  probability_maps:
    type: ['null', boolean]
    label: outputs individual probability maps
    inputBinding: {prefix: -p}
  # dependent parameters
  priors:
    type:
      - "null"
      - type: record
        name: priors
        fields:
          initialize_priors:
            type: File  # FLIRT transformation file
            inputBinding:
              prefix: -a
          use_priors:
            type: ['null', boolean]
            inputBinding:
              prefix: -P

outputs:
  segmented_files:
    type: File[]
    outputBinding:
      glob:
        - "$(inputs.output)_seg.nii.gz"
        - "$(inputs.output)_pve_*.nii.gz"
        - "$(inputs.output)_mixeltype.nii.gz"
        - "$(inputs.output)_pveseg.nii.gz"
  output_bias_field:
    type: ['null', File]
    outputBinding:
        glob: "$(inputs.output)_bias.nii.gz"
  output_bias_corrected_image:
    type: ['null', File]
    outputBinding:
        glob: "$(inputs.output)_restore.nii.gz"
  output_probability_maps:
    type: File[]
    outputBinding:
        glob: "$(inputs.output)_prob_*.nii.gz"
  output_segments:
    type: File[]
    outputBinding:
        glob: "$(inputs.output)_seg_*.nii.gz"
  log:
    type: File
    outputBinding:
        glob: "$(inputs.output).log"