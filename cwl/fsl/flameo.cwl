#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FEAT
# Higher-level analysis using FLAME (mixed effects)

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'flameo'

requirements:
  InlineJavascriptRequirement: {}

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: flameo.log
stderr: flameo.log

inputs:
  # Required inputs
  cope_file:
    type: File
    label: COPE (contrast of parameter estimates) file
    inputBinding:
      prefix: --copefile=
      separate: false
  var_cope_file:
    type: ['null', File]
    label: Variance of COPE file
    inputBinding:
      prefix: --varcopefile=
      separate: false
  mask_file:
    type: File
    label: Mask file
    inputBinding:
      prefix: --maskfile=
      separate: false
  design_file:
    type: File
    label: Design matrix file (.mat)
    inputBinding:
      prefix: --designfile=
      separate: false
  t_con_file:
    type: File
    label: T-contrast file (.con)
    inputBinding:
      prefix: --tcontrastsfile=
      separate: false
  cov_split_file:
    type: File
    label: Covariance split file
    inputBinding:
      prefix: --covsplitfile=
      separate: false
  run_mode:
    type:
      type: enum
      symbols: [fe, ols, flame1, flame12]
    label: Inference mode (fe=fixed effects, ols=OLS, flame1=FLAME stage 1, flame12=FLAME stages 1+2)
    inputBinding:
      prefix: --runmode=
      separate: false

  # Output options
  log_dir:
    type: ['null', string]
    label: Output directory name (default stats)
    inputBinding:
      prefix: --ld=
      separate: false

  # F-contrast
  f_con_file:
    type: ['null', File]
    label: F-contrast file (.fts)
    inputBinding:
      prefix: --fcontrastsfile=
      separate: false

  # DOF file
  dof_var_cope_file:
    type: ['null', File]
    label: Degrees of freedom for varcope
    inputBinding:
      prefix: --dofvarcopefile=
      separate: false

  # MCMC options (for flame12)
  n_jumps:
    type: ['null', int]
    label: Number of MCMC jumps
    inputBinding:
      prefix: --njumps=
      separate: false
  burnin:
    type: ['null', int]
    label: Number of MCMC burnin jumps
    inputBinding:
      prefix: --burnin=
      separate: false
  sample_every:
    type: ['null', int]
    label: MCMC sample every N jumps
    inputBinding:
      prefix: --sampleevery=
      separate: false

  # Outlier inference
  infer_outliers:
    type: ['null', boolean]
    label: Infer outliers
    inputBinding:
      prefix: --inferoutliers
  outlier_iter:
    type: ['null', int]
    label: Outlier inference iterations
    inputBinding:
      prefix: --ioni=
      separate: false

  # Other options
  fix_mean:
    type: ['null', boolean]
    label: Fix mean for tfit
    inputBinding:
      prefix: --fixmean
  no_pe_outputs:
    type: ['null', boolean]
    label: Do not output parameter estimates
    inputBinding:
      prefix: --nopeoutput
  sigma_dofs:
    type: ['null', int]
    label: Sigma for DOF Gaussian smoothing
    inputBinding:
      prefix: --sigma_dofs=
      separate: false

outputs:
  stats_dir:
    type: Directory
    outputBinding:
      glob: $(inputs.log_dir || 'stats')
  copes:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/cope*.nii.gz
        - $(inputs.log_dir || 'stats')/cope*.nii
  var_copes:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/varcope*.nii.gz
        - $(inputs.log_dir || 'stats')/varcope*.nii
  tstats:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/tstat*.nii.gz
        - $(inputs.log_dir || 'stats')/tstat*.nii
  zstats:
    type: File[]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/zstat*.nii.gz
        - $(inputs.log_dir || 'stats')/zstat*.nii
  fstats:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/fstat*.nii.gz
        - $(inputs.log_dir || 'stats')/fstat*.nii
  zfstats:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/zfstat*.nii.gz
        - $(inputs.log_dir || 'stats')/zfstat*.nii
  tdof:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/tdof_t*.nii.gz
        - $(inputs.log_dir || 'stats')/tdof_t*.nii
  res4d:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/res4d.nii.gz
        - $(inputs.log_dir || 'stats')/res4d.nii
  weights:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.log_dir || 'stats')/weights*.nii.gz
        - $(inputs.log_dir || 'stats')/weights*.nii
  log:
    type: File
    outputBinding:
      glob: flameo.log
