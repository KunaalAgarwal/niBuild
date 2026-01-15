#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/topup
# Susceptibility-induced distortion correction

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'topup'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: topup.log
stderr: topup.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input 4D image with reversed phase-encode pairs
    inputBinding:
      prefix: --imain=
      separate: false
  encoding_file:
    type: File
    label: Acquisition parameters file (phase encode direction and readout time)
    inputBinding:
      prefix: --datain=
      separate: false
  output:
    type: string
    label: Output basename
    inputBinding:
      prefix: --out=
      separate: false

  # Output options
  fout:
    type: ['null', string]
    label: Output fieldmap filename
    inputBinding:
      prefix: --fout=
      separate: false
  iout:
    type: ['null', string]
    label: Output corrected images filename
    inputBinding:
      prefix: --iout=
      separate: false
  logout:
    type: ['null', string]
    label: Output log filename
    inputBinding:
      prefix: --logout=
      separate: false
  dfout:
    type: ['null', string]
    label: Output displacement fields filename
    inputBinding:
      prefix: --dfout=
      separate: false
  rbmout:
    type: ['null', string]
    label: Output rigid body matrices filename
    inputBinding:
      prefix: --rbmout=
      separate: false
  jacout:
    type: ['null', string]
    label: Output Jacobian images filename
    inputBinding:
      prefix: --jacout=
      separate: false

  # Configuration
  config:
    type: ['null', File]
    label: Configuration file (e.g., b02b0.cnf)
    inputBinding:
      prefix: --config=
      separate: false

  # Estimation parameters
  warpres:
    type: ['null', string]
    label: Warp resolution in mm (e.g., "10,10,10")
    inputBinding:
      prefix: --warpres=
      separate: false
  subsamp:
    type: ['null', string]
    label: Subsampling level (e.g., "1")
    inputBinding:
      prefix: --subsamp=
      separate: false
  fwhm:
    type: ['null', string]
    label: FWHM for smoothing (e.g., "8,4,2,1")
    inputBinding:
      prefix: --fwhm=
      separate: false
  miter:
    type: ['null', string]
    label: Max iterations per level
    inputBinding:
      prefix: --miter=
      separate: false
  lambda_:
    type: ['null', string]
    label: Regularization weight
    inputBinding:
      prefix: --lambda=
      separate: false
  ssqlambda:
    type: ['null', int]
    label: Weight lambda by SSD (0 or 1)
    inputBinding:
      prefix: --ssqlambda=
      separate: false
  regmod:
    type:
      - 'null'
      - type: enum
        symbols: [bending_energy, membrane_energy]
    label: Regularization model
    inputBinding:
      prefix: --regmod=
      separate: false

  # Movement estimation
  estmov:
    type: ['null', int]
    label: Estimate movement (0=off, 1=on)
    inputBinding:
      prefix: --estmov=
      separate: false
  minmet:
    type: ['null', int]
    label: Minimization method (0=Levenberg-Marquardt, 1=scaled conjugate gradient)
    inputBinding:
      prefix: --minmet=
      separate: false

  # Spline options
  splineorder:
    type: ['null', int]
    label: B-spline order (2 or 3)
    inputBinding:
      prefix: --splineorder=
      separate: false
  numprec:
    type:
      - 'null'
      - type: enum
        symbols: [double, float]
    label: Numerical precision
    inputBinding:
      prefix: --numprec=
      separate: false

  # Interpolation
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [spline, linear]
    label: Interpolation method
    inputBinding:
      prefix: --interp=
      separate: false

  # Other options
  scale:
    type: ['null', int]
    label: Scale images (0=off, 1=on)
    inputBinding:
      prefix: --scale=
      separate: false
  regrid:
    type: ['null', int]
    label: Regrid (0=off, 1=on)
    inputBinding:
      prefix: --regrid=
      separate: false

  verbose:
    type: ['null', boolean]
    label: Verbose output
    inputBinding:
      prefix: -v
  nthr:
    type: ['null', int]
    label: Number of threads
    inputBinding:
      prefix: --nthr=
      separate: false

outputs:
  movpar:
    type: File
    outputBinding:
      glob: $(inputs.output)_movpar.txt
  fieldcoef:
    type: File
    outputBinding:
      glob:
        - $(inputs.output)_fieldcoef.nii.gz
        - $(inputs.output)_fieldcoef.nii
  fieldmap:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.fout).nii.gz
        - $(inputs.fout).nii
  corrected_images:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.iout).nii.gz
        - $(inputs.iout).nii
  displacement_fields:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.dfout).nii.gz
        - $(inputs.dfout).nii
  jacobian_images:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.jacout).nii.gz
        - $(inputs.jacout).nii
  log:
    type: File
    outputBinding:
      glob: topup.log
