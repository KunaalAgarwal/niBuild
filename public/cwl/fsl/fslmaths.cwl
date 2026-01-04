#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/Fslutils
# Mathematical operations on images

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslmaths'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: fslmaths.log
stderr: fslmaths.log

inputs:
  input:
    type: File
    label: Input image
    inputBinding:
      position: 1

  # Common unary operations
  abs:
    type: ['null', boolean]
    label: Absolute value
    inputBinding:
      prefix: -abs
      position: 2
  bin:
    type: ['null', boolean]
    label: Binarize (non-zero -> 1)
    inputBinding:
      prefix: -bin
      position: 2
  binv:
    type: ['null', boolean]
    label: Binarize and invert (zero -> 1, non-zero -> 0)
    inputBinding:
      prefix: -binv
      position: 2
  recip:
    type: ['null', boolean]
    label: Reciprocal (1/x)
    inputBinding:
      prefix: -recip
      position: 2
  sqrt:
    type: ['null', boolean]
    label: Square root
    inputBinding:
      prefix: -sqrt
      position: 2
  sqr:
    type: ['null', boolean]
    label: Square
    inputBinding:
      prefix: -sqr
      position: 2
  exp:
    type: ['null', boolean]
    label: Exponential
    inputBinding:
      prefix: -exp
      position: 2
  log:
    type: ['null', boolean]
    label: Natural logarithm
    inputBinding:
      prefix: -log
      position: 2
  nan:
    type: ['null', boolean]
    label: Replace NaN with 0
    inputBinding:
      prefix: -nan
      position: 2
  nanm:
    type: ['null', boolean]
    label: Make NaN mask (1 where NaN)
    inputBinding:
      prefix: -nanm
      position: 2
  fillh:
    type: ['null', boolean]
    label: Fill holes in binary mask
    inputBinding:
      prefix: -fillh
      position: 2
  fillh26:
    type: ['null', boolean]
    label: Fill holes using 26-connectivity
    inputBinding:
      prefix: -fillh26
      position: 2
  edge:
    type: ['null', boolean]
    label: Edge detection
    inputBinding:
      prefix: -edge
      position: 2

  # Binary operations with value
  add_value:
    type: ['null', double]
    label: Add value to all voxels
    inputBinding:
      prefix: -add
      position: 3
  sub_value:
    type: ['null', double]
    label: Subtract value from all voxels
    inputBinding:
      prefix: -sub
      position: 3
  mul_value:
    type: ['null', double]
    label: Multiply all voxels by value
    inputBinding:
      prefix: -mul
      position: 3
  div_value:
    type: ['null', double]
    label: Divide all voxels by value
    inputBinding:
      prefix: -div
      position: 3
  rem_value:
    type: ['null', double]
    label: Remainder after dividing by value
    inputBinding:
      prefix: -rem
      position: 3
  thr:
    type: ['null', double]
    label: Threshold below (set to 0)
    inputBinding:
      prefix: -thr
      position: 3
  thrp:
    type: ['null', double]
    label: Threshold below percentage of robust range
    inputBinding:
      prefix: -thrp
      position: 3
  thrP:
    type: ['null', double]
    label: Threshold below percentage of non-zero voxels
    inputBinding:
      prefix: -thrP
      position: 3
  uthr:
    type: ['null', double]
    label: Upper threshold (set to 0 if above)
    inputBinding:
      prefix: -uthr
      position: 3
  uthrp:
    type: ['null', double]
    label: Upper threshold percentage of robust range
    inputBinding:
      prefix: -uthrp
      position: 3
  uthrP:
    type: ['null', double]
    label: Upper threshold percentage of non-zero voxels
    inputBinding:
      prefix: -uthrP
      position: 3

  # Binary operations with image
  add_file:
    type: ['null', File]
    label: Add image
    inputBinding:
      prefix: -add
      position: 4
  sub_file:
    type: ['null', File]
    label: Subtract image
    inputBinding:
      prefix: -sub
      position: 4
  mul_file:
    type: ['null', File]
    label: Multiply by image
    inputBinding:
      prefix: -mul
      position: 4
  div_file:
    type: ['null', File]
    label: Divide by image
    inputBinding:
      prefix: -div
      position: 4
  mas:
    type: ['null', File]
    label: Apply mask (zero outside mask)
    inputBinding:
      prefix: -mas
      position: 4
  max_file:
    type: ['null', File]
    label: Take maximum with image
    inputBinding:
      prefix: -max
      position: 4
  min_file:
    type: ['null', File]
    label: Take minimum with image
    inputBinding:
      prefix: -min
      position: 4

  # Spatial filtering
  s:
    type: ['null', double]
    label: Gaussian smoothing (sigma in mm)
    inputBinding:
      prefix: -s
      position: 5
  kernel_type:
    type:
      - 'null'
      - type: enum
        symbols: [3D, 2D, box, boxv, boxv3, gauss, sphere, file]
    label: Kernel type for morphological operations
    inputBinding:
      prefix: -kernel
      position: 5
  kernel_size:
    type: ['null', double]
    label: Kernel size parameter
    inputBinding:
      position: 6
  dilM:
    type: ['null', boolean]
    label: Mean dilation
    inputBinding:
      prefix: -dilM
      position: 7
  dilD:
    type: ['null', boolean]
    label: Modal dilation
    inputBinding:
      prefix: -dilD
      position: 7
  dilF:
    type: ['null', boolean]
    label: Full dilation (non-zero -> max)
    inputBinding:
      prefix: -dilF
      position: 7
  dilall:
    type: ['null', boolean]
    label: Dilate all voxels
    inputBinding:
      prefix: -dilall
      position: 7
  ero:
    type: ['null', boolean]
    label: Erosion (min)
    inputBinding:
      prefix: -ero
      position: 7
  eroF:
    type: ['null', boolean]
    label: Erosion with filter
    inputBinding:
      prefix: -eroF
      position: 7
  fmedian:
    type: ['null', boolean]
    label: Median filter
    inputBinding:
      prefix: -fmedian
      position: 7
  fmean:
    type: ['null', boolean]
    label: Mean filter
    inputBinding:
      prefix: -fmean
      position: 7
  fmeanu:
    type: ['null', boolean]
    label: Mean filter using non-zero neighbors only
    inputBinding:
      prefix: -fmeanu
      position: 7

  # Temporal operations
  Tmean:
    type: ['null', boolean]
    label: Mean across time
    inputBinding:
      prefix: -Tmean
      position: 8
  Tstd:
    type: ['null', boolean]
    label: Standard deviation across time
    inputBinding:
      prefix: -Tstd
      position: 8
  Tmax:
    type: ['null', boolean]
    label: Maximum across time
    inputBinding:
      prefix: -Tmax
      position: 8
  Tmaxn:
    type: ['null', boolean]
    label: Time index of maximum
    inputBinding:
      prefix: -Tmaxn
      position: 8
  Tmin:
    type: ['null', boolean]
    label: Minimum across time
    inputBinding:
      prefix: -Tmin
      position: 8
  Tmedian:
    type: ['null', boolean]
    label: Median across time
    inputBinding:
      prefix: -Tmedian
      position: 8
  Tar1:
    type: ['null', boolean]
    label: AR(1) coefficient across time
    inputBinding:
      prefix: -Tar1
      position: 8
  bptf:
    type: ['null', string]
    label: Bandpass temporal filter (hp_sigma lp_sigma in volumes)
    inputBinding:
      prefix: -bptf
      position: 8

  # Output data type
  odt:
    type:
      - 'null'
      - type: enum
        symbols: [char, short, int, float, double, input]
    label: Output data type
    inputBinding:
      prefix: -odt
      position: 98

  output:
    type: string
    label: Output filename
    inputBinding:
      position: 99

outputs:
  output_image:
    type: File
    outputBinding:
      glob:
        - $(inputs.output).nii.gz
        - $(inputs.output).nii
        - $(inputs.output)
  log:
    type: File
    outputBinding:
      glob: fslmaths.log
