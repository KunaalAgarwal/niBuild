#!/usr/bin/env cwl-runner

# https://manpages.ubuntu.com/manpages/trusty/man1/ThresholdImage.1.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'ThresholdImage'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: ThresholdImage.log
stderr: ThresholdImage.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {position: 1}
  input_image:
    type: File
    label: Input image to threshold
    inputBinding: {position: 2}
  output_image:
    type: string
    label: Output thresholded image filename
    inputBinding: {position: 3}

  # Thresholding mode - either simple threshold or Otsu/Kmeans
  threshold_mode:
    type:
      - 'null'
      - type: enum
        symbols: [Otsu, Kmeans]
    label: Automatic thresholding mode
    inputBinding: {position: 4}
  num_thresholds:
    type: ['null', int]
    label: Number of thresholds for Otsu/Kmeans
    inputBinding: {position: 5}
  mask_image:
    type: ['null', File]
    label: Mask image for Otsu/Kmeans thresholding
    inputBinding: {position: 6}

  # Simple threshold parameters (alternative to threshold_mode)
  threshold_low:
    type: ['null', double]
    label: Lower threshold value
    inputBinding: {position: 4}
  threshold_high:
    type: ['null', double]
    label: Upper threshold value (use inf for no upper bound)
    inputBinding: {position: 5}
  inside_value:
    type: ['null', double]
    label: Value for voxels inside threshold range (default 1)
    inputBinding: {position: 6}
  outside_value:
    type: ['null', double]
    label: Value for voxels outside threshold range (default 0)
    inputBinding: {position: 7}

outputs:
  thresholded:
    type: File
    outputBinding:
      glob: $(inputs.output_image)
  log:
    type: File
    outputBinding:
      glob: ThresholdImage.log
