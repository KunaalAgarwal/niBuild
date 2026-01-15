#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/MELODIC
# ICA-based analysis for FMRI data

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'melodic'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: melodic.log
stderr: melodic.log

inputs:
  # Required inputs
  input_files:
    type:
      - File
      - type: array
        items: File
    label: Input file(s) - single 4D file or list of files
    inputBinding:
      prefix: -i
      itemSeparator: ','
  output_dir:
    type: string
    label: Output directory name
    inputBinding:
      prefix: -o

  # Dimensionality
  dim:
    type: ['null', int]
    label: Number of dimensions to reduce to (default automatic)
    inputBinding:
      prefix: -d
  dim_est:
    type:
      - 'null'
      - type: enum
        symbols: [lap, bic, mdl, aic, mean]
    label: Dimension estimation technique
    inputBinding:
      prefix: --dimest=
      separate: false

  # Approach
  approach:
    type:
      - 'null'
      - type: enum
        symbols: [defl, symm, tica, concat]
    label: "ICA approach (2D: defl/symm, 3D: tica, group: concat)"
    inputBinding:
      prefix: -a

  # Preprocessing
  tr_sec:
    type: ['null', double]
    label: TR in seconds
    inputBinding:
      prefix: --tr=
      separate: false
  no_bet:
    type: ['null', boolean]
    label: Switch off brain extraction (BET)
    inputBinding:
      prefix: --nobet
  no_mask:
    type: ['null', boolean]
    label: Switch off masking
    inputBinding:
      prefix: --nomask
  mask:
    type: ['null', File]
    label: Mask file
    inputBinding:
      prefix: -m
  bg_threshold:
    type: ['null', double]
    label: Brain/non-brain threshold percentage
    inputBinding:
      prefix: --bgthreshold=
      separate: false
  var_norm:
    type: ['null', boolean]
    label: Switch off variance normalization
    inputBinding:
      prefix: --vn
  sep_vn:
    type: ['null', boolean]
    label: Switch off joined variance normalization
    inputBinding:
      prefix: --sep_vn
  pbsc:
    type: ['null', boolean]
    label: Switch off percent BOLD signal change conversion
    inputBinding:
      prefix: --pbsc

  # ICA parameters
  num_ICs:
    type: ['null', int]
    label: Number of ICs to extract (deflation approach)
    inputBinding:
      prefix: -n
  non_linearity:
    type:
      - 'null'
      - type: enum
        symbols: [gauss, tanh, pow3, pow4]
    label: Non-linearity function
    inputBinding:
      prefix: --nl=
      separate: false
  maxit:
    type: ['null', int]
    label: Maximum iterations before restart
    inputBinding:
      prefix: --maxit=
      separate: false
  max_restart:
    type: ['null', int]
    label: Maximum number of restarts
    inputBinding:
      prefix: --maxrestart=
      separate: false
  epsilon:
    type: ['null', double]
    label: Minimum error change
    inputBinding:
      prefix: --eps=
      separate: false

  # MIGP options
  migp:
    type: ['null', boolean]
    label: Switch on MIGP data reduction
    inputBinding:
      prefix: --migp
  migpN:
    type: ['null', int]
    label: Number of internal eigenmaps
    inputBinding:
      prefix: --migpN=
      separate: false
  migp_factor:
    type: ['null', int]
    label: MIGP memory threshold factor
    inputBinding:
      prefix: --migp_factor=
      separate: false
  migp_shuffle:
    type: ['null', boolean]
    label: Randomize MIGP file order
    inputBinding:
      prefix: --migp_shuffle

  # Mixture modelling
  no_mm:
    type: ['null', boolean]
    label: Switch off mixture modelling
    inputBinding:
      prefix: --no_mm
  mm_thresh:
    type: ['null', double]
    label: Mixture model threshold (0-1)
    inputBinding:
      prefix: --mmthresh=
      separate: false
  ICs:
    type: ['null', File]
    label: IC components file for mixture modelling
    inputBinding:
      prefix: --ICs=
      separate: false
  mix:
    type: ['null', File]
    label: Mixing matrix for mixture modelling
    inputBinding:
      prefix: --mix=
      separate: false

  # Design matrices (for group analysis)
  t_des:
    type: ['null', File]
    label: Design matrix across time-domain
    inputBinding:
      prefix: --Tdes=
      separate: false
  t_con:
    type: ['null', File]
    label: T-contrast matrix across time-domain
    inputBinding:
      prefix: --Tcon=
      separate: false
  s_des:
    type: ['null', File]
    label: Design matrix across subject-domain
    inputBinding:
      prefix: --Sdes=
      separate: false
  s_con:
    type: ['null', File]
    label: T-contrast matrix across subject-domain
    inputBinding:
      prefix: --Scon=
      separate: false

  # Output options
  out_all:
    type: ['null', boolean]
    label: Output all results
    inputBinding:
      prefix: --Oall
  out_mean:
    type: ['null', boolean]
    label: Output mean volume
    inputBinding:
      prefix: --Omean
  out_orig:
    type: ['null', boolean]
    label: Output original ICs
    inputBinding:
      prefix: --Oorig
  out_pca:
    type: ['null', boolean]
    label: Output PCA results
    inputBinding:
      prefix: --Opca
  out_stats:
    type: ['null', boolean]
    label: Output thresholded maps and probability maps
    inputBinding:
      prefix: --Ostats
  out_unmix:
    type: ['null', boolean]
    label: Output unmixing matrix
    inputBinding:
      prefix: --Ounmix
  out_white:
    type: ['null', boolean]
    label: Output whitening/dewhitening matrices
    inputBinding:
      prefix: --Owhite

  # Report
  report:
    type: ['null', boolean]
    label: Generate web report
    inputBinding:
      prefix: --report
  report_maps:
    type: ['null', string]
    label: Control string for spatial map images
    inputBinding:
      prefix: --report_maps=
      separate: false
  bg_image:
    type: ['null', File]
    label: Background image for report
    inputBinding:
      prefix: --bgimage=
      separate: false

  # Other options
  log_power:
    type: ['null', boolean]
    label: Calculate log of power for frequency spectrum
    inputBinding:
      prefix: --logPower
  sep_whiten:
    type: ['null', boolean]
    label: Switch on separate whitening
    inputBinding:
      prefix: --sep_whiten
  update_mask:
    type: ['null', boolean]
    label: Switch off mask updating
    inputBinding:
      prefix: --update_mask
  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir)
  melodic_IC:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/melodic_IC.nii.gz
        - $(inputs.output_dir)/melodic_IC.nii
  melodic_mix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir)/melodic_mix
  melodic_FTmix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir)/melodic_FTmix
  melodic_Tmodes:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir)/melodic_Tmodes
  mean:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/mean.nii.gz
        - $(inputs.output_dir)/mean.nii
  log:
    type: File
    outputBinding:
      glob: melodic.log
