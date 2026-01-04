#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_convert
# General purpose format conversion utility

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_convert'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mri_convert.log
stderr: mri_convert.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input volume file
    inputBinding:
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      position: 2

  # Format options
  in_type:
    type: ['null', string]
    label: Input file format (cor, mgh, mgz, minc, analyze, nifti1, nii)
    inputBinding:
      prefix: --in_type
  out_type:
    type: ['null', string]
    label: Output file format (cor, mgh, mgz, minc, analyze, nifti1, nii)
    inputBinding:
      prefix: --out_type

  # Conforming options
  conform:
    type: ['null', boolean]
    label: Conform to 1mm voxel size in coronal slices
    inputBinding:
      prefix: --conform
  conform_min:
    type: ['null', boolean]
    label: Conform to minimum voxel direction size
    inputBinding:
      prefix: --conform_min
  conform_size:
    type: ['null', double]
    label: Conform to specified voxel size in mm
    inputBinding:
      prefix: --conform_size

  # Voxel size options
  vox_size:
    type: ['null', string]
    label: Output voxel size (x y z) in mm
    inputBinding:
      prefix: --voxsize

  # Orientation options
  out_orientation:
    type: ['null', string]
    label: Output orientation (e.g., RAS, LPS)
    inputBinding:
      prefix: --out_orientation
  in_orientation:
    type: ['null', string]
    label: Input orientation (e.g., RAS, LPS)
    inputBinding:
      prefix: --in_orientation

  # Resampling options
  resample_type:
    type:
      - 'null'
      - type: enum
        symbols: [interpolate, weighted, nearest, sinc, cubic]
    label: Interpolation method
    inputBinding:
      prefix: --resample_type
  reslice_like:
    type: ['null', File]
    label: Reslice to match template geometry
    inputBinding:
      prefix: --reslice_like

  # Transform options
  apply_transform:
    type: ['null', File]
    label: Apply transformation (xfm or m3z)
    inputBinding:
      prefix: --apply_transform
  apply_inverse_transform:
    type: ['null', File]
    label: Apply inverse transformation
    inputBinding:
      prefix: --apply_inverse_transform

  # Cropping options
  crop:
    type: ['null', string]
    label: Crop to 256 around center (x y z)
    inputBinding:
      prefix: --crop
  cropsize:
    type: ['null', string]
    label: Crop to specified size (dx dy dz)
    inputBinding:
      prefix: --cropsize

  # Frame options
  frame:
    type: ['null', int]
    label: Keep specified 0-based frame number
    inputBinding:
      prefix: --frame
  mid_frame:
    type: ['null', boolean]
    label: Keep only middle frame
    inputBinding:
      prefix: --mid-frame
  nskip:
    type: ['null', int]
    label: Skip first n frames
    inputBinding:
      prefix: --nskip
  ndrop:
    type: ['null', int]
    label: Drop last n frames
    inputBinding:
      prefix: --ndrop

  # Data type
  out_data_type:
    type:
      - 'null'
      - type: enum
        symbols: [uchar, short, int, float]
    label: Output data type
    inputBinding:
      prefix: --out_data_type

  # Smoothing
  fwhm:
    type: ['null', double]
    label: Smooth input volume by FWHM in mm
    inputBinding:
      prefix: --fwhm

  # Other options
  no_scale:
    type: ['null', boolean]
    label: Do not rescale values for COR
    inputBinding:
      prefix: --no_scale
  force_ras:
    type: ['null', boolean]
    label: Use default when orientation info absent
    inputBinding:
      prefix: --force_ras_good
  split:
    type: ['null', boolean]
    label: Split output frames into separate files
    inputBinding:
      prefix: --split
  ascii:
    type: ['null', boolean]
    label: Save output as ASCII
    inputBinding:
      prefix: --ascii
  read_only:
    type: ['null', boolean]
    label: Read-only mode (no output written)
    inputBinding:
      prefix: --read_only

outputs:
  converted:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mri_convert.log
