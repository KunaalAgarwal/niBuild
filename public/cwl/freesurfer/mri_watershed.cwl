#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_watershed
# Skull stripping using watershed algorithm

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_watershed'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_watershed.log
stderr: mri_watershed.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input T1 volume
    inputBinding:
      position: 50
  output:
    type: string
    label: Output brain volume filename
    inputBinding:
      position: 51

  # Atlas options
  atlas:
    type: ['null', boolean]
    label: Apply atlas correction to segmentation
    inputBinding:
      prefix: -atlas
      position: 1
  brain_atlas:
    type: ['null', File]
    label: Atlas reference file
    inputBinding:
      prefix: -brain_atlas
      position: 2

  # Watershed parameters
  preflooding_height:
    type: ['null', int]
    label: Preflooding height in percent
    inputBinding:
      prefix: -h
      position: 3
  watershed_weight:
    type: ['null', double]
    label: Preweight using atlas information
    inputBinding:
      prefix: -w
      position: 4
  basin_merge:
    type: ['null', double]
    label: Basin merging using atlas information
    inputBinding:
      prefix: -b
      position: 5

  # Threshold adjustments
  less:
    type: ['null', boolean]
    label: Shrink the surface (leaves less skull)
    inputBinding:
      prefix: -less
      position: 6
  more:
    type: ['null', boolean]
    label: Expand the surface (leaves more skull)
    inputBinding:
      prefix: -more
      position: 7
  threshold:
    type: ['null', int]
    label: Adjust watershed threshold
    inputBinding:
      prefix: -t
      position: 8

  # Seed point options
  seed:
    type: ['null', string]
    label: Add seed point coordinates (x y z)
    inputBinding:
      prefix: -s
      position: 9
  center:
    type: ['null', string]
    label: Brain center in voxels (x y z)
    inputBinding:
      prefix: -c
      position: 10
  radius:
    type: ['null', int]
    label: Brain radius in voxels
    inputBinding:
      prefix: -r
      position: 11

  # Processing options
  t1:
    type: ['null', boolean]
    label: Specify T1 input (grey value ~110)
    inputBinding:
      prefix: -T1
      position: 12
  no_seedpt:
    type: ['null', boolean]
    label: Disable seed points from atlas
    inputBinding:
      prefix: -no_seedpt
      position: 13
  no_wta:
    type: ['null', boolean]
    label: Disable preweighting for template deformation
    inputBinding:
      prefix: -no_wta
      position: 14
  no_ta:
    type: ['null', boolean]
    label: Disable template deformation using atlas
    inputBinding:
      prefix: -no-ta
      position: 15

  # Surface options
  surf:
    type: ['null', string]
    label: Save BEM surfaces to directory
    inputBinding:
      prefix: -surf
      position: 16
  brainsurf:
    type: ['null', string]
    label: Save brain surface filename
    inputBinding:
      prefix: -brainsurf
      position: 17
  useSRAS:
    type: ['null', boolean]
    label: Use surface RAS instead of scanner RAS
    inputBinding:
      prefix: -useSRAS
      position: 18

  # Other options
  watershed_only:
    type: ['null', boolean]
    label: Use watershed algorithm only
    inputBinding:
      prefix: -wat
      position: 19
  noT1:
    type: ['null', boolean]
    label: Skip T1 analysis to conserve memory
    inputBinding:
      prefix: -noT1
      position: 20
  mask:
    type: ['null', boolean]
    label: Mask volume with brain mask
    inputBinding:
      prefix: -mask
      position: 21
  label:
    type: ['null', boolean]
    label: Label output into anatomical structures
    inputBinding:
      prefix: -LABEL
      position: 22

outputs:
  brain:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  bem_surfaces:
    type: ['null', Directory]
    outputBinding:
      glob: $(inputs.surf)
  log:
    type: File
    outputBinding:
      glob: mri_watershed.log
