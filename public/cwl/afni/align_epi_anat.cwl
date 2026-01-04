#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/align_epi_anat.py.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'align_epi_anat.py'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

stdout: align_epi_anat.log
stderr: align_epi_anat.log

inputs:
  epi:
    type: File
    label: EPI dataset to align
    inputBinding: {prefix: -epi}
  anat:
    type: File
    label: Anatomical dataset
    inputBinding: {prefix: -anat}
  epi_base:
    type: string
    label: EPI base used in alignment (0/mean/median/max/subbrick#)
    inputBinding: {prefix: -epi_base}

  # Alignment direction
  anat2epi:
    type: ['null', boolean]
    label: Align anatomical to EPI (default)
    inputBinding: {prefix: -anat2epi}
  epi2anat:
    type: ['null', boolean]
    label: Align EPI to anatomical instead
    inputBinding: {prefix: -epi2anat}

  # Output naming
  suffix:
    type: ['null', string]
    label: Suffix to append to output names (default _al)
    inputBinding: {prefix: -suffix}
  output_dir:
    type: ['null', string]
    label: Output directory for results
    inputBinding: {prefix: -output_dir}

  # Movement options
  big_move:
    type: ['null', boolean]
    label: Enable two-pass alignment for larger displacements
    inputBinding: {prefix: -big_move}
  giant_move:
    type: ['null', boolean]
    label: Even larger movement - uses cmass, two passes, very large angles
    inputBinding: {prefix: -giant_move}
  ginormous_move:
    type: ['null', boolean]
    label: Combines giant_move with center alignment
    inputBinding: {prefix: -ginormous_move}
  rigid_body:
    type: ['null', boolean]
    label: Limit transformation to translation and rotation only
    inputBinding: {prefix: -rigid_body}

  # Processing options
  volreg:
    type:
      - 'null'
      - type: enum
        symbols: ['on', 'off']
    label: Perform volume registration on EPI (default on)
    inputBinding: {prefix: -volreg}
  tshift:
    type:
      - 'null'
      - type: enum
        symbols: ['on', 'off']
    label: Enable time-series correction (default on)
    inputBinding: {prefix: -tshift}
  deoblique:
    type:
      - 'null'
      - type: enum
        symbols: ['on', 'off']
    label: Correct oblique dataset orientations (default on)
    inputBinding: {prefix: -deoblique}

  # Cost function
  cost:
    type: ['null', string]
    label: Alignment cost function (default lpc)
    inputBinding: {prefix: -cost}
  edge:
    type: ['null', boolean]
    label: Use edge-detection method instead of standard cost
    inputBinding: {prefix: -edge}

  # Saving options
  save_all:
    type: ['null', boolean]
    label: Preserve all intermediate datasets
    inputBinding: {prefix: -save_all}
  save_vr:
    type: ['null', boolean]
    label: Save motion-corrected EPI dataset
    inputBinding: {prefix: -save_vr}
  save_skullstrip:
    type: ['null', boolean]
    label: Save skull-stripped anatomy
    inputBinding: {prefix: -save_skullstrip}

  # Skull stripping
  anat_has_skull:
    type:
      - 'null'
      - type: enum
        symbols: ['yes', 'no']
    label: Whether anatomical has skull
    inputBinding: {prefix: -anat_has_skull}
  epi_strip:
    type:
      - 'null'
      - type: enum
        symbols: ['3dSkullStrip', '3dAutomask', 'None']
    label: Method for stripping EPI
    inputBinding: {prefix: -epi_strip}

outputs:
  aligned_anat:
    type: ['null', File]
    outputBinding:
      glob:
        - "*_al+orig.HEAD"
        - "*_al+orig.BRIK"
        - "*_al.nii"
        - "*_al.nii.gz"
  aligned_epi:
    type: ['null', File]
    outputBinding:
      glob:
        - "*_al_reg+orig.HEAD"
        - "*_al_reg+orig.BRIK"
  transform_matrix:
    type: ['null', File]
    outputBinding:
      glob: "*.aff12.1D"
  volreg_output:
    type: ['null', File]
    outputBinding:
      glob: "*_vr+orig.*"
  log:
    type: File
    outputBinding:
      glob: align_epi_anat.log
