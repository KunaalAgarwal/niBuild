#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dmaskave.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dmaskave'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.input.nameroot)_maskave.1D
stderr: 3dmaskave.log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {position: 100}

  # Mask options
  mask:
    type: ['null', File]
    label: Use mask dataset for averaging
    inputBinding: {prefix: -mask}
  mindex:
    type: ['null', int]
    label: Which sub-brick from mask to use (default 0)
    inputBinding: {prefix: -mindex}
  mrange:
    type: ['null', string]
    label: Restrict mask voxels to values between a and b
    inputBinding: {prefix: -mrange}

  # Data selection
  dindex:
    type: ['null', int]
    label: Select sub-brick from input dataset
    inputBinding: {prefix: -dindex}
  drange:
    type: ['null', string]
    label: Include only input voxels with values between a and b
    inputBinding: {prefix: -drange}
  slices:
    type: ['null', string]
    label: Restrict to slice numbers p through q
    inputBinding: {prefix: -slices}

  # Coordinate-based masks
  xbox:
    type: ['null', string]
    label: Create mask using box at x y z location
    inputBinding: {prefix: -xbox}
  xball:
    type: ['null', string]
    label: Create mask using sphere at x y z with radius r
    inputBinding: {prefix: -xball}

  # Statistics options
  sigma:
    type: ['null', boolean]
    label: Compute standard deviation alongside mean
    inputBinding: {prefix: -sigma}
  sum:
    type: ['null', boolean]
    label: Calculate sum instead of mean
    inputBinding: {prefix: -sum}
  sumsq:
    type: ['null', boolean]
    label: Calculate sum of squares
    inputBinding: {prefix: -sumsq}
  enorm:
    type: ['null', boolean]
    label: Calculate Euclidean norm
    inputBinding: {prefix: -enorm}
  median:
    type: ['null', boolean]
    label: Calculate median instead of mean
    inputBinding: {prefix: -median}
  max:
    type: ['null', boolean]
    label: Calculate maximum instead of mean
    inputBinding: {prefix: -max}
  min:
    type: ['null', boolean]
    label: Calculate minimum instead of mean
    inputBinding: {prefix: -min}
  perc:
    type: ['null', int]
    label: Compute the XX-th percentile value (0-100)
    inputBinding: {prefix: -perc}

  # Output options
  dump:
    type: ['null', boolean]
    label: Print all voxel values included in result
    inputBinding: {prefix: -dump}
  udump:
    type: ['null', boolean]
    label: Print unscaled voxel values
    inputBinding: {prefix: -udump}
  indump:
    type: ['null', boolean]
    label: Print voxel indexes for dumped values
    inputBinding: {prefix: -indump}
  quiet:
    type: ['null', boolean]
    label: Output only minimal numerical results
    inputBinding: {prefix: -quiet}

outputs:
  average:
    type: stdout
  log:
    type: File
    outputBinding:
      glob: 3dmaskave.log
