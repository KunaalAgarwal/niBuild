#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mri_surf2vol
# Projects surface data back to volume

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mri_surf2vol'

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

stdout: mri_surf2vol.log
stderr: mri_surf2vol.log

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
    label: Surface values file
    inputBinding:
      prefix: --surfval
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
    label: Output volume filename
    inputBinding:
      prefix: --o
      position: 3

  # Registration options
  reg:
    type: ['null', File]
    label: Registration file
    inputBinding:
      prefix: --reg
      position: 4
  identity:
    type: ['null', string]
    label: Subject for identity registration
    inputBinding:
      prefix: --identity
      position: 5

  # Template options
  template:
    type: ['null', File]
    label: Template volume for output geometry
    inputBinding:
      prefix: --template
      position: 6
  subject:
    type: ['null', string]
    label: Subject name
    inputBinding:
      prefix: --subject
      position: 7

  # Surface options
  surf:
    type: ['null', string]
    label: Surface name (default white)
    inputBinding:
      prefix: --surf
      position: 8
  mkmask:
    type: ['null', boolean]
    label: Create mask volume
    inputBinding:
      prefix: --mkmask
      position: 9

  # Projection options
  projfrac:
    type: ['null', double]
    label: Projection fraction along normal
    inputBinding:
      prefix: --projfrac
      position: 10
  projdist:
    type: ['null', string]
    label: Projection distances (min max delta)
    inputBinding:
      prefix: --projdist
      position: 11
  fill_projfrac:
    type: ['null', string]
    label: Fill between projection fractions (start stop delta)
    inputBinding:
      prefix: --fill-projfrac
      position: 12

  # Ribbon options
  fillribbon:
    type: ['null', boolean]
    label: Fill entire cortical ribbon
    inputBinding:
      prefix: --fillribbon
      position: 13
  ribbon:
    type: ['null', File]
    label: Ribbon volume file
    inputBinding:
      prefix: --ribbon
      position: 14

  # Merge options
  merge:
    type: ['null', File]
    label: Merge with existing volume
    inputBinding:
      prefix: --merge
      position: 15
  add:
    type: ['null', boolean]
    label: Add to merged volume
    inputBinding:
      prefix: --add
      position: 16

  # Other options
  vtxvol:
    type: ['null', boolean]
    label: Create vertex volume
    inputBinding:
      prefix: --vtxvol
      position: 17

outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mri_surf2vol.log
