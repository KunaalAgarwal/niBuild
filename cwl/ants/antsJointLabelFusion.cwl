#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsJointLabelFusion.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsJointLabelFusion.sh'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: antsJointLabelFusion.log
stderr: antsJointLabelFusion.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  output_prefix:
    type: string
    label: Output prefix for labeled images
    inputBinding: {prefix: -o}
  target_image:
    type: File
    label: Target image to be labeled
    inputBinding: {prefix: -t}

  # Atlas images and labels (arrays for multiple atlases)
  atlas_images:
    type: File[]
    label: Atlas grayscale images
    inputBinding:
      prefix: -g
      separate: true
  atlas_labels:
    type: File[]
    label: Atlas label images corresponding to each atlas
    inputBinding:
      prefix: -l
      separate: true

  # Optional parameters
  mask_image:
    type: ['null', File]
    label: Mask image for limiting fusion region
    inputBinding: {prefix: -x}
  num_threads:
    type: ['null', int]
    label: Number of parallel threads
    inputBinding: {prefix: -j}
  parallel_control:
    type: ['null', int]
    label: Parallel computation control (0=serial, 1=SGE, 2=PEXEC, 3=SLURM, 4=PBS)
    inputBinding: {prefix: -c}
  search_radius:
    type: ['null', string]
    label: Search radius for similarity measures (e.g., 3x3x3)
    inputBinding: {prefix: -s}
  patch_radius:
    type: ['null', string]
    label: Patch radius for similarity measures (e.g., 2x2x2)
    inputBinding: {prefix: -p}
  alpha:
    type: ['null', double]
    label: Regularization term for matrix inversion (default 0.1)
    inputBinding: {prefix: -a}
  beta:
    type: ['null', double]
    label: Exponent for mapping intensity difference (default 2.0)
    inputBinding: {prefix: -b}

outputs:
  labeled_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)Labels.nii.gz
  intensity_fusion:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)Intensity.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsJointLabelFusion.log
