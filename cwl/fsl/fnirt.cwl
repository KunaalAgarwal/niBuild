#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FNIRT
# Non-linear registration

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fnirt'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fnirt.log
stderr: fnirt.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input image to register
    inputBinding:
      prefix: --in=
      separate: false
  reference:
    type: File
    label: Reference/target image
    inputBinding:
      prefix: --ref=
      separate: false

  # Initial transforms
  affine:
    type: ['null', File]
    label: Affine transformation matrix from FLIRT
    inputBinding:
      prefix: --aff=
      separate: false
  inwarp:
    type: ['null', File]
    label: Initial non-linear warp (coefficients or field)
    inputBinding:
      prefix: --inwarp=
      separate: false
  intin:
    type: ['null', File]
    label: Initial intensity mapping from previous FNIRT run
    inputBinding:
      prefix: --intin=
      separate: false

  # Configuration
  config:
    type: ['null', File]
    label: Configuration file with predefined settings
    inputBinding:
      prefix: --config=
      separate: false

  # Masks
  refmask:
    type: ['null', File]
    label: Reference space mask
    inputBinding:
      prefix: --refmask=
      separate: false
  inmask:
    type: ['null', File]
    label: Input image mask
    inputBinding:
      prefix: --inmask=
      separate: false

  # Output files
  cout:
    type: ['null', string]
    label: Output warp coefficients filename
    inputBinding:
      prefix: --cout=
      separate: false
  iout:
    type: ['null', string]
    label: Output warped image filename
    inputBinding:
      prefix: --iout=
      separate: false
  fout:
    type: ['null', string]
    label: Output displacement field filename
    inputBinding:
      prefix: --fout=
      separate: false
  jout:
    type: ['null', string]
    label: Output Jacobian map filename
    inputBinding:
      prefix: --jout=
      separate: false
  refout:
    type: ['null', string]
    label: Output intensity modulated reference filename
    inputBinding:
      prefix: --refout=
      separate: false
  intout:
    type: ['null', string]
    label: Output intensity transformation filename
    inputBinding:
      prefix: --intout=
      separate: false
  logout:
    type: ['null', string]
    label: Output log filename
    inputBinding:
      prefix: --logout=
      separate: false

  # Global parameters
  warpres:
    type: ['null', string]
    label: Warp resolution in mm (e.g., "10,10,10")
    inputBinding:
      prefix: --warpres=
      separate: false
  splineorder:
    type: ['null', int]
    label: B-spline order (2=quadratic, 3=cubic)
    inputBinding:
      prefix: --splineorder=
      separate: false
  regmod:
    type:
      - 'null'
      - type: enum
        symbols: [membrane_energy, bending_energy]
    label: Regularization model
    inputBinding:
      prefix: --regmod=
      separate: false
  intmod:
    type:
      - 'null'
      - type: enum
        symbols: [none, global_linear, global_non_linear, local_linear, global_non_linear_with_bias, local_non_linear]
    label: Intensity normalization model
    inputBinding:
      prefix: --intmod=
      separate: false
  intorder:
    type: ['null', int]
    label: Order of polynomial intensity modulation
    inputBinding:
      prefix: --intorder=
      separate: false

  # Multi-resolution parameters
  subsamp:
    type: ['null', string]
    label: Subsampling levels (e.g., "4,2,1,1")
    inputBinding:
      prefix: --subsamp=
      separate: false
  miter:
    type: ['null', string]
    label: Max iterations per level (e.g., "5,5,5,5")
    inputBinding:
      prefix: --miter=
      separate: false
  infwhm:
    type: ['null', string]
    label: Input smoothing FWHM per level (e.g., "8,4,2,2")
    inputBinding:
      prefix: --infwhm=
      separate: false
  reffwhm:
    type: ['null', string]
    label: Reference smoothing FWHM per level (e.g., "8,4,2,2")
    inputBinding:
      prefix: --reffwhm=
      separate: false
  lambda_:
    type: ['null', string]
    label: Regularization weight per level
    inputBinding:
      prefix: --lambda=
      separate: false

  # Advanced options
  ssqlambda:
    type: ['null', int]
    label: Weight lambda by sum-of-squared differences (0 or 1)
    inputBinding:
      prefix: --ssqlambda=
      separate: false
  jacrange:
    type: ['null', string]
    label: Allowable Jacobian range (e.g., "0.01,100")
    inputBinding:
      prefix: --jacrange=
      separate: false
  biasres:
    type: ['null', string]
    label: Bias field spline resolution (e.g., "50,50,50")
    inputBinding:
      prefix: --biasres=
      separate: false
  biaslambda:
    type: ['null', double]
    label: Bias field regularization weight
    inputBinding:
      prefix: --biaslambda=
      separate: false
  numprec:
    type:
      - 'null'
      - type: enum
        symbols: [float, double]
    label: Numerical precision for Hessian calculation
    inputBinding:
      prefix: --numprec=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: --verbose

outputs:
  warp_coefficients:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.cout).nii.gz
        - $(inputs.cout).nii
  warped_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.iout).nii.gz
        - $(inputs.iout).nii
  displacement_field:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.fout).nii.gz
        - $(inputs.fout).nii
  jacobian_map:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.jout).nii.gz
        - $(inputs.jout).nii
  intensity_modulated_ref:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.refout).nii.gz
        - $(inputs.refout).nii
  log:
    type: File
    outputBinding:
      glob: fnirt.log
