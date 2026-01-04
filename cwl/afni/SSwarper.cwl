#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/@SSwarper.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '@SSwarper'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: $(inputs.subid)_SSwarper.log
stderr: $(inputs.subid)_SSwarper.log

inputs:
  input:
    type: File
    label: Input anatomical dataset (non-skull-stripped, ~1mm resolution)
    inputBinding: {prefix: -input}
  base:
    type: File
    label: Base template dataset with similar contrast
    inputBinding: {prefix: -base}
  subid:
    type: string
    label: Subject ID code for output datasets
    inputBinding: {prefix: -subid}

  # Output options
  odir:
    type: ['null', string]
    label: Output directory (default is input directory)
    inputBinding: {prefix: -odir}

  # Warp control
  minp:
    type: ['null', int]
    label: Minimum patch size for 3dQwarp (default 11)
    inputBinding: {prefix: -minp}
  warpscale:
    type: ['null', double]
    label: Control warp flexibility (0.1-1.0, default 1.0)
    inputBinding: {prefix: -warpscale}
  skipwarp:
    type: ['null', boolean]
    label: Stop after skull-stripping, skip warping to template
    inputBinding: {prefix: -skipwarp}

  # Obliquity correction
  deoblique:
    type: ['null', boolean]
    label: Apply obliquity correction using 3dWarp
    inputBinding: {prefix: -deoblique}
  deoblique_refitly:
    type: ['null', boolean]
    label: Remove obliquity information via 3drefit
    inputBinding: {prefix: -deoblique_refitly}

  # Preprocessing toggles
  unifize_off:
    type: ['null', boolean]
    label: Skip intensity uniformization step
    inputBinding: {prefix: -unifize_off}
  aniso_off:
    type: ['null', boolean]
    label: Skip anisotropic smoothing preprocessing
    inputBinding: {prefix: -aniso_off}
  ceil_off:
    type: ['null', boolean]
    label: Skip ceiling value capping at 98th percentile
    inputBinding: {prefix: -ceil_off}
  init_skullstr_off:
    type: ['null', boolean]
    label: Skip initial skull-stripping pass
    inputBinding: {prefix: -init_skullstr_off}

  # Cost functions
  cost_nl_init:
    type: ['null', string]
    label: Cost function for initial nonlinear alignment (default lpa)
    inputBinding: {prefix: -cost_nl_init}
  cost_nl_final:
    type: ['null', string]
    label: Cost function for final nonlinear alignment (default pcl)
    inputBinding: {prefix: -cost_nl_final}

  # Alignment options
  giant_move:
    type: ['null', boolean]
    label: Apply expanded parameter alignment for extreme angles
    inputBinding: {prefix: -giant_move}

  # Mask options
  mask_ss:
    type: ['null', File]
    label: Provide mask instead of performing skull-stripping
    inputBinding: {prefix: -mask_ss}
  SSopt:
    type: ['null', string]
    label: Additional options passed to 3dSkullStrip
    inputBinding: {prefix: -SSopt}

  # QC options
  extra_qc_off:
    type: ['null', boolean]
    label: Omit extra QC JPEG images
    inputBinding: {prefix: -extra_qc_off}

  # Other options
  nolite:
    type: ['null', boolean]
    label: Disable lite option in 3dQwarp
    inputBinding: {prefix: -nolite}
  verb:
    type: ['null', boolean]
    label: Enable verbose 3dQwarp output
    inputBinding: {prefix: -verb}
  noclean:
    type: ['null', boolean]
    label: Preserve temporary files after completion
    inputBinding: {prefix: -noclean}

outputs:
  skull_stripped:
    type: File
    outputBinding:
      glob:
        - anatSS.$(inputs.subid).nii*
        - anatSS.$(inputs.subid)+orig.*
  warped:
    type: File
    outputBinding:
      glob:
        - anatQQ.$(inputs.subid).nii*
        - anatQQ.$(inputs.subid)+tlrc.*
  warp:
    type: File
    outputBinding:
      glob:
        - anatQQ.$(inputs.subid)_WARP.nii*
        - anatQQ.$(inputs.subid)_WARP+tlrc.*
  affine:
    type: ['null', File]
    outputBinding:
      glob: anatQQ.$(inputs.subid).aff12.1D
  log:
    type: File
    outputBinding:
      glob: $(inputs.subid)_SSwarper.log
