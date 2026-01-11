#!/usr/bin/env cwl-runner

# https://antsx.github.io/ANTsR/reference/kellyKapowski.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'KellyKapowski'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

stdout: KellyKapowski.log
stderr: KellyKapowski.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  segmentation_image:
    type: File
    label: Segmentation image with labeled tissues
    inputBinding: {prefix: -s}
  gray_matter_prob:
    type: File
    label: Gray matter probability image
    inputBinding: {prefix: -g}
  white_matter_prob:
    type: File
    label: White matter probability image
    inputBinding: {prefix: -w}
  output_image:
    type: string
    label: Output cortical thickness image
    inputBinding: {prefix: -o}

  # Optional parameters
  convergence:
    type: ['null', string]
    label: Convergence parameters [iterations,convergenceThreshold,thicknessPrior]
    inputBinding: {prefix: -c}
  thickness_prior:
    type: ['null', double]
    label: Prior estimate for cortical thickness
    inputBinding: {prefix: -t}
  gradient_step:
    type: ['null', double]
    label: Gradient descent step size
    inputBinding: {prefix: -r}
  smoothing_sigma:
    type: ['null', double]
    label: Gradient field smoothing parameter
    inputBinding: {prefix: -m}
  number_integration_points:
    type: ['null', int]
    label: Number of integration points
    inputBinding: {prefix: -n}
  verbose:
    type: ['null', boolean]
    label: Enable verbose output
    inputBinding:
      prefix: -v
      valueFrom: '1'

outputs:
  thickness_image:
    type: File
    outputBinding:
      glob: $(inputs.output_image)
  log:
    type: File
    outputBinding:
      glob: KellyKapowski.log
