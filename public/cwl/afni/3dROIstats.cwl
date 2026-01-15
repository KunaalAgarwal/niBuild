#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dROIstats.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dROIstats'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

stdout: $(inputs.input.nameroot)_roistats.txt
stderr: 3dROIstats.log

inputs:
  input:
    type: File
    label: Input dataset
    inputBinding: {position: 100}
  mask:
    type: File
    label: Mask dataset with ROI labels
    inputBinding: {prefix: -mask}

  # Mask options
  mask_f2short:
    type: ['null', boolean]
    label: Convert float mask to short integers
    inputBinding: {prefix: -mask_f2short}
  numROI:
    type: ['null', int]
    label: Assume ROIs numbered 1 to n
    inputBinding: {prefix: -numROI}
  zerofill:
    type: ['null', string]
    label: Fill missing ROIs with value
    inputBinding: {prefix: -zerofill}
  roisel:
    type: ['null', File]
    label: Consider only ROIs listed in selection file
    inputBinding: {prefix: -roisel}

  # Statistics options
  nzmean:
    type: ['null', boolean]
    label: Mean of non-zero voxels only
    inputBinding: {prefix: -nzmean}
  nzsum:
    type: ['null', boolean]
    label: Sum of non-zero voxels
    inputBinding: {prefix: -nzsum}
  nzvoxels:
    type: ['null', boolean]
    label: Count non-zero voxels
    inputBinding: {prefix: -nzvoxels}
  nzvolume:
    type: ['null', boolean]
    label: Volume of non-zero voxels
    inputBinding: {prefix: -nzvolume}
  minmax:
    type: ['null', boolean]
    label: Min/max across all voxels
    inputBinding: {prefix: -minmax}
  nzminmax:
    type: ['null', boolean]
    label: Min/max of non-zero voxels
    inputBinding: {prefix: -nzminmax}
  sigma:
    type: ['null', boolean]
    label: Standard deviation (all voxels)
    inputBinding: {prefix: -sigma}
  nzsigma:
    type: ['null', boolean]
    label: Standard deviation (non-zero voxels)
    inputBinding: {prefix: -nzsigma}
  median:
    type: ['null', boolean]
    label: Median (all voxels)
    inputBinding: {prefix: -median}
  nzmedian:
    type: ['null', boolean]
    label: Median (non-zero voxels)
    inputBinding: {prefix: -nzmedian}
  summary:
    type: ['null', boolean]
    label: Output grand mean only
    inputBinding: {prefix: -summary}
  mode:
    type: ['null', boolean]
    label: Mode calculation
    inputBinding: {prefix: -mode}
  key:
    type: ['null', boolean]
    label: Output integer ROI identifier
    inputBinding: {prefix: -key}

  # Output format options
  quiet:
    type: ['null', boolean]
    label: Suppress column/row labels
    inputBinding: {prefix: -quiet}
  nomeanout:
    type: ['null', boolean]
    label: Exclude mean column from output
    inputBinding: {prefix: -nomeanout}
  oneDformat:
    type: ['null', boolean]
    label: Output as 1D format with commented labels
    inputBinding: {prefix: -1Dformat}
  oneDRformat:
    type: ['null', boolean]
    label: Output as 1D format R-compatible
    inputBinding: {prefix: -1DRformat}

outputs:
  stats:
    type: stdout
  log:
    type: File
    outputBinding:
      glob: 3dROIstats.log
