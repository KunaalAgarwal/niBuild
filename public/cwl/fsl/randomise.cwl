#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Randomise
# Non-parametric permutation testing

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'randomise'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: randomise.log
stderr: randomise.log

inputs:
  # Required inputs
  input:
    type: File
    label: 4D input image
    inputBinding:
      prefix: -i
      position: 1
  output:
    type: string
    label: Output file root name
    inputBinding:
      prefix: -o
      position: 2

  # Design specification
  design_mat:
    type: ['null', File]
    label: Design matrix file (.mat)
    inputBinding:
      prefix: -d
  tcon:
    type: ['null', File]
    label: T-contrast file (.con)
    inputBinding:
      prefix: -t
  fcon:
    type: ['null', File]
    label: F-contrast file (.fts)
    inputBinding:
      prefix: -f

  # Mask
  mask:
    type: ['null', File]
    label: Mask image
    inputBinding:
      prefix: -m

  # Permutation options
  num_perm:
    type: ['null', int]
    label: Number of permutations (default 5000)
    inputBinding:
      prefix: -n
  seed:
    type: ['null', int]
    label: Random seed
    inputBinding:
      prefix: --seed=
      separate: false

  # One-sample test
  one_sample_group_mean:
    type: ['null', boolean]
    label: Perform one-sample group mean test
    inputBinding:
      prefix: "-1"

  # TFCE options
  tfce:
    type: ['null', boolean]
    label: Use Threshold-Free Cluster Enhancement
    inputBinding:
      prefix: -T
  tfce2D:
    type: ['null', boolean]
    label: Use 2D TFCE optimization (for TBSS)
    inputBinding:
      prefix: --T2
  tfce_H:
    type: ['null', double]
    label: TFCE height parameter (default 2)
    inputBinding:
      prefix: --tfce_H=
      separate: false
  tfce_E:
    type: ['null', double]
    label: TFCE extent parameter (default 0.5)
    inputBinding:
      prefix: --tfce_E=
      separate: false
  tfce_C:
    type: ['null', double]
    label: TFCE connectivity parameter (default 6)
    inputBinding:
      prefix: --tfce_C=
      separate: false

  # Cluster thresholding
  c_thresh:
    type: ['null', double]
    label: Cluster-forming threshold for t-statistics
    inputBinding:
      prefix: -c
  cm_thresh:
    type: ['null', double]
    label: Cluster-mass threshold for t-statistics
    inputBinding:
      prefix: -C
  f_c_thresh:
    type: ['null', double]
    label: Cluster-forming threshold for F-statistics
    inputBinding:
      prefix: -F
  f_cm_thresh:
    type: ['null', double]
    label: Cluster-mass threshold for F-statistics
    inputBinding:
      prefix: -S

  # Additional options
  demean:
    type: ['null', boolean]
    label: Demean data temporally before analysis
    inputBinding:
      prefix: -D
  vox_p_values:
    type: ['null', boolean]
    label: Output voxelwise (uncorrected) p-values
    inputBinding:
      prefix: -x
  f_only:
    type: ['null', boolean]
    label: Calculate F-statistics only
    inputBinding:
      prefix: --fonly
  raw_stats_imgs:
    type: ['null', boolean]
    label: Output raw (unpermuted) statistic images
    inputBinding:
      prefix: -R
  p_vec_n_dist_files:
    type: ['null', boolean]
    label: Output permutation vector and null distribution
    inputBinding:
      prefix: -P
  var_smooth:
    type: ['null', int]
    label: Variance smoothing in mm
    inputBinding:
      prefix: -v
  x_block_labels:
    type: ['null', File]
    label: Exchangeability block labels file
    inputBinding:
      prefix: -e

  # Info options
  show_total_perms:
    type: ['null', boolean]
    label: Print total number of permutations and exit
    inputBinding:
      prefix: -q
  show_info_parallel_mode:
    type: ['null', boolean]
    label: Print parallel mode info
    inputBinding:
      prefix: -Q

outputs:
  t_corrp:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output)_tfce_corrp_tstat*.nii.gz
        - $(inputs.output)_vox_corrp_tstat*.nii.gz
        - $(inputs.output)_clustere_corrp_tstat*.nii.gz
        - $(inputs.output)_clusterm_corrp_tstat*.nii.gz
  t_p:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output)_tfce_p_tstat*.nii.gz
        - $(inputs.output)_vox_p_tstat*.nii.gz
  tstat:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.output)_tstat*.nii.gz
        - $(inputs.output)_tstat*.nii
  f_corrp:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.output)_tfce_corrp_fstat*.nii.gz
        - $(inputs.output)_vox_corrp_fstat*.nii.gz
  f_p:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.output)_tfce_p_fstat*.nii.gz
        - $(inputs.output)_vox_p_fstat*.nii.gz
  fstat:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.output)_fstat*.nii.gz
        - $(inputs.output)_fstat*.nii
  log:
    type: File
    outputBinding:
      glob: randomise.log
