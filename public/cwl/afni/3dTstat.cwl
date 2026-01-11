#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dTstat.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dTstat'

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

  # Basic statistics
  mean:
    type: ['null', boolean]
    label: Compute mean of input voxels
    inputBinding: {prefix: -mean}
  sum:
    type: ['null', boolean]
    label: Compute sum of input voxels
    inputBinding: {prefix: -sum}
  abssum:
    type: ['null', boolean]
    label: Compute absolute sum
    inputBinding: {prefix: -abssum}
  sos:
    type: ['null', boolean]
    label: Compute sum of squares
    inputBinding: {prefix: -sos}
  l2norm:
    type: ['null', boolean]
    label: Compute L2 norm (sqrt of sum of squares)
    inputBinding: {prefix: -l2norm}

  # Variability measures
  stdev:
    type: ['null', boolean]
    label: Standard deviation (with detrending)
    inputBinding: {prefix: -stdev}
  stdevNOD:
    type: ['null', boolean]
    label: Standard deviation (without detrending)
    inputBinding: {prefix: -stdevNOD}
  cvar:
    type: ['null', boolean]
    label: Coefficient of variation (with detrending)
    inputBinding: {prefix: -cvar}
  cvarNOD:
    type: ['null', boolean]
    label: Coefficient of variation (without detrending)
    inputBinding: {prefix: -cvarNOD}
  MAD:
    type: ['null', boolean]
    label: Median absolute deviation
    inputBinding: {prefix: -MAD}
  tsnr:
    type: ['null', boolean]
    label: Temporal signal-to-noise ratio
    inputBinding: {prefix: -tsnr}

  # Min/Max statistics
  min:
    type: ['null', boolean]
    label: Compute minimum
    inputBinding: {prefix: -min}
  max:
    type: ['null', boolean]
    label: Compute maximum
    inputBinding: {prefix: -max}
  absmax:
    type: ['null', boolean]
    label: Compute absolute maximum
    inputBinding: {prefix: -absmax}
  argmin:
    type: ['null', boolean]
    label: Index of minimum
    inputBinding: {prefix: -argmin}
  argmax:
    type: ['null', boolean]
    label: Index of maximum
    inputBinding: {prefix: -argmax}

  # Central tendency
  median:
    type: ['null', boolean]
    label: Median of input voxels
    inputBinding: {prefix: -median}
  nzmedian:
    type: ['null', boolean]
    label: Median of non-zero voxels
    inputBinding: {prefix: -nzmedian}
  nzmean:
    type: ['null', boolean]
    label: Mean of non-zero voxels
    inputBinding: {prefix: -nzmean}
  percentile:
    type: ['null', double]
    label: P-th percentile point
    inputBinding: {prefix: -percentile}

  # Count statistics
  zcount:
    type: ['null', boolean]
    label: Count zero values
    inputBinding: {prefix: -zcount}
  nzcount:
    type: ['null', boolean]
    label: Count non-zero values
    inputBinding: {prefix: -nzcount}

  # Time series analysis
  slope:
    type: ['null', boolean]
    label: Compute slope vs time
    inputBinding: {prefix: -slope}
  autocorr:
    type: ['null', int]
    label: Autocorrelation function (first n coefficients)
    inputBinding: {prefix: -autocorr}
  autoreg:
    type: ['null', int]
    label: Autoregression coefficients (first n)
    inputBinding: {prefix: -autoreg}
  DW:
    type: ['null', boolean]
    label: Durbin-Watson statistic
    inputBinding: {prefix: -DW}

  # Other statistics
  skewness:
    type: ['null', boolean]
    label: Measure of asymmetry
    inputBinding: {prefix: -skewness}
  kurtosis:
    type: ['null', boolean]
    label: Fourth standardized moment
    inputBinding: {prefix: -kurtosis}

  # Preprocessing
  tdiff:
    type: ['null', boolean]
    label: Take first difference before processing
    inputBinding: {prefix: -tdiff}

  # Output options
  datum:
    type:
      - 'null'
      - type: enum
        symbols: [byte, short, float]
    label: Output data type (default float)
    inputBinding: {prefix: -datum}
  nscale:
    type: ['null', boolean]
    label: Do not scale output
    inputBinding: {prefix: -nscale}

  # Masking
  mask:
    type: ['null', File]
    label: Use as voxel mask
    inputBinding: {prefix: -mask}
  mrange:
    type: ['null', string]
    label: Restrict mask values to range (a b)
    inputBinding: {prefix: -mrange}

outputs:
  stats:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
