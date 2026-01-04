#!/usr/bin/env cwl-runner

# https://manpages.ubuntu.com/manpages/trusty/man1/Atropos.1.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'Atropos'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: Atropos.log
stderr: Atropos.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {prefix: -d}
  intensity_image:
    type: File
    label: Input intensity image for segmentation
    inputBinding: {prefix: -a}
  mask_image:
    type: File
    label: Mask image defining segmentation region
    inputBinding: {prefix: -x}
  output_prefix:
    type: string
    label: Output segmentation filename
    inputBinding: {prefix: -o}

  # Initialization method
  initialization:
    type: string
    label: Initialization method (e.g., kmeans[3], otsu[3], priorProbabilityImages[...])
    inputBinding: {prefix: -i}

  # Optional parameters
  likelihood_model:
    type:
      - 'null'
      - type: enum
        symbols: [Gaussian, HistogramParzenWindows, ManifoldParzenWindows, LogEuclideanGaussian]
    label: Likelihood model for intensity estimation
    inputBinding: {prefix: -k}
  mrf:
    type: ['null', string]
    label: MRF parameters [smoothingFactor,radius] e.g., [0.3,1x1x1]
    inputBinding: {prefix: -m}
  convergence:
    type: ['null', string]
    label: Convergence parameters [iterations,threshold] e.g., [5,0.001]
    inputBinding: {prefix: -c}
  prior_weighting:
    type: ['null', double]
    label: Prior probability weight (0-1)
    inputBinding: {prefix: -w}
  use_euclidean_distance:
    type: ['null', boolean]
    label: Use Euclidean distance for label propagation
    inputBinding:
      prefix: -e
      valueFrom: '1'
  posterior_formulation:
    type: ['null', string]
    label: Posterior formulation (e.g., Socrates[1])
    inputBinding: {prefix: -p}
  winsorize_outliers:
    type: ['null', string]
    label: Outlier handling method (e.g., BoxPlot[0.25,0.75,1.5])
    inputBinding: {prefix: --winsorize-outliers}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding: {prefix: --verbose}

outputs:
  segmentation:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)
  posteriors:
    type: File[]
    outputBinding:
      glob: $(inputs.output_prefix)*Posteriors*.nii.gz
  log:
    type: File
    outputBinding:
      glob: Atropos.log
