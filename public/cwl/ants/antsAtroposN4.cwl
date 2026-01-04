#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsAtroposN4.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsAtroposN4.sh'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: antsAtroposN4.log
stderr: antsAtroposN4.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  input_image:
    type: File
    label: Input anatomical image (typically T1)
    inputBinding: {prefix: -a}
  mask_image:
    type: File
    label: Binary mask defining region of interest
    inputBinding: {prefix: -x}
  output_prefix:
    type: string
    label: Output prefix
    inputBinding: {prefix: -o}

  # Iteration parameters
  num_classes:
    type: int
    label: Number of tissue classes
    inputBinding: {prefix: -c}
  n4_atropos_iterations:
    type: ['null', int]
    label: Number of N4-Atropos iterations
    inputBinding: {prefix: -m}
  atropos_iterations:
    type: ['null', int]
    label: Number of Atropos iterations per N4 iteration
    inputBinding: {prefix: -n}

  # Prior images
  prior_images:
    type: ['null', string]
    label: Prior probability images pattern (e.g., prior%d.nii.gz)
    inputBinding: {prefix: -p}
  prior_weight:
    type: ['null', double]
    label: Atropos prior probability weight
    inputBinding: {prefix: -w}

  # N4 parameters
  n4_shrink_factor:
    type: ['null', int]
    label: N4 shrink factor
    inputBinding: {prefix: -f}
  n4_convergence:
    type: ['null', string]
    label: N4 convergence parameters
    inputBinding: {prefix: -e}
  n4_bspline:
    type: ['null', string]
    label: N4 B-spline parameters
    inputBinding: {prefix: -q}

  # Atropos parameters
  atropos_icm:
    type: ['null', string]
    label: Atropos ICM parameters
    inputBinding: {prefix: -i}
  use_euclidean_distance:
    type: ['null', boolean]
    label: Use Euclidean distance in distance prior
    inputBinding:
      prefix: -j
      valueFrom: '1'
  posterior_for_n4:
    type: ['null', int[]]
    label: Posterior labels for N4 weight mask
    inputBinding:
      prefix: -y
      separate: true

  # Other options
  image_suffix:
    type: ['null', string]
    label: Output image file suffix (e.g., nii.gz)
    inputBinding: {prefix: -s}
  keep_temporary:
    type: ['null', boolean]
    label: Keep temporary files
    inputBinding:
      prefix: -k
      valueFrom: '1'
  use_random_seeding:
    type: ['null', boolean]
    label: Use random seeding
    inputBinding:
      prefix: -u
      valueFrom: '1'

outputs:
  segmentation:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)Segmentation.nii.gz
  posteriors:
    type: File[]
    outputBinding:
      glob: $(inputs.output_prefix)SegmentationPosteriors*.nii.gz
  bias_corrected:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)BrainSegmentation0N4.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsAtroposN4.log
