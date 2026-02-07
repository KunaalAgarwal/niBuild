#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/BASIL
# Bayesian inference for ASL MRI (FABBER-based)
# Model parameters (--casl, --ti1, --tau, --bat, etc.) must be
# passed via an options file (-@), not as direct command-line flags.

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'basil'

requirements:
  InlineJavascriptRequirement: {}

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: basil.log
stderr: basil.err.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input ASL difference data
    inputBinding:
      prefix: -i
      position: 1
  output_dir:
    type: string
    label: Output directory name
    inputBinding:
      prefix: -o
      position: 2
  mask:
    type: File
    label: Brain mask
    inputBinding:
      prefix: -m

  # Model parameters file (contains --casl, --ti1=, --tau=, --bat=, etc.)
  options_file:
    type: ['null', File]
    label: FABBER parameter options file
    inputBinding:
      prefix: '-@'

  # Model selection
  model:
    type: ['null', string]
    label: Model used for analysis (default buxton)
    inputBinding:
      prefix: --model

  # Extended analysis options
  nlls:
    type: ['null', boolean]
    label: Do least squares analysis as first step
    inputBinding:
      prefix: --nlls
  infertau:
    type: ['null', boolean]
    label: Infer on bolus length
    inputBinding:
      prefix: --infertau
  infert1:
    type: ['null', boolean]
    label: Include uncertainty in T1 values
    inputBinding:
      prefix: --infert1
  inferart:
    type: ['null', boolean]
    label: Infer on arterial compartment
    inputBinding:
      prefix: --inferart
  spatial:
    type: ['null', boolean]
    label: Adaptive spatial smoothing on CBF
    inputBinding:
      prefix: --spatial
  fast:
    type: ['null', boolean]
    label: Single step analysis (use with --spatial)
    inputBinding:
      prefix: --fast

  # Partial volume correction
  pgm:
    type: ['null', File]
    label: Gray matter PV map
    inputBinding:
      prefix: --pgm
  pwm:
    type: ['null', File]
    label: White matter PV map
    inputBinding:
      prefix: --pwm
  t1im:
    type: ['null', File]
    label: Voxelwise T1 (tissue) estimates
    inputBinding:
      prefix: --t1im

outputs:
  perfusion:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/step*/mean_ftiss.nii.gz
        - $(inputs.output_dir)/mean_ftiss.nii.gz
      outputEval: |
        ${
          if (!self || self.length === 0) return null;
          return self[self.length - 1];
        }
  log:
    type: File
    outputBinding:
      glob: basil.log
