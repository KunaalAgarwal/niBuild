#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/oxford_asl
# ASL calibration to absolute CBF units

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'asl_calib'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: asl_calib.log
stderr: asl_calib.err.log

inputs:
  # Required input
  calib_image:
    type: File
    label: Calibration image (M0/proton density)
    inputBinding:
      prefix: -c
      position: 1

  # Optional inputs
  perfusion:
    type: ['null', File]
    label: CBF image for calibration (ASL native space)
    inputBinding:
      prefix: -i
  structural:
    type: ['null', File]
    label: Structural image (already BETed)
    inputBinding:
      prefix: -s
  transform:
    type: ['null', File]
    label: ASL-to-structural transformation matrix
    inputBinding:
      prefix: -t
  mask:
    type: ['null', File]
    label: Reference mask in calibration image space
    inputBinding:
      prefix: -m
  bmask:
    type: ['null', File]
    label: Brain mask (ASL space) for sensitivity or tissue T1 estimation
    inputBinding:
      prefix: --bmask

  # Output options
  output_dir:
    type: ['null', string]
    label: Output directory name
    inputBinding:
      prefix: -o
  output_file:
    type: ['null', string]
    label: Output filename for calibrated image (requires -i)
    inputBinding:
      prefix: --of

  # Calibration parameters
  mode:
    type: ['null', string]
    label: Calibration mode (longtr or satrecov)
    inputBinding:
      prefix: --mode
  tissref:
    type: ['null', string]
    label: Tissue reference type (csf, wm, gm, none)
    inputBinding:
      prefix: --tissref
  te:
    type: ['null', double]
    label: TE used in sequence (ms)
    inputBinding:
      prefix: --te
  tr:
    type: ['null', double]
    label: TR used in calibration sequence (s, default 3.2, longtr mode)
    inputBinding:
      prefix: --tr
  cgain:
    type: ['null', double]
    label: Relative gain between calibration and ASL data (default 1, longtr mode)
    inputBinding:
      prefix: --cgain

  # Relaxation parameters
  t2star:
    type: ['null', boolean]
    label: Correct with T2* rather than T2
    inputBinding:
      prefix: --t2star
  t1r:
    type: ['null', double]
    label: T1 of reference tissue (s)
    inputBinding:
      prefix: --t1r
  t2r:
    type: ['null', double]
    label: T2(*) of reference tissue (ms)
    inputBinding:
      prefix: --t2r
  t2b:
    type: ['null', double]
    label: T2(*) of blood (ms)
    inputBinding:
      prefix: --t2b
  pc:
    type: ['null', double]
    label: Partition co-efficient
    inputBinding:
      prefix: --pc

  # CSF masking options
  csfmaskingoff:
    type: ['null', boolean]
    label: Turn off ventricle masking (segmentation only)
    inputBinding:
      prefix: --csfmaskingoff
  str2std:
    type: ['null', File]
    label: Structural to MNI152 linear registration (.mat)
    inputBinding:
      prefix: --str2std
  warp:
    type: ['null', File]
    label: Structural to MNI152 non-linear registration (warp)
    inputBinding:
      prefix: --warp

outputs:
  output_directory:
    type: ['null', Directory]
    outputBinding:
      glob: $(inputs.output_dir)
  calibrated_perfusion:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_file).nii.gz
        - $(inputs.output_file).nii
  log:
    type: File
    outputBinding:
      glob: asl_calib.log
