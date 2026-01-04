#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/mris_sphere
# Maps surface to sphere for registration

cwlVersion: v1.2
class: CommandLineTool
baseCommand: 'mris_sphere'

hints:
  DockerRequirement:
    dockerPull: freesurfer/freesurfer:latest

stdout: mris_sphere.log
stderr: mris_sphere.log

inputs:
  # Required inputs
  input:
    type: File
    label: Input inflated surface file
    inputBinding:
      position: 50
  output:
    type: string
    label: Output spherical surface filename
    inputBinding:
      position: 51

  # Processing options
  seed:
    type: ['null', int]
    label: Random number generator seed
    inputBinding:
      prefix: -seed
      position: 1
  q:
    type: ['null', boolean]
    label: Omit self-intersection and vertex location info
    inputBinding:
      prefix: -q
      position: 2
  p:
    type: ['null', boolean]
    label: Write intermediate surfaces
    inputBinding:
      prefix: -p
      position: 3

  # Distortion correction
  dist:
    type: ['null', double]
    label: Expand surface outward
    inputBinding:
      prefix: -dist
      position: 4
  mval:
    type: ['null', double]
    label: Magic value for processing
    inputBinding:
      prefix: -v
      position: 5

  # White matter reference
  in_smoothwm:
    type: ['null', File]
    label: Smooth white matter reference surface
    inputBinding:
      prefix: -w
      position: 6

  # Iteration options
  niters:
    type: ['null', int]
    label: Number of iterations
    inputBinding:
      prefix: -i
      position: 7
  dt:
    type: ['null', double]
    label: Time step for integration
    inputBinding:
      prefix: -dt
      position: 8

  # Other options
  remove:
    type: ['null', boolean]
    label: Remove interseced faces
    inputBinding:
      prefix: -remove
      position: 9

outputs:
  sphere:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: mris_sphere.log
