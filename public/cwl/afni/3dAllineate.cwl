#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dAllineate.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dAllineate'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  source:
    type: File
    label: Source dataset to be transformed
    inputBinding: {prefix: -source}
  base:
    type: File
    label: Reference/base dataset
    inputBinding: {prefix: -base}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Cost function
  cost:
    type:
      - 'null'
      - type: enum
        symbols: [ls, mi, crM, nmi, hel, crA, crU, lpc, lpa, lpc+, lpa+]
    label: Cost function for matching (default mi)
    inputBinding: {prefix: -cost}

  # Warp type
  warp:
    type:
      - 'null'
      - type: enum
        symbols: [shift_only, shift_rotate, shift_rotate_scale, affine_general]
    label: Transformation type (default affine_general)
    inputBinding: {prefix: -warp}

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [NN, linear, cubic, quintic]
    label: Interpolation during matching (default linear)
    inputBinding: {prefix: -interp}
  final:
    type:
      - 'null'
      - type: enum
        symbols: [NN, linear, cubic, quintic, wsinc5]
    label: Interpolation for output (default cubic)
    inputBinding: {prefix: -final}

  # Output matrices/parameters
  oned_matrix_save:
    type: ['null', string]
    label: Save transformation matrix to file
    inputBinding: {prefix: -1Dmatrix_save}
  oned_param_save:
    type: ['null', string]
    label: Save warp parameters to file
    inputBinding: {prefix: -1Dparam_save}

  # Apply existing transformation
  oned_matrix_apply:
    type: ['null', File]
    label: Apply transformation matrix from file
    inputBinding: {prefix: -1Dmatrix_apply}
  oned_param_apply:
    type: ['null', File]
    label: Apply warp parameters from file
    inputBinding: {prefix: -1Dparam_apply}

  # Optimization strategy
  onepass:
    type: ['null', boolean]
    label: Skip coarse resolution pass
    inputBinding: {prefix: -onepass}
  twopass:
    type: ['null', boolean]
    label: Apply two-pass strategy to all sub-bricks
    inputBinding: {prefix: -twopass}
  twofirst:
    type: ['null', boolean]
    label: Two-pass for first sub-brick only (default)
    inputBinding: {prefix: -twofirst}
  twobest:
    type: ['null', int]
    label: Number of best coarse candidates for fine pass (0-29, default 5)
    inputBinding: {prefix: -twobest}
  twoblur:
    type: ['null', double]
    label: Blurring radius for coarse pass in mm (default 11)
    inputBinding: {prefix: -twoblur}
  fineblur:
    type: ['null', double]
    label: Blurring radius for fine pass in mm (default 0)
    inputBinding: {prefix: -fineblur}
  conv:
    type: ['null', double]
    label: Convergence threshold in mm
    inputBinding: {prefix: -conv}

  # Masking
  autoweight:
    type: ['null', boolean]
    label: Compute weight from automask plus blurring
    inputBinding: {prefix: -autoweight}
  automask:
    type: ['null', boolean]
    label: Binary weight mask
    inputBinding: {prefix: -automask}
  autobox:
    type: ['null', boolean]
    label: Expand automask to rectangular box (default)
    inputBinding: {prefix: -autobox}
  nomask:
    type: ['null', boolean]
    label: Disable autoweight/mask computation
    inputBinding: {prefix: -nomask}
  weight:
    type: ['null', File]
    label: Custom weighting dataset
    inputBinding: {prefix: -weight}
  emask:
    type: ['null', File]
    label: Exclusion mask (nonzero voxels excluded)
    inputBinding: {prefix: -emask}
  source_mask:
    type: ['null', File]
    label: Mask for source dataset
    inputBinding: {prefix: -source_mask}
  source_automask:
    type: ['null', boolean]
    label: Automatically mask source dataset
    inputBinding: {prefix: -source_automask}

  # Parameter limits
  maxrot:
    type: ['null', double]
    label: Maximum rotation limit in degrees (default 30)
    inputBinding: {prefix: -maxrot}
  maxshf:
    type: ['null', double]
    label: Maximum shift limit in mm
    inputBinding: {prefix: -maxshf}
  maxscl:
    type: ['null', double]
    label: Maximum scaling factor (default 1.4)
    inputBinding: {prefix: -maxscl}
  maxshr:
    type: ['null', double]
    label: Maximum shearing factor (default 0.1111)
    inputBinding: {prefix: -maxshr}

  # Grid control
  master:
    type: ['null', File]
    label: Output uses grid of specified dataset
    inputBinding: {prefix: -master}
  newgrid:
    type: ['null', double]
    label: Output grid spacing in mm
    inputBinding: {prefix: -newgrid}

  # EPI-specific
  EPI:
    type: ['null', boolean]
    label: Treat source as EPI with constrained warping
    inputBinding: {prefix: -EPI}

  # Center of mass
  cmass:
    type: ['null', boolean]
    label: Use center-of-mass for initial shift alignment
    inputBinding: {prefix: -cmass}
  nocmass:
    type: ['null', boolean]
    label: Disable center-of-mass calculation (default)
    inputBinding: {prefix: -nocmass}

  # Data handling
  floatize:
    type: ['null', boolean]
    label: Write result as float format
    inputBinding: {prefix: -floatize}
  zclip:
    type: ['null', boolean]
    label: Replace negative values with zero
    inputBinding: {prefix: -zclip}

  # Verbosity
  verb:
    type: ['null', boolean]
    label: Print verbose progress reports
    inputBinding: {prefix: -verb}
  quiet:
    type: ['null', boolean]
    label: Suppress verbose output
    inputBinding: {prefix: -quiet}

outputs:
  aligned:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  matrix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.oned_matrix_save)
  params:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.oned_param_save)
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
