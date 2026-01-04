#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Usage: fslstats [-t] <input> [options]
# Reports summary statistics for an input 3D/4D image

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslstats'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fslstats_output.txt
stderr: fslstats.log

inputs:
  split_4d:
    type: ['null', boolean]
    label: Generate separate statistics for each 3D volume
    inputBinding:
      prefix: -t
      position: 1
  input:
    type: File
    label: Input image
    inputBinding:
      position: 2

  # Mask option
  mask:
    type: ['null', File]
    label: Mask image for statistics
    inputBinding:
      prefix: -k
      position: 3

  # Index mask for separate statistics per label
  index_mask:
    type: ['null', File]
    label: Generate separate statistics for each integer label
    inputBinding:
      prefix: -K
      position: 4

  # Statistics options
  robust_range:
    type: ['null', boolean]
    label: Output robust min and max (2nd and 98th percentiles)
    inputBinding:
      prefix: -r
      position: 5
  absolute_range:
    type: ['null', boolean]
    label: Output absolute min and max
    inputBinding:
      prefix: -R
      position: 6
  mean:
    type: ['null', boolean]
    label: Output mean
    inputBinding:
      prefix: -m
      position: 7
  mean_nonzero:
    type: ['null', boolean]
    label: Output mean of non-zero voxels
    inputBinding:
      prefix: -M
      position: 8
  std:
    type: ['null', boolean]
    label: Output standard deviation
    inputBinding:
      prefix: -s
      position: 9
  std_nonzero:
    type: ['null', boolean]
    label: Output standard deviation of non-zero voxels
    inputBinding:
      prefix: -S
      position: 10
  volume:
    type: ['null', boolean]
    label: Output number of voxels
    inputBinding:
      prefix: -v
      position: 11
  volume_nonzero:
    type: ['null', boolean]
    label: Output number of non-zero voxels
    inputBinding:
      prefix: -V
      position: 12
  entropy:
    type: ['null', boolean]
    label: Output entropy of image
    inputBinding:
      prefix: -e
      position: 13
  entropy_nonzero:
    type: ['null', boolean]
    label: Output entropy of non-zero voxels
    inputBinding:
      prefix: -E
      position: 14
  histogram:
    type: ['null', int]
    label: Output histogram with specified number of bins
    inputBinding:
      prefix: -h
      position: 15
  percentile:
    type: ['null', double]
    label: Output nth percentile value
    inputBinding:
      prefix: -p
      position: 16
  abs_percentile:
    type: ['null', double]
    label: Output nth percentile of absolute values
    inputBinding:
      prefix: -P
      position: 17
  cog_voxels:
    type: ['null', boolean]
    label: Output center of gravity in voxel coordinates
    inputBinding:
      prefix: -c
      position: 18
  cog_mm:
    type: ['null', boolean]
    label: Output center of gravity in mm coordinates
    inputBinding:
      prefix: -C
      position: 19
  lower_threshold:
    type: ['null', double]
    label: Set lower threshold
    inputBinding:
      prefix: -l
      position: 20
  upper_threshold:
    type: ['null', double]
    label: Set upper threshold
    inputBinding:
      prefix: -u
      position: 21

outputs:
  stats_output:
    type: File
    outputBinding:
      glob: fslstats_output.txt
  log:
    type: File
    outputBinding:
      glob: fslstats.log
