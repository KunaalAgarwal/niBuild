#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/@auto_tlrc.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '@auto_tlrc'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input anatomical dataset
    inputBinding: {prefix: -input}
  base:
    type: File
    label: Reference template in standard space (e.g., TT_N27+tlrc)
    inputBinding: {prefix: -base}

  # Output naming
  prefix:
    type: ['null', string]
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}
  suffix:
    type: ['null', string]
    label: Output dataset suffix
    inputBinding: {prefix: -suffix}

  # Skull stripping options
  no_ss:
    type: ['null', boolean]
    label: Do not strip skull of input dataset
    inputBinding: {prefix: -no_ss}
  warp_orig_vol:
    type: ['null', boolean]
    label: Preserve skull in output by warping original volume
    inputBinding: {prefix: -warp_orig_vol}

  # Resolution options
  dxyz:
    type: ['null', double]
    label: Cubic voxel size in mm (default matches template)
    inputBinding: {prefix: -dxyz}
  dx:
    type: ['null', double]
    label: X voxel dimension in mm
    inputBinding: {prefix: -dx}
  dy:
    type: ['null', double]
    label: Y voxel dimension in mm
    inputBinding: {prefix: -dy}
  dz:
    type: ['null', double]
    label: Z voxel dimension in mm
    inputBinding: {prefix: -dz}

  # Padding
  pad_base:
    type: ['null', double]
    label: Padding in mm to prevent cropping (default 15)
    inputBinding: {prefix: -pad_base}

  # Transform options
  xform:
    type:
      - 'null'
      - type: enum
        symbols: [affine_general, shift_rotate_scale]
    label: Warping transformation type
    inputBinding: {prefix: -xform}
  init_xform:
    type: ['null', File]
    label: Apply preliminary affine transform before registration
    inputBinding: {prefix: -init_xform}

  # Algorithm options
  maxite:
    type: ['null', int]
    label: Maximum iterations for alignment algorithm
    inputBinding: {prefix: -maxite}
  use_3dAllineate:
    type: ['null', boolean]
    label: Use 3dAllineate instead of 3dWarpDrive
    inputBinding: {prefix: -3dAllineate}

  # For applying transform to other datasets
  apar:
    type: ['null', File]
    label: Reference anatomical for applying transform
    inputBinding: {prefix: -apar}
  onewarp:
    type: ['null', boolean]
    label: Single interpolation step
    inputBinding: {prefix: -onewarp}
  twowarp:
    type: ['null', boolean]
    label: Dual interpolation steps
    inputBinding: {prefix: -twowarp}

  # Other options
  overwrite:
    type: ['null', boolean]
    label: Replace existing outputs
    inputBinding: {prefix: -overwrite}

outputs:
  tlrc_anat:
    type: File
    outputBinding:
      glob:
        - "*+tlrc.HEAD"
        - "*+tlrc.BRIK"
        - "*+tlrc.BRIK.gz"
  transform:
    type: ['null', File]
    outputBinding:
      glob: "*.Xat.1D"
  log:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix).log
