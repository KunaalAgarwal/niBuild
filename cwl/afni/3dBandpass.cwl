#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dBandpass.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dBandpass'

hints:
  DockerRequirement:
    dockerPull: afni/afni:latest

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

  # Frequency band (required)
  fbot:
    type: double
    label: Lowest frequency in passband (Hz), can be 0 for lowpass
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
    label: Remove spikes from time series before processing
    inputBinding: {prefix: -despike}
  nodetrend:
    type: ['null', boolean]
    label: Skip quadratic detrending before FFT bandpassing
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
    label: Specify FFT length
    inputBinding: {prefix: -nfft}

  # Mask options
  mask:
    type: ['null', File]
    label: Apply mask dataset
    inputBinding: {prefix: -mask}
  automask:
    type: ['null', boolean]
    label: Generate mask from input dataset
    inputBinding: {prefix: -automask}

  # Spatial filtering
  blur:
    type: ['null', double]
    label: Apply spatial filtering with specified FWHM (mm)
    inputBinding: {prefix: -blur}
  localPV:
    type: ['null', double]
    label: Replace vectors with local principal vector (radius in mm)
    inputBinding: {prefix: -localPV}

  # Output options
  norm:
    type: ['null', boolean]
    label: Normalize output time series to L2 norm = 1
    inputBinding: {prefix: -norm}
  quiet:
    type: ['null', boolean]
    label: Suppress informational messages
    inputBinding: {prefix: -quiet}

outputs:
  filtered:
    type: File
    outputBinding:
      glob:
        - $(inputs.prefix)+orig.HEAD
        - $(inputs.prefix)+orig.BRIK
        - $(inputs.prefix)+orig.BRIK.gz
        - $(inputs.prefix).nii
        - $(inputs.prefix).nii.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
