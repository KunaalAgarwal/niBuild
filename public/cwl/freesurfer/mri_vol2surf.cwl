#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_vol2surf
# Projects volume data onto cortical surface

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_vol2surf'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:7.4.1

requirements:
  EnvVarRequirement:
    envDef:
      - envName: SUBJECTS_DIR
        envValue: $(inputs.subjects_dir.path)
      - envName: FS_LICENSE
        envValue: $(inputs.fs_license.path)

stdout: mri_vol2surf.log
stderr: mri_vol2surf.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  source_file:
    type: File
    label: Volume to sample from
    inputBinding:
      prefix: --src
      position: 1
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      prefix: --hemi
      position: 2
  output:
    type: string
    label: Output surface file
    inputBinding:
      prefix: --out
      position: 3

  # Registration options (choose one)
  reg_file:
    type: ['null', File]
    label: Registration file (tkregister format)
    inputBinding:
      prefix: --reg
      position: 4
  reg_header:
    type: ['null', string]
    label: Subject name for header registration
    inputBinding:
      prefix: --regheader
      position: 4
  mni152reg:
    type: ['null', boolean]
    label: Use MNI152 registration
    inputBinding:
      prefix: --mni152reg
      position: 4

  # Subject options
  subject:
    type: ['null', string]
    label: Source subject name
    inputBinding:
      prefix: --srcsubject
      position: 5
  trgsubject:
    type: ['null', string]
    label: Target subject (for resampling)
    inputBinding:
      prefix: --trgsubject
      position: 6

  # Sampling options
  projfrac:
    type: ['null', double]
    label: Projection fraction along normal (0=white, 1=pial)
    inputBinding:
      prefix: --projfrac
      position: 7
  projfrac_avg:
    type: ['null', string]
    label: Average along normal (start stop delta)
    inputBinding:
      prefix: --projfrac-avg
      position: 8
  projfrac_max:
    type: ['null', string]
    label: Maximum along normal (start stop delta)
    inputBinding:
      prefix: --projfrac-max
      position: 9
  projdist:
    type: ['null', double]
    label: Projection distance in mm
    inputBinding:
      prefix: --projdist
      position: 10

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [nearest, trilinear]
    label: Interpolation method
    inputBinding:
      prefix: --interp
      position: 11

  # Surface options
  surf:
    type: ['null', string]
    label: Surface name (default white)
    inputBinding:
      prefix: --surf
      position: 12
  surf_file:
    type: ['null', File]
    label: Explicit surface file
    inputBinding:
      prefix: --surfval
      position: 13

  # Mask options
  mask_label:
    type: ['null', File]
    label: Only sample within label
    inputBinding:
      prefix: --mask
      position: 14
  cortex:
    type: ['null', boolean]
    label: Use cortex label as mask
    inputBinding:
      prefix: --cortex
      position: 15

  # Frame options
  frame:
    type: ['null', int]
    label: Only convert this frame
    inputBinding:
      prefix: --frame
      position: 16

  # Output format
  out_type:
    type:
      - 'null'
      - type: enum
        symbols: [mgh, mgz, paint, w, nii, nii.gz]
    label: Output file format
    inputBinding:
      prefix: --out_type
      position: 17

outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mri_vol2surf.log
