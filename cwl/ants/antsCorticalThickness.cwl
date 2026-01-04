#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsCorticalThickness.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsCorticalThickness.sh'

hints:
  DockerRequirement:
    dockerPull: antsx/ants:latest

stdout: antsCorticalThickness.log
stderr: antsCorticalThickness.log

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
    label: Brain extraction template (with skull)
    inputBinding: {prefix: -e}
  brain_probability_mask:
    type: File
    label: Brain probability mask for template
    inputBinding: {prefix: -m}
  segmentation_priors:
    type: string
    label: Segmentation priors pattern (e.g., priors%d.nii.gz)
    inputBinding: {prefix: -p}
  output_prefix:
    type: string
    label: Output prefix
    inputBinding: {prefix: -o}

  # Optional parameters
  template_transform_prefix:
    type: ['null', string]
    label: Transform prefix to template space
    inputBinding: {prefix: -t}
  registration_mask:
    type: ['null', File]
    label: Registration mask for template
    inputBinding: {prefix: -f}
  extraction_registration_mask:
    type: ['null', File]
    label: Mask for brain extraction registration
    inputBinding: {prefix: -x}
  quick_registration:
    type: ['null', boolean]
    label: Use quick registration (antsRegistrationSyNQuick.sh)
    inputBinding:
      prefix: -q
      valueFrom: '1'
  run_stage:
    type:
      - 'null'
      - type: enum
        symbols: ['0', '1', '2', '3']
    label: Stage to run (0=all, 1=extraction, 2=registration, 3=segmentation)
    inputBinding: {prefix: -y}
  keep_temporary:
    type: ['null', boolean]
    label: Keep temporary files
    inputBinding:
      prefix: -k
      valueFrom: '1'
  image_suffix:
    type: ['null', string]
    label: Output image file suffix (e.g., nii.gz)
    inputBinding: {prefix: -s}
  additional_thickness_priors:
    type: ['null', string]
    label: Additional classes for thickness (e.g., 4)
    inputBinding: {prefix: -c}
  use_random_seeding:
    type: ['null', boolean]
    label: Use random seeding
    inputBinding:
      prefix: -u
      valueFrom: '1'
  test_mode:
    type: ['null', boolean]
    label: Test/debug mode for faster execution
    inputBinding:
      prefix: -z
      valueFrom: '1'

outputs:
  brain_extraction_mask:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)BrainExtractionMask.nii.gz
  brain_segmentation:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)BrainSegmentation.nii.gz
  cortical_thickness:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)CorticalThickness.nii.gz
  brain_normalized:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)BrainNormalizedToTemplate.nii.gz
  subject_to_template_warp:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)SubjectToTemplate1Warp.nii.gz
  subject_to_template_affine:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)SubjectToTemplate0GenericAffine.mat
  template_to_subject_warp:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)TemplateToSubject0Warp.nii.gz
  template_to_subject_affine:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)TemplateToSubject1GenericAffine.mat
  segmentation_posteriors:
    type: File[]
    outputBinding:
      glob: $(inputs.output_prefix)BrainSegmentationPosteriors*.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsCorticalThickness.log
