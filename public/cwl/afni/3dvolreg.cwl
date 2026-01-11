#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dvolreg.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dvolreg'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input 4D dataset
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Base volume selection
  base:
    type: ['null', int]
    label: Base brick index (default 0)
    inputBinding: {prefix: -base}
  base_file:
    type: ['null', File]
    label: Base brick from external dataset
    inputBinding: {prefix: -base}

  # Interpolation methods (mutually exclusive)
  interpolation:
    type:
      - 'null'
      - type: enum
        symbols: [Fourier, heptic, quintic, cubic, linear]
    label: Interpolation method
    inputBinding: {prefix: '-'}

  # Motion parameter output files
  dfile:
    type: ['null', string]
    label: Save 9-column motion parameters (roll, pitch, yaw, dS, dL, dP, rmsold, rmsnew)
    inputBinding: {prefix: -dfile}
  oned_file:
    type: ['null', string]
    label: Save 6-column motion parameters for detrending
    inputBinding: {prefix: -1Dfile}
  oned_matrix_save:
    type: ['null', string]
    label: Save coordinate transformation matrix
    inputBinding: {prefix: -1Dmatrix_save}

  # Output options
  float:
    type: ['null', boolean]
    label: Force floating-point output format
    inputBinding: {prefix: -float}
  clipit:
    type: ['null', boolean]
    label: Clip output values to input range (default)
    inputBinding: {prefix: -clipit}
  noclip:
    type: ['null', boolean]
    label: Disable value clipping
    inputBinding: {prefix: -noclip}

  # Displacement analysis
  maxdisp:
    type: ['null', boolean]
    label: Print max brain voxel displacement in mm
    inputBinding: {prefix: -maxdisp}
  nomaxdisp:
    type: ['null', boolean]
    label: Disable max displacement calculation
    inputBinding: {prefix: -nomaxdisp}
  maxdisp1D:
    type: ['null', string]
    label: Write max displacement per sub-brick to file
    inputBinding: {prefix: -maxdisp1D}

  # Padding
  zpad:
    type: ['null', int]
    label: Zero-pad by n voxels during rotations (default 4)
    inputBinding: {prefix: -zpad}

  # Iteration control
  maxite:
    type: ['null', int]
    label: Maximum iterations for convergence (default 23)
    inputBinding: {prefix: -maxite}
  x_thresh:
    type: ['null', double]
    label: Convergence threshold in voxels (default 0.01)
    inputBinding: {prefix: -x_thresh}
  rot_thresh:
    type: ['null', double]
    label: Rotation convergence in degrees (default 0.02)
    inputBinding: {prefix: -rot_thresh}

  # Final interpolation
  final:
    type:
      - 'null'
      - type: enum
        symbols: [NN, cubic, quintic, heptic, Fourier, linear]
    label: Final interpolation method
    inputBinding: {prefix: -final}

  # Weighting
  weight:
    type: ['null', File]
    label: Apply voxel weighting from specified brick
    inputBinding: {prefix: -weight}

  # Two-pass registration
  twopass:
    type: ['null', boolean]
    label: Perform two-pass registration (coarse then fine)
    inputBinding: {prefix: -twopass}
  twoblur:
    type: ['null', double]
    label: Blur factor for pass 1 (default 2.0)
    inputBinding: {prefix: -twoblur}

  # Verbose output
  verbose:
    type: ['null', boolean]
    label: Print progress reports
    inputBinding: {prefix: -verbose}

outputs:
  registered:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  motion_params:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.dfile)
  motion_1D:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.oned_file)
  transform_matrix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.oned_matrix_save)
  max_displacement:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.maxdisp1D)
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
