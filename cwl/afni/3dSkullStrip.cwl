#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dSkullStrip.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: ['xvfb-run', '-a', '3dSkullStrip']

hints:
  DockerRequirement:
    dockerPull: fmribuild/afni-test:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input volume
    inputBinding: {prefix: -input, position: 1}
  prefix:
    type: string
    label: Output volume prefix
    inputBinding: {prefix: -prefix, position: 2}

  # OPTIONAL PARAMETERS - Output Options
  mask_vol:
    type: ['null', boolean]
    label: Output mask volume instead of skull-stripped volume
    inputBinding: {prefix: -mask_vol}
  orig_vol:
    type: ['null', boolean]
    label: Preserve original intensity values
    inputBinding: {prefix: -orig_vol}
  skulls:
    type: ['null', boolean]
    label: Output skull surface models
    inputBinding: {prefix: -skulls}

  # Surface Expansion Parameters
  niter:
    type: ['null', int]
    label: Iteration count (default 250)
    inputBinding: {prefix: -niter}
  shrink_fac:
    type: ['null', double]
    label: Brain/non-brain intensity threshold (0-1, default 0.6)
    inputBinding: {prefix: -shrink_fac}
  var_shrink_fac:
    type: ['null', boolean]
    label: Vary shrink factor across iterations (default)
    inputBinding: {prefix: -var_shrink_fac}
  no_var_shrink_fac:
    type: ['null', boolean]
    label: Keep constant shrink factor
    inputBinding: {prefix: -no_var_shrink_fac}
  shrink_fac_bot_lim:
    type: ['null', double]
    label: Minimum shrink factor (default 0.65-0.4)
    inputBinding: {prefix: -shrink_fac_bot_lim}
  init_radius:
    type: ['null', double]
    label: Initial sphere radius in mm
    inputBinding: {prefix: -init_radius}
  exp_frac:
    type: ['null', double]
    label: Expansion speed (default 0.1)
    inputBinding: {prefix: -exp_frac}

  # Surface Refinement
  push_to_edge:
    type: ['null', boolean]
    label: Aggressive push to brain edges
    inputBinding: {prefix: -push_to_edge}
  no_push_to_edge:
    type: ['null', boolean]
    label: Disable aggressive edge push (default)
    inputBinding: {prefix: -no_push_to_edge}
  touchup:
    type: ['null', boolean]
    label: Include uncovered areas (default)
    inputBinding: {prefix: -touchup}
  no_touchup:
    type: ['null', boolean]
    label: Skip touchup operations
    inputBinding: {prefix: -no_touchup}
  fill_hole:
    type: ['null', double]
    label: Fill holes up to R pixels
    inputBinding: {prefix: -fill_hole}
  smooth_final:
    type: ['null', int]
    label: Final smoothing iterations (default 20)
    inputBinding: {prefix: -smooth_final}

  # Anatomical Avoidance
  avoid_vent:
    type: ['null', boolean]
    label: Avoid ventricles (default)
    inputBinding: {prefix: -avoid_vent}
  no_avoid_vent:
    type: ['null', boolean]
    label: Disable ventricle avoidance
    inputBinding: {prefix: -no_avoid_vent}
  avoid_eyes:
    type: ['null', boolean]
    label: Avoid eyes (default)
    inputBinding: {prefix: -avoid_eyes}
  no_avoid_eyes:
    type: ['null', boolean]
    label: Disable eye avoidance
    inputBinding: {prefix: -no_avoid_eyes}
  use_edge:
    type: ['null', boolean]
    label: Edge detection to reduce leakage (default)
    inputBinding: {prefix: -use_edge}
  no_use_edge:
    type: ['null', boolean]
    label: Disable edge detection
    inputBinding: {prefix: -no_use_edge}

  # Data Processing
  blur_fwhm:
    type: ['null', double]
    label: Blur kernel width (recommended 2-4)
    inputBinding: {prefix: -blur_fwhm}

  # Species-specific options
  monkey:
    type: ['null', boolean]
    label: Process monkey brain data
    inputBinding: {prefix: -monkey}
  marmoset:
    type: ['null', boolean]
    label: Process marmoset brain data
    inputBinding: {prefix: -marmoset}
  rat:
    type: ['null', boolean]
    label: Process rat brain data
    inputBinding: {prefix: -rat}

outputs:
  skull_stripped:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  mask:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_mask+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
