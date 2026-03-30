#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/docs/#/utilities/fslmaths
# Mathematical operations on images

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'fslmaths'

requirements:
  ShellCommandRequirement: {}

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

  # Unary operations
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
  sin:
    type: ['null', boolean]
    label: Sine
    inputBinding:
      prefix: -sin
      position: 2
  cos:
    type: ['null', boolean]
    label: Cosine
    inputBinding:
      prefix: -cos
      position: 2
  tan:
    type: ['null', boolean]
    label: Tangent
    inputBinding:
      prefix: -tan
      position: 2
  asin:
    type: ['null', boolean]
    label: Arc sine
    inputBinding:
      prefix: -asin
      position: 2
  acos:
    type: ['null', boolean]
    label: Arc cosine
    inputBinding:
      prefix: -acos
      position: 2
  atan:
    type: ['null', boolean]
    label: Arc tangent
    inputBinding:
      prefix: -atan
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
    label: Edge strength
    inputBinding:
      prefix: -edge
      position: 2
  index:
    type: ['null', boolean]
    label: Replace nonzero voxels with unique index number
    inputBinding:
      prefix: -index
      position: 2
  rand:
    type: ['null', boolean]
    label: Add uniform noise (range 0-1)
    inputBinding:
      prefix: -rand
      position: 2
  randn:
    type: ['null', boolean]
    label: Add Gaussian noise (mean=0 sigma=1)
    inputBinding:
      prefix: -randn
      position: 2
  range:
    type: ['null', boolean]
    label: Set output calmin/max to full data range
    inputBinding:
      prefix: -range
      position: 2
  seed:
    type: ['null', int]
    label: Seed random number generator
    inputBinding:
      prefix: -seed
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
    label: Threshold below percentage of non-zero voxels robust range
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
    label: Upper threshold percentage of non-zero voxels robust range
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
    label: Mean dilation of non-zero voxels
    inputBinding:
      prefix: -dilM
      position: 7
  dilD:
    type: ['null', boolean]
    label: Modal dilation of non-zero voxels
    inputBinding:
      prefix: -dilD
      position: 7
  dilF:
    type: ['null', boolean]
    label: Maximum filtering of all voxels
    inputBinding:
      prefix: -dilF
      position: 7
  dilall:
    type: ['null', boolean]
    label: Apply dilM repeatedly until entire FOV is covered
    inputBinding:
      prefix: -dilall
      position: 7
  ero:
    type: ['null', boolean]
    label: Erode by zeroing non-zero voxels when zero voxels in kernel
    inputBinding:
      prefix: -ero
      position: 7
  eroF:
    type: ['null', boolean]
    label: Minimum filtering of all voxels
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
    label: Mean filter (kernel weighted)
    inputBinding:
      prefix: -fmean
      position: 7
  fmeanu:
    type: ['null', boolean]
    label: Mean filter (kernel weighted, unnormalized)
    inputBinding:
      prefix: -fmeanu
      position: 7
  subsamp2:
    type: ['null', boolean]
    label: Downsample by factor of 2 (centred)
    inputBinding:
      prefix: -subsamp2
      position: 7
  subsamp2offc:
    type: ['null', boolean]
    label: Downsample by factor of 2 (non-centred)
    inputBinding:
      prefix: -subsamp2offc
      position: 7

  # Temporal/dimensional reduction operations
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
  Tperc:
    type: ['null', double]
    label: Nth percentile (0-100) across time
    inputBinding:
      prefix: -Tperc
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
      shellQuote: false

  # Intensity normalization
  inm:
    type: ['null', double]
    label: Intensity normalization (per-volume mean to value)
    inputBinding:
      prefix: -inm
      position: 9
  ing:
    type: ['null', double]
    label: Intensity normalization (global 4D mean to value)
    inputBinding:
      prefix: -ing
      position: 9

  # Statistical conversions
  pval:
    type: ['null', boolean]
    label: Nonparametric uncorrected P-value (null hypothesis of zero)
    inputBinding:
      prefix: -pval
      position: 10
  pval0:
    type: ['null', boolean]
    label: Nonparametric uncorrected P-value (zeros as missing data)
    inputBinding:
      prefix: -pval0
      position: 10
  cpval:
    type: ['null', boolean]
    label: FWE corrected P-value
    inputBinding:
      prefix: -cpval
      position: 10
  ztop:
    type: ['null', boolean]
    label: Convert Z-stat to uncorrected P
    inputBinding:
      prefix: -ztop
      position: 10
  ptoz:
    type: ['null', boolean]
    label: Convert uncorrected P to Z-stat
    inputBinding:
      prefix: -ptoz
      position: 10
  rank:
    type: ['null', boolean]
    label: Rank values (ties are averaged)
    inputBinding:
      prefix: -rank
      position: 10
  ranknorm:
    type: ['null', boolean]
    label: Transform to normal distribution via ranks
    inputBinding:
      prefix: -ranknorm
      position: 10

  # TFCE
  tfce:
    type: ['null', string]
    label: Threshold-Free Cluster Enhancement (H E connectivity)
    inputBinding:
      prefix: -tfce
      position: 11
      shellQuote: false

  # Multi-argument operations
  roi:
    type: ['null', string]
    label: Zero outside ROI (xmin xsize ymin ysize zmin zsize tmin tsize)
    inputBinding:
      prefix: -roi
      position: 3
      shellQuote: false

  # Tensor decomposition
  tensor_decomp:
    type: ['null', boolean]
    label: Convert 4D tensor image to L1 L2 L3 FA MD MO V1 V2 V3
    inputBinding:
      prefix: -tensor_decomp
      position: 12

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
