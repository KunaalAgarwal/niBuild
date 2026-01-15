#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mris_inflate
# Inflates cortical surface for visualization

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mris_inflate'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:7.4.1

requirements:
  EnvVarRequirement:
    envDef:
      - envName: SUBJECTS_DIR
        envValue: $(inputs.subjects_dir.path)
      - envName: FS_LICENSE
        envValue: $(inputs.fs_license.path)

stdout: mris_inflate.log
stderr: mris_inflate.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  input:
    type: File
    label: Input surface file
    inputBinding:
      position: 50
  output:
    type: string
    label: Output inflated surface filename
    inputBinding:
      position: 51

  # Iteration options
  n:
    type: ['null', int]
    label: Maximum number of iterations (default 10)
    inputBinding:
      prefix: -n
      position: 1
  dist:
    type: ['null', double]
    label: Distance for inflation
    inputBinding:
      prefix: -dist
      position: 2

  # Sulc options
  no_save_sulc:
    type: ['null', boolean]
    label: Do not save sulc file
    inputBinding:
      prefix: -no-save-sulc
      position: 3
  sulc:
    type: ['null', string]
    label: Output sulc filename
    inputBinding:
      prefix: -sulc
      position: 4

  # Processing options
  nbrs:
    type: ['null', int]
    label: Number of neighbors for smoothing
    inputBinding:
      prefix: -nbrs
      position: 5
  spring:
    type: ['null', double]
    label: Spring constant
    inputBinding:
      prefix: -spring
      position: 6
  area:
    type: ['null', double]
    label: Area coefficient
    inputBinding:
      prefix: -area
      position: 7

  # Output options
  w:
    type: ['null', int]
    label: Write intermediate surfaces every N iterations
    inputBinding:
      prefix: -w
      position: 8

outputs:
  inflated:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  sulc_file:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.sulc)
        - "*.sulc"
  log:
    type: File
    outputBinding:
      glob: mris_inflate.log
