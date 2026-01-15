#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dmerge.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dmerge'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {position: 100}
  prefix:
    type: string
    label: Output dataset prefix
    inputBinding: {prefix: -prefix}

  # Blur options
  blur_fwhm:
    type: ['null', double]
    label: Gaussian blur with FWHM (mm)
    inputBinding: {prefix: -1blur_fwhm}
  blur_sigma:
    type: ['null', double]
    label: Gaussian blur with sigma (mm)
    inputBinding: {prefix: -1blur_sigma}
  blur_rms:
    type: ['null', double]
    label: Gaussian blur with RMS deviation (mm)
    inputBinding: {prefix: -1blur_rms}

  # Editing options
  thtoin:
    type: ['null', boolean]
    label: Copy threshold data over intensity data
    inputBinding: {prefix: -1thtoin}
  noneg:
    type: ['null', boolean]
    label: Zero out negative intensity voxels
    inputBinding: {prefix: -1noneg}
  abs:
    type: ['null', boolean]
    label: Take absolute values of intensities
    inputBinding: {prefix: -1abs}
  clip:
    type: ['null', double]
    label: Clip intensities in range (-val,val) to zero
    inputBinding: {prefix: -1clip}
  thresh:
    type: ['null', double]
    label: Use threshold data to censor intensities
    inputBinding: {prefix: -1thresh}
  mult:
    type: ['null', double]
    label: Multiply intensities by given factor
    inputBinding: {prefix: -1mult}
  zscore:
    type: ['null', boolean]
    label: Convert statistic to equivalent z-score
    inputBinding: {prefix: -1zscore}

  # Cluster options
  clust:
    type: ['null', string]
    label: Form clusters with rmm vmul (e.g., "5 100")
    inputBinding: {prefix: -1clust}
  clust_mean:
    type: ['null', string]
    label: Replace cluster voxels with average intensity
    inputBinding: {prefix: -1clust_mean}
  clust_max:
    type: ['null', string]
    label: Replace cluster voxels with maximum intensity
    inputBinding: {prefix: -1clust_max}

  # Filter options
  filter_mean:
    type: ['null', double]
    label: Set each voxel to average intensity within radius (mm)
    inputBinding: {prefix: -1filter_mean}
  filter_max:
    type: ['null', double]
    label: Maximum intensity within radius (mm)
    inputBinding: {prefix: -1filter_max}
  filter_blur:
    type: ['null', double]
    label: Gaussian blur filter with FWHM (mm)
    inputBinding: {prefix: -1filter_blur}

  # Erosion/Dilation
  erode:
    type: ['null', double]
    label: Set voxel to zero unless pv% of nearby voxels are nonzero
    inputBinding: {prefix: -1erode}
  dilate:
    type: ['null', boolean]
    label: Restore voxels removed by erosion if neighbors exist
    inputBinding: {prefix: -1dilate}

  # Sub-brick selection
  dindex:
    type: ['null', int]
    label: Use sub-brick j as data source
    inputBinding: {prefix: -1dindex}
  tindex:
    type: ['null', int]
    label: Use sub-brick k as threshold source
    inputBinding: {prefix: -1tindex}

  # Output options
  doall:
    type: ['null', boolean]
    label: Apply options to all sub-bricks uniformly
    inputBinding: {prefix: -doall}
  datum:
    type:
      - 'null'
      - type: enum
        symbols: [byte, short, float]
    label: Output data storage type
    inputBinding: {prefix: -datum}
  nozero:
    type: ['null', boolean]
    label: Do not write output if all zero
    inputBinding: {prefix: -nozero}
  quiet:
    type: ['null', boolean]
    label: Reduce message output
    inputBinding: {prefix: -quiet}

outputs:
  merged:
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
