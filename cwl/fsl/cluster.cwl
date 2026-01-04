#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/docs/statistics/cluster.html
# Form clusters, report information and perform cluster-based inference

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'cluster'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: cluster_table.txt
stderr: cluster.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input statistical image (e.g., z-stat)
    inputBinding:
      prefix: --in
      position: 1
  threshold:
    type: double
    label: Threshold value for cluster formation
    inputBinding:
      prefix: --thresh
      position: 2

  # Output options
  oindex:
    type: ['null', string]
    label: Output cluster index image filename
    inputBinding:
      prefix: --oindex
      position: 3
  othresh:
    type: ['null', string]
    label: Output thresholded image filename
    inputBinding:
      prefix: --othresh
      position: 4
  olmax:
    type: ['null', string]
    label: Output local maxima text file
    inputBinding:
      prefix: --olmax
      position: 5
  olmaxim:
    type: ['null', string]
    label: Output local maxima image filename
    inputBinding:
      prefix: --olmaxim
      position: 6
  osize:
    type: ['null', string]
    label: Output cluster size image filename
    inputBinding:
      prefix: --osize
      position: 7
  omax:
    type: ['null', string]
    label: Output max intensity image filename
    inputBinding:
      prefix: --omax
      position: 8
  omean:
    type: ['null', string]
    label: Output mean intensity image filename
    inputBinding:
      prefix: --omean
      position: 9
  opvals:
    type: ['null', string]
    label: Output log p-values image filename
    inputBinding:
      prefix: --opvals
      position: 10

  # Statistical options
  pthresh:
    type: ['null', double]
    label: P-threshold for clusters
    inputBinding:
      prefix: --pthresh
      position: 11
  dlh:
    type: ['null', double]
    label: Smoothness estimate (sqrt determinant of Lambda)
    inputBinding:
      prefix: --dlh
      position: 12
  volume:
    type: ['null', int]
    label: Number of voxels in mask
    inputBinding:
      prefix: --volume
      position: 13
  cope:
    type: ['null', File]
    label: COPE image for effect size reporting
    inputBinding:
      prefix: --cope
      position: 14

  # Processing options
  peakdist:
    type: ['null', double]
    label: Minimum distance between peaks in mm
    inputBinding:
      prefix: --peakdist
      position: 15
  connectivity:
    type: ['null', int]
    label: Voxel connectivity (6, 18, or 26)
    inputBinding:
      prefix: --connectivity
      position: 16
  fractional:
    type: ['null', boolean]
    label: Interpret threshold as fraction of robust range
    inputBinding:
      prefix: --fractional
      position: 17
  mm:
    type: ['null', boolean]
    label: Use mm coordinates instead of voxel
    inputBinding:
      prefix: --mm
      position: 18
  find_minima:
    type: ['null', boolean]
    label: Find minima instead of maxima
    inputBinding:
      prefix: --min
      position: 19
  num_maxima:
    type: ['null', int]
    label: Number of local maxima to report
    inputBinding:
      prefix: --num
      position: 20

  # Registration options
  xfm:
    type: ['null', File]
    label: Linear transformation matrix file
    inputBinding:
      prefix: --xfm
      position: 21
  stdvol:
    type: ['null', File]
    label: Standard space volume for coordinate transformation
    inputBinding:
      prefix: --stdvol
      position: 22
  warpvol:
    type: ['null', File]
    label: Warp field for non-linear transformation
    inputBinding:
      prefix: --warpvol
      position: 23

  # Reporting options
  minclustersize:
    type: ['null', boolean]
    label: Print minimum significant cluster size
    inputBinding:
      prefix: --minclustersize
      position: 24
  no_table:
    type: ['null', boolean]
    label: Suppress printing of cluster table
    inputBinding:
      prefix: --no_table
      position: 25
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: --verbose
      position: 26

outputs:
  cluster_table:
    type: File
    outputBinding:
      glob: cluster_table.txt
  cluster_index:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.oindex).nii.gz
        - $(inputs.oindex).nii
  thresholded_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.othresh).nii.gz
        - $(inputs.othresh).nii
  local_maxima_txt:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.olmax)
  local_maxima_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.olmaxim).nii.gz
        - $(inputs.olmaxim).nii
  size_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.osize).nii.gz
        - $(inputs.osize).nii
  max_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.omax).nii.gz
        - $(inputs.omax).nii
  mean_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.omean).nii.gz
        - $(inputs.omean).nii
  pvals_image:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.opvals).nii.gz
        - $(inputs.opvals).nii
  log:
    type: File
    outputBinding:
      glob: cluster.log
