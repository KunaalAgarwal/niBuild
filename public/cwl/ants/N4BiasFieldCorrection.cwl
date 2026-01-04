#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/wiki/N4BiasFieldCorrection

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'N4BiasFieldCorrection'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: N4BiasFieldCorrection.log
stderr: N4BiasFieldCorrection.log

inputs:
  input_image:
    type: File
    label: Input image for bias correction
    inputBinding: {prefix: -i}
  output_prefix:
    type: string
    label: Output image prefix
    inputBinding:
      prefix: -o
      valueFrom: $(self)_corrected.nii.gz
  dimensionality:
    type: ['null', int]
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {prefix: -d}

  # Optional parameters
  mask_image:
    type: ['null', File]
    label: Binary mask to restrict correction region
    inputBinding: {prefix: -x}
  weight_image:
    type: ['null', File]
    label: Weight image for voxel weighting during fitting
    inputBinding: {prefix: -w}
  shrink_factor:
    type: ['null', int]
    label: Shrink factor for faster processing (1-4 typical)
    inputBinding: {prefix: -s}
  convergence:
    type: ['null', string]
    label: Convergence parameters [iterations,threshold] e.g. [50x50x50x50,0.0]
    inputBinding: {prefix: -c}
  bspline_fitting:
    type: ['null', string]
    label: B-spline fitting parameters [splineDistance,splineOrder] e.g. [180,3]
    inputBinding: {prefix: -b}
  histogram_sharpening:
    type: ['null', string]
    label: Histogram sharpening [FWHM,wienerNoise,numBins] e.g. [0.15,0.01,200]
    inputBinding: {prefix: -t}
  rescale_intensities:
    type: ['null', boolean]
    label: Rescale intensities between 0 and 1
    inputBinding: {prefix: -r}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'

outputs:
  corrected_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)_corrected.nii.gz
  bias_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)_biasfield.nii.gz
  log:
    type: File
    outputBinding:
      glob: N4BiasFieldCorrection.log
