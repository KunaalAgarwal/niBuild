#!/usr/bin/env cwl-runner

# https://fsl.fmrib.ox.ac.uk/fsl/fslwiki/FDT/UserGuide
# Probabilistic tractography

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'probtrackx2'

hints:
  DockerRequirement:
    dockerPull: brainlife/fsl:latest

stdout: probtrackx2.log
stderr: probtrackx2.log

inputs:
  # Required inputs
  samples:
    type: string
    label: Basename of bedpostX samples (e.g., merged)
    inputBinding:
      prefix: --samples=
      separate: false
  mask:
    type: File
    label: Brain mask in diffusion space
    inputBinding:
      prefix: -m
  seed:
    type: File
    label: Seed volume or text file of coordinates
    inputBinding:
      prefix: -x
  output_dir:
    type: string
    label: Output directory
    inputBinding:
      prefix: --dir=
      separate: false

  # Tracking parameters
  n_samples:
    type: ['null', int]
    label: Number of samples per voxel (default 5000)
    inputBinding:
      prefix: --nsamples=
      separate: false
  n_steps:
    type: ['null', int]
    label: Number of steps per sample (default 2000)
    inputBinding:
      prefix: --nsteps=
      separate: false
  step_length:
    type: ['null', double]
    label: Step length in mm (default 0.5)
    inputBinding:
      prefix: --steplength=
      separate: false
  c_thresh:
    type: ['null', double]
    label: Curvature threshold (default 0.2)
    inputBinding:
      prefix: --cthr=
      separate: false
  fibthresh:
    type: ['null', double]
    label: Minimum fiber volume fraction (default 0.01)
    inputBinding:
      prefix: --fibthresh=
      separate: false
  dist_thresh:
    type: ['null', double]
    label: Minimum distance threshold in mm
    inputBinding:
      prefix: --distthresh=
      separate: false
  loopcheck:
    type: ['null', boolean]
    label: Enable loop checking
    inputBinding:
      prefix: --loopcheck
  onewaycondition:
    type: ['null', boolean]
    label: Apply waypoint conditions to each direction separately
    inputBinding:
      prefix: --onewaycondition

  # Fiber selection
  rand_fib:
    type: ['null', int]
    label: Fiber sampling strategy (0=max, 1=sample, 2=sample+reject, 3=sample+reject+modulate)
    inputBinding:
      prefix: --randfib=
      separate: false
  fibst:
    type: ['null', int]
    label: Force starting fiber (1-based index)
    inputBinding:
      prefix: --fibst=
      separate: false

  # Masks and ROIs
  waypoints:
    type: ['null', File]
    label: Waypoint mask (paths must pass through ALL)
    inputBinding:
      prefix: --waypoints=
      separate: false
  waycond:
    type:
      - 'null'
      - type: enum
        symbols: [AND, OR]
    label: Waypoint condition (AND or OR)
    inputBinding:
      prefix: --waycond=
      separate: false
  avoid:
    type: ['null', File]
    label: Exclusion mask (reject paths through this)
    inputBinding:
      prefix: --avoid=
      separate: false
  stop:
    type: ['null', File]
    label: Stop mask (terminate paths here)
    inputBinding:
      prefix: --stop=
      separate: false
  target_masks:
    type: ['null', File]
    label: List of target masks
    inputBinding:
      prefix: --targetmasks=
      separate: false
  os2t:
    type: ['null', boolean]
    label: Output seeds to targets
    inputBinding:
      prefix: --os2t

  # Transformation
  xfm:
    type: ['null', File]
    label: Transformation matrix (seed to diffusion space)
    inputBinding:
      prefix: --xfm=
      separate: false
  invxfm:
    type: ['null', File]
    label: Inverse transformation matrix
    inputBinding:
      prefix: --invxfm=
      separate: false
  seedref:
    type: ['null', File]
    label: Reference image for seed space
    inputBinding:
      prefix: --seedref=
      separate: false

  # Output options
  opd:
    type: ['null', boolean]
    label: Output path distribution
    inputBinding:
      prefix: --opd
  pd:
    type: ['null', boolean]
    label: Output path distribution for each target
    inputBinding:
      prefix: --pd
  out:
    type: ['null', string]
    label: Output file stem
    inputBinding:
      prefix: --out=
      separate: false
  omatrix1:
    type: ['null', boolean]
    label: Output matrix (seed x seed)
    inputBinding:
      prefix: --omatrix1
  omatrix2:
    type: ['null', boolean]
    label: Output matrix (seed x low-res seed)
    inputBinding:
      prefix: --omatrix2
  omatrix3:
    type: ['null', boolean]
    label: Output matrix (seed x target)
    inputBinding:
      prefix: --omatrix3
  omatrix4:
    type: ['null', boolean]
    label: Output matrix (tract x tract)
    inputBinding:
      prefix: --omatrix4

  # Network mode
  network:
    type: ['null', boolean]
    label: Network mode (seed file is list of seeds)
    inputBinding:
      prefix: --network

  # Other options
  simple:
    type: ['null', boolean]
    label: Track from single voxel coordinates
    inputBinding:
      prefix: --simple
  force_dir:
    type: ['null', boolean]
    label: Use directory as given (don't add .probtrackX)
    inputBinding:
      prefix: --forcedir
  verbose:
    type: ['null', int]
    label: Verbosity level (0, 1, or 2)
    inputBinding:
      prefix: -V
  rseed:
    type: ['null', int]
    label: Random seed
    inputBinding:
      prefix: --rseed=
      separate: false
  modeuler:
    type: ['null', boolean]
    label: Use modified Euler streamlining
    inputBinding:
      prefix: --modeuler
  sampvox:
    type: ['null', double]
    label: Sample sub-voxel tracking starting points
    inputBinding:
      prefix: --sampvox=
      separate: false

outputs:
  output_directory:
    type: Directory
    outputBinding:
      glob: $(inputs.output_dir)
  fdt_paths:
    type: ['null', File]
    outputBinding:
      glob:
        - $(inputs.output_dir)/fdt_paths.nii.gz
        - $(inputs.output_dir)/fdt_paths.nii
  way_total:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir)/waytotal
  matrix:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.output_dir)/fdt_matrix*.dot
  targets:
    type:
      - 'null'
      - type: array
        items: File
    outputBinding:
      glob:
        - $(inputs.output_dir)/seeds_to_*.nii.gz
        - $(inputs.output_dir)/seeds_to_*.nii
  log:
    type: File
    outputBinding:
      glob: probtrackx2.log
