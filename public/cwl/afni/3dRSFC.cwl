#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dRSFC.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dRSFC'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input 3D+time dataset
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Frequency band (required positional arguments)
  fbot:
    type: double
    label: Lowest frequency in passband (Hz)
    inputBinding: {position: 1}
  ftop:
    type: double
    label: Highest frequency in passband (Hz)
    inputBinding: {position: 2}

  # Alternative band specification
  band:
    type: ['null', string]
    label: Alternative passband specification (fbot ftop)
    inputBinding: {prefix: -band}

  # Preprocessing options
  despike:
    type: ['null', boolean]
    label: Despike each time series before processing
    inputBinding: {prefix: -despike}
  nodetrend:
    type: ['null', boolean]
    label: Skip quadratic detrending before FFT
    inputBinding: {prefix: -nodetrend}
  notrans:
    type: ['null', boolean]
    label: Skip initial transient checking
    inputBinding: {prefix: -notrans}

  # Nuisance regression
  ort:
    type: ['null', File]
    label: Orthogonalize input to columns in 1D file
    inputBinding: {prefix: -ort}
  dsort:
    type: ['null', File]
    label: Orthogonalize each voxel to matching voxel in dataset
    inputBinding: {prefix: -dsort}

  # Timing options
  dt:
    type: ['null', double]
    label: Set time step in seconds (default from header)
    inputBinding: {prefix: -dt}
  nfft:
    type: ['null', int]
    label: FFT length
    inputBinding: {prefix: -nfft}

  # Masking and smoothing
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Create mask from input dataset
    inputBinding: {prefix: -automask}
  blur:
    type: ['null', double]
    label: Blur filter width FWHM in mm
    inputBinding: {prefix: -blur}
  localPV:
    type: ['null', double]
    label: Replace vectors with local principal vector (radius in mm)
    inputBinding: {prefix: -localPV}

  # Output options
  norm:
    type: ['null', boolean]
    label: Make output time series have L2 norm = 1
    inputBinding: {prefix: -norm}
  no_rs_out:
    type: ['null', boolean]
    label: Skip time series output, calculate parameters only
    inputBinding: {prefix: -no_rs_out}
  un_bp_out:
    type: ['null', boolean]
    label: Output un-bandpassed series
    inputBinding: {prefix: -un_bp_out}
  no_rsfa:
    type: ['null', boolean]
    label: Skip RSFA parameter calculation
    inputBinding: {prefix: -no_rsfa}
  bp_at_end:
    type: ['null', boolean]
    label: Perform bandpassing as final step
    inputBinding: {prefix: -bp_at_end}

  # Verbosity
  quiet:
    type: ['null', boolean]
    label: Suppress informational messages
    inputBinding: {prefix: -quiet}

outputs:
  filtered:
    type: File
    outputBinding:
      glob: $(inputs.prefix)_LFF+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  alff:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_ALFF+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  falff:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_fALFF+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  rsfa:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.prefix)_RSFA+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
