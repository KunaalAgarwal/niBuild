#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FLIRT
# Linear registration tool

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'flirt'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: flirt.log
stderr: flirt.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input image
    inputBinding:
      prefix: -in
      position: 1
  reference:
    type: File
    label: Reference image
    inputBinding:
      prefix: -ref
      position: 2
  output:
    type: string
    label: Output registered image filename
    inputBinding:
      prefix: -out
      position: 3

  # Output options
  output_matrix:
    type: ['null', string]
    label: Output transformation matrix filename
    inputBinding:
      prefix: -omat

  # Transform options
  dof:
    type: ['null', int]
    label: Degrees of freedom (6, 7, 9, or 12)
    inputBinding:
      prefix: -dof
  init_matrix:
    type: ['null', File]
    label: Initial transformation matrix
    inputBinding:
      prefix: -init
  apply_xfm:
    type: ['null', boolean]
    label: Apply transformation (requires init_matrix)
    inputBinding:
      prefix: -applyxfm
  apply_isoxfm:
    type: ['null', double]
    label: Apply transformation and resample to isotropic voxels
    inputBinding:
      prefix: -applyisoxfm
  uses_qform:
    type: ['null', boolean]
    label: Use qform/sform for initialization
    inputBinding:
      prefix: -usesqform
  rigid2D:
    type: ['null', boolean]
    label: Use 2D rigid body mode
    inputBinding:
      prefix: -2D

  # Cost function
  cost:
    type:
      - 'null'
      - type: enum
        symbols: [mutualinfo, corratio, normcorr, normmi, leastsq, labeldiff, bbr]
    label: Cost function
    inputBinding:
      prefix: -cost
  search_cost:
    type:
      - 'null'
      - type: enum
        symbols: [mutualinfo, corratio, normcorr, normmi, leastsq, labeldiff, bbr]
    label: Search cost function (if different from cost)
    inputBinding:
      prefix: -searchcost

  # Search options
  searchr_x:
    type: ['null', string]
    label: X-axis search range in degrees (e.g., "-90 90")
    inputBinding:
      prefix: -searchrx
  searchr_y:
    type: ['null', string]
    label: Y-axis search range in degrees
    inputBinding:
      prefix: -searchry
  searchr_z:
    type: ['null', string]
    label: Z-axis search range in degrees
    inputBinding:
      prefix: -searchrz
  no_search:
    type: ['null', boolean]
    label: Disable angular search
    inputBinding:
      prefix: -nosearch
  coarse_search:
    type: ['null', int]
    label: Coarse search angular step (degrees)
    inputBinding:
      prefix: -coarsesearch
  fine_search:
    type: ['null', int]
    label: Fine search angular step (degrees)
    inputBinding:
      prefix: -finesearch

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [trilinear, nearestneighbour, sinc, spline]
    label: Interpolation method
    inputBinding:
      prefix: -interp
  sinc_width:
    type: ['null', int]
    label: Sinc window width in voxels
    inputBinding:
      prefix: -sincwidth
  sinc_window:
    type:
      - 'null'
      - type: enum
        symbols: [rectangular, hanning, blackman]
    label: Sinc window type
    inputBinding:
      prefix: -sincwindow

  # Weighting
  in_weight:
    type: ['null', File]
    label: Input weighting volume
    inputBinding:
      prefix: -inweight
  ref_weight:
    type: ['null', File]
    label: Reference weighting volume
    inputBinding:
      prefix: -refweight

  # Other options
  bins:
    type: ['null', int]
    label: Number of histogram bins
    inputBinding:
      prefix: -bins
  min_sampling:
    type: ['null', double]
    label: Minimum voxel dimension for sampling
    inputBinding:
      prefix: -minsampling
  no_clamp:
    type: ['null', boolean]
    label: Do not clamp intensities
    inputBinding:
      prefix: -noclamp
  no_resample:
    type: ['null', boolean]
    label: Do not resample output
    inputBinding:
      prefix: -noresample
  padding_size:
    type: ['null', int]
    label: Padding size
    inputBinding:
      prefix: -paddingsize
  datatype:
    type:
      - 'null'
      - type: enum
        symbols: [char, short, int, float, double]
    label: Output data type
    inputBinding:
      prefix: -datatype
  verbose:
    type: ['null', int]
    label: Verbosity level (0, 1, or 2)
    inputBinding:
      prefix: -verbose

  # BBR options
  wm_seg:
    type: ['null', File]
    label: White matter segmentation for BBR
    inputBinding:
      prefix: -wmseg
  bbrslope:
    type: ['null', double]
    label: BBR slope value
    inputBinding:
      prefix: -bbrslope
  bbrtype:
    type:
      - 'null'
      - type: enum
        symbols: [signed, global_abs, local_abs]
    label: BBR cost variant
    inputBinding:
      prefix: -bbrtype

  # Fieldmap correction
  fieldmap:
    type: ['null', File]
    label: Fieldmap image in rad/s
    inputBinding:
      prefix: -fieldmap
  fieldmapmask:
    type: ['null', File]
    label: Fieldmap mask
    inputBinding:
      prefix: -fieldmapmask
  echospacing:
    type: ['null', double]
    label: EPI echo spacing in seconds
    inputBinding:
      prefix: -echospacing
  pedir:
    type: ['null', int]
    label: Phase encode direction (1, 2, 3, -1, -2, -3)
    inputBinding:
      prefix: -pedir
  schedule:
    type: ['null', File]
    label: Custom optimization schedule file
    inputBinding:
      prefix: -schedule

outputs:
  registered_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
  transformation_matrix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_matrix)
  log:
    type: File
    outputBinding:
      glob: flirt.log
