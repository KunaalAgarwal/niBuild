#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dFWHMx.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dFWHMx'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.out)
stderr: 3dFWHMx.log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {prefix: -input}

  # Masking
  mask:
    type: ['null', File]
    label: Use only nonzero voxels in mask
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Generate mask automatically from input
    inputBinding: {prefix: -automask}

  # Preprocessing
  demed:
    type: ['null', boolean]
    label: Subtract median of each voxel time series
    inputBinding: {prefix: -demed}
  unif:
    type: ['null', boolean]
    label: Normalize voxel time series to same MAD
    inputBinding: {prefix: -unif}
  detrend:
    type: ['null', int]
    label: Remove polynomial trends up to order q
    inputBinding: {prefix: -detrend}
  detprefix:
    type: ['null', string]
    label: Save detrended dataset with prefix
    inputBinding: {prefix: -detprefix}

  # FWHM computation
  geom:
    type: ['null', boolean]
    label: Compute geometric mean of FWHM (default)
    inputBinding: {prefix: -geom}
  arith:
    type: ['null', boolean]
    label: Compute arithmetic mean of FWHM
    inputBinding: {prefix: -arith}
  combine:
    type: ['null', boolean]
    label: Combine measurements along each axis
    inputBinding: {prefix: -combine}

  # ACF computation
  acf:
    type: ['null', string]
    label: Compute ACF fit (output a b c parameters)
    inputBinding: {prefix: -acf}
  ACF:
    type: ['null', string]
    label: Same as -acf but with comment lines
    inputBinding: {prefix: -ACF}

  # Output
  out:
    type: string
    label: Output filename for FWHM results
    default: "3dFWHMx_output.1D"
    inputBinding: {prefix: -out}

  # Other options
  compat:
    type: ['null', boolean]
    label: Compatibility mode with older 3dFWHM
    inputBinding: {prefix: -compat}
  difMAD:
    type: ['null', boolean]
    label: Use first/second neighbor differences with MAD
    inputBinding: {prefix: -2difMAD}

outputs:
  fwhm_output:
    type: File
    outputBinding:
      glob: $(inputs.out)
  acf_output:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.acf)
  detrended:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.detprefix)+orig.*
        - $(inputs.detprefix).nii*
  log:
    type: File
    outputBinding:
      glob: 3dFWHMx.log
