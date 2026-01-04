#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Prints average timeseries (intensities) over masked voxels

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslmeants'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fslmeants.log
stderr: fslmeants.log

inputs:
  input:
    type: File
    label: Input 4D image
    inputBinding:
      prefix: -i
      position: 1
  output:
    type: string
    label: Output text file for timeseries
    inputBinding:
      prefix: -o
      position: 2

  # Mask options
  mask:
    type: ['null', File]
    label: Mask image
    inputBinding:
      prefix: -m
      position: 3
  label:
    type: ['null', File]
    label: Label image for extracting timeseries per label
    inputBinding:
      prefix: --label
      position: 4

  # Coordinate options
  coord:
    type: ['null', string]
    label: Voxel coordinates (x y z) for single voxel timeseries
    inputBinding:
      prefix: -c
      position: 5
  usemm:
    type: ['null', boolean]
    label: Use mm coordinates instead of voxel coordinates
    inputBinding:
      prefix: --usemm
      position: 6

  # Output options
  showall:
    type: ['null', boolean]
    label: Show all voxel time series instead of mean
    inputBinding:
      prefix: --showall
      position: 7
  transpose:
    type: ['null', boolean]
    label: Output in transposed format (time x voxels)
    inputBinding:
      prefix: --transpose
      position: 8
  eig:
    type: ['null', boolean]
    label: Calculate eigenvariates instead of mean
    inputBinding:
      prefix: --eig
      position: 9
  order:
    type: ['null', int]
    label: Number of eigenvariates to output
    inputBinding:
      prefix: --order
      position: 10
  nobin:
    type: ['null', boolean]
    label: Do not binarize mask for eigenvariate calculation
    inputBinding:
      prefix: --no_bin
      position: 11
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      position: 12

outputs:
  timeseries:
    type: File
    outputBinding:
      glob: $(inputs.output)
  log:
    type: File
    outputBinding:
      glob: fslmeants.log
