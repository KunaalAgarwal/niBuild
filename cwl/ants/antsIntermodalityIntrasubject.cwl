#!/usr/bin/env cwl-runner

# https://github.com/ANTsX/ANTs/blob/master/Scripts/antsIntermodalityIntrasubject.sh

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'antsIntermodalityIntrasubject.sh'

hints:
  DockerRequirement:
    dockerPull: fnndsc/ants:latest

stdout: antsIntermodalityIntrasubject.log
stderr: antsIntermodalityIntrasubject.log

inputs:
  dimensionality:
    type: int
    label: Image dimensionality (2 or 3)
    inputBinding: {prefix: -d}
  input_image:
    type: File
    label: Input scalar image to match (e.g., b0 or pCASL)
    inputBinding: {prefix: -i}
  reference_image:
    type: File
    label: Reference T1 subject brain image
    inputBinding: {prefix: -r}
  output_prefix:
    type: string
    label: Output prefix
    inputBinding: {prefix: -o}

  # Optional parameters
  brain_mask:
    type: ['null', File]
    label: Anatomical T1 brain mask
    inputBinding: {prefix: -x}
  transform_type:
    type:
      - 'null'
      - type: enum
        symbols: ['0', '1', '2', '3']
    label: Transform type (0=rigid, 1=affine, 2=rigid+small_def, 3=affine+small_def)
    inputBinding: {prefix: -t}
  template_prefix:
    type: ['null', string]
    label: Output prefix from prior antsRegistration T1-to-template
    inputBinding: {prefix: -w}
  auxiliary_images:
    type:
      - 'null'
      - type: array
        items: File
    label: Auxiliary scalar images to warp
    inputBinding:
      prefix: -a
      separate: true
  auxiliary_dti:
    type: ['null', File]
    label: Auxiliary DTI image to warp
    inputBinding: {prefix: -b}
  label_image:
    type: ['null', File]
    label: Label image in template space (e.g., AAL atlas)
    inputBinding: {prefix: -l}

outputs:
  warped_image:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)anatomical.nii.gz
  affine_transform:
    type: File
    outputBinding:
      glob: $(inputs.output_prefix)0GenericAffine.mat
  warp_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)1Warp.nii.gz
  inverse_warp_field:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_prefix)1InverseWarp.nii.gz
  log:
    type: File
    outputBinding:
      glob: antsIntermodalityIntrasubject.log
