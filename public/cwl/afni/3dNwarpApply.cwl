#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dNwarpApply.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dNwarpApply'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  nwarp:
    type: File
    label: 3D warp dataset to apply
    secondaryFiles:
      - ^.BRIK
    inputBinding: {prefix: -nwarp}
  source:
    type: File
    label: Source dataset to be warped
    inputBinding: {prefix: -source}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Grid specification
  master:
    type: ['null', string]
    label: Master dataset defining output grid (or WARP/NWARP)
    inputBinding: {prefix: -master}
  newgrid:
    type: ['null', double]
    label: New grid spacing in mm for cubical voxels
    inputBinding: {prefix: -newgrid}
  dxyz:
    type: ['null', double]
    label: Same as -newgrid
    inputBinding: {prefix: -dxyz}

  # Warp options
  iwarp:
    type: ['null', boolean]
    label: Invert computed warp
    inputBinding: {prefix: -iwarp}

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [NN, linear, cubic, quintic, wsinc5]
    label: Interpolation mode (default wsinc5)
    inputBinding: {prefix: -interp}
  ainterp:
    type:
      - 'null'
      - type: enum
        symbols: [NN, linear, cubic, quintic, wsinc5]
    label: Alternate interpolation for data
    inputBinding: {prefix: -ainterp}

  # Output options
  suffix:
    type: ['null', string]
    label: Custom suffix for auto-generated output names
    inputBinding: {prefix: -suffix}
  short:
    type: ['null', boolean]
    label: Write output as 16-bit integers
    inputBinding: {prefix: -short}
  wprefix:
    type: ['null', string]
    label: Save intermediate warps with prefix
    inputBinding: {prefix: -wprefix}

  # Verbosity
  quiet:
    type: ['null', boolean]
    label: Suppress verbose output
    inputBinding: {prefix: -quiet}
  verb:
    type: ['null', boolean]
    label: Enable extra verbose output
    inputBinding: {prefix: -verb}

outputs:
  warped:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
