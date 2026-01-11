#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dAutomask.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dAutomask'

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
    label: Output mask dataset prefix
    inputBinding: {prefix: -prefix}

  # Threshold options
  clfrac:
    type: ['null', double]
    label: Clip level fraction (0.1-0.9, default 0.5)
    inputBinding: {prefix: -clfrac}
  nograd:
    type: ['null', boolean]
    label: Use fixed clip level instead of gradual method
    inputBinding: {prefix: -nograd}

  # Morphological operations
  peels:
    type: ['null', int]
    label: Erode then dilate mask N times to remove thin protrusions (default 1)
    inputBinding: {prefix: -peels}
  dilate:
    type: ['null', int]
    label: Dilate the mask outwards N times
    inputBinding: {prefix: -dilate}
  erode:
    type: ['null', int]
    label: Erode the mask inwards N times
    inputBinding: {prefix: -erode}

  # Neighbor definition (mutually exclusive)
  NN1:
    type: ['null', boolean]
    label: Use face neighbors only (6 neighbors)
    inputBinding: {prefix: -NN1}
  NN2:
    type: ['null', boolean]
    label: Use face and edge neighbors (18 neighbors, default)
    inputBinding: {prefix: -NN2}
  NN3:
    type: ['null', boolean]
    label: Use face, edge, and corner neighbors (26 neighbors)
    inputBinding: {prefix: -NN3}
  nbhrs:
    type: ['null', int]
    label: Number of neighbors needed to not erode (6-26, default 17)
    inputBinding: {prefix: -nbhrs}

  # Additional options
  eclip:
    type: ['null', boolean]
    label: Remove exterior voxels below the clip threshold
    inputBinding: {prefix: -eclip}
  SI:
    type: ['null', double]
    label: Zero out voxels more than N mm inferior to superior voxel
    inputBinding: {prefix: -SI}

  # Apply mask to input
  apply_prefix:
    type: ['null', string]
    label: Apply mask to input and save masked dataset
    inputBinding: {prefix: -apply_prefix}

  # Output options
  depth:
    type: ['null', string]
    label: Produce dataset showing peel operations to reach each voxel
    inputBinding: {prefix: -depth}
  quiet:
    type: ['null', boolean]
    label: Suppress progress messages
    inputBinding: {prefix: -q}

outputs:
  mask:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  masked_input:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.apply_prefix)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  depth_map:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.depth)+orig.HEAD
    secondaryFiles:
      - .BRIK
      - .BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
