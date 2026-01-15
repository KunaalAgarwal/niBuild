#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mris_preproc
# Prepares surface data for group analysis

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mris_preproc'

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

stdout: mris_preproc.log
stderr: mris_preproc.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  output:
    type: string
    label: Output concatenated surface file
    inputBinding:
      prefix: --out
      position: 1
  target:
    type: string
    label: Target subject (e.g., fsaverage)
    inputBinding:
      prefix: --target
      position: 2
  hemi:
    type:
      type: enum
      symbols: [lh, rh]
    label: Hemisphere (lh or rh)
    inputBinding:
      prefix: --hemi
      position: 3

  # Subject input options
  subjects:
    type:
      - 'null'
      - type: array
        items: string
        inputBinding:
          prefix: --s
          position: 4
    label: List of subject names
  fsgd:
    type: ['null', File]
    label: FreeSurfer Group Descriptor file
    inputBinding:
      prefix: --fsgd
      position: 5
  f:
    type: ['null', File]
    label: Text file with list of subjects
    inputBinding:
      prefix: --f
      position: 6

  # Measurement options
  meas:
    type: ['null', string]
    label: Surface measure name (e.g., thickness, area)
    inputBinding:
      prefix: --meas
      position: 7
  area:
    type: ['null', string]
    label: Extract vertex area from surface
    inputBinding:
      prefix: --area
      position: 8

  # Volume input options
  iv:
    type: ['null', 'string[]']
    label: Volume and registration pairs
    inputBinding:
      prefix: --iv
      position: 9
  projfrac:
    type: ['null', double]
    label: Projection fraction for vol2surf (default 0.5)
    inputBinding:
      prefix: --projfrac
      position: 10

  # Smoothing options
  fwhm:
    type: ['null', double]
    label: Smooth on target surface by FWHM in mm
    inputBinding:
      prefix: --fwhm
      position: 11
  fwhm_src:
    type: ['null', double]
    label: Smooth on source surface by FWHM in mm
    inputBinding:
      prefix: --fwhm-src
      position: 12
  niters:
    type: ['null', int]
    label: Smooth by N nearest neighbor iterations
    inputBinding:
      prefix: --niters
      position: 13
  niters_src:
    type: ['null', int]
    label: Smooth source by N iterations
    inputBinding:
      prefix: --niters-src
      position: 14

  # Cache options
  cache_in:
    type: ['null', string]
    label: Use qcache data (e.g., thickness.fwhm10.fsaverage)
    inputBinding:
      prefix: --cache-in
      position: 15

  # Paired analysis options
  paired_diff:
    type: ['null', boolean]
    label: Compute paired differences
    inputBinding:
      prefix: --paired-diff
      position: 16
  paired_diff_norm1:
    type: ['null', boolean]
    label: Paired diff normalized by average
    inputBinding:
      prefix: --paired-diff-norm1
      position: 17
  paired_diff_norm2:
    type: ['null', boolean]
    label: Paired diff normalized by first timepoint
    inputBinding:
      prefix: --paired-diff-norm2
      position: 18

  # Mask options
  mask:
    type: ['null', File]
    label: Mask label file
    inputBinding:
      prefix: --mask
      position: 19
  cortex:
    type: ['null', boolean]
    label: Use cortex label as mask
    inputBinding:
      prefix: --cortex
      position: 20

outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mris_preproc.log
