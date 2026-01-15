#!/usr/bin/env cwl-runner

# https://manpages.debian.org/testing/ants/ImageMath.1.en.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'ImageMath'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

stdout: ImageMath.log
stderr: ImageMath.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2, 3, or 4)
    inputBinding: {position: 1}
  output_image:
    type: string
    label: Output image filename
    inputBinding: {position: 2}
  operation:
    type: string
    label: Operation to perform (m, +, -, /, G, MD, ME, MO, MC, etc.)
    inputBinding: {position: 3}
  input_image:
    type: File
    label: First input image
    inputBinding: {position: 4}

  # Optional second operand (image or value)
  second_input:
    type: ['null', File]
    label: Second input image for binary operations
    inputBinding: {position: 5}
  scalar_value:
    type: ['null', double]
    label: Scalar value for operations (alternative to second image)
    inputBinding: {position: 5}

outputs:
  output:
    type: File
    outputBinding:
      glob: $(inputs.output_image)
  log:
    type: File
    outputBinding:
      glob: ImageMath.log
