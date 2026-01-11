#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsBrainExtraction.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsBrainExtraction.sh'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

stdout: antsBrainExtraction.log
stderr: antsBrainExtraction.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  anatomical_image:
    type: File
    label: Input anatomical T1 image
    inputBinding: {prefix: -a}
  template:
    type: File
    label: Brain extraction template (head with skull)
    inputBinding: {prefix: -e}
  brain_probability_mask:
    type: File
    label: Brain probability mask for template
    inputBinding: {prefix: -m}
  output_prefix:
    type: string
    label: Output prefix
    inputBinding: {prefix: -o}

  # Optional parameters
  registration_mask:
    type: ['null', File]
    label: Registration mask for template
    inputBinding: {prefix: -f}
  keep_temporary_files:
    type: ['null', boolean]
    label: Keep temporary files
    inputBinding:
      prefix: -k
      valueFrom: '1'
  image_suffix:
    type: ['null', string]
    label: Output image file suffix (e.g., nii.gz)
    inputBinding: {prefix: -s}
  rotation_search:
    type: ['null', string]
    label: Rotation search parameters (step,arcFraction)
    inputBinding: {prefix: -R}
  translation_search:
    type: ['null', string]
    label: Translation search parameters (step,range)
    inputBinding: {prefix: -T}
  use_floatingpoint:
    type: ['null', boolean]
    label: Use single floating point precision
    inputBinding:
      prefix: -q
      valueFrom: '1'
  use_random_seeding:
    type: ['null', boolean]
    label: Use random seeding
    inputBinding:
      prefix: -u
      valueFrom: '1'

outputs:
  brain_extracted:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)BrainExtractionBrain.nii.gz
  brain_mask:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)BrainExtractionMask.nii.gz
  brain_n4:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)BrainExtractionBrain_N4.nii.gz
  registration_template:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)BrainExtractionPrior*Warped.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsBrainExtraction.log
