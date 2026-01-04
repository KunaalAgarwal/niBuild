#!/usr/bin/env cwl-runner

# https://manpag.es/debian-unstable/1+LabelGeometryMeasures

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'LabelGeometryMeasures'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: LabelGeometryMeasures.log
stderr: LabelGeometryMeasures.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {position: 1}
  label_image:
    type: File
    label: Input label/segmentation image
    inputBinding: {position: 2}
  intensity_image:
    type: ['null', File]
    label: Intensity image for weighted measures (use 'none' to skip)
    inputBinding: {position: 3}
  output_csv:
    type: ['null', string]
    label: Output CSV file for measurements
    inputBinding: {position: 4}

outputs:
  csv_output:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_csv)
  log:
    type: File
    outputBinding:
      glob: LabelGeometryMeasures.log
