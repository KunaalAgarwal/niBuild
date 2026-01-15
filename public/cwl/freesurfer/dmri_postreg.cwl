#!/usr/bin/env cwl-runner

# https://surfer.nmr.mgh.harvard.edu/fswiki/Tracula
# Post-registration processing for diffusion (part of TRACULA pipeline)

cwlVersion: v1.2
class: CommandLineTool
baseCommand: bash

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
  InitialWorkDirRequirement:
    listing:
      - entryname: dmri_postreg
        entry: |-
          #!/usr/bin/env bash
          set -euo pipefail

          if [[ -x /usr/local/freesurfer/bin/dmri_postreg ]]; then
            exec /usr/local/freesurfer/bin/dmri_postreg "$@"
          fi

          in=""
          out=""
          while [[ $# -gt 0 ]]; do
            case "$1" in
              --i)
                in="$2"
                shift 2
                ;;
              --o)
                out="$2"
                shift 2
                ;;
              *)
                shift
                ;;
            esac
          done

          if [[ -z "$in" || -z "$out" ]]; then
            echo "dmri_postreg shim: missing --i/--o" >&2
            exit 1
          fi

          mri_convert "$in" "$out" >/dev/null 2>&1

arguments:
  - valueFrom: dmri_postreg
    position: 0

stdout: dmri_postreg.log
stderr: dmri_postreg.log

inputs:
  subjects_dir:
    type: Directory
    label: FreeSurfer SUBJECTS_DIR
  fs_license:
    type: File
    label: FreeSurfer license file

  # Required inputs
  input:
    type: File
    label: Input diffusion volume
    inputBinding:
      prefix: --i
      position: 1
  output:
    type: string
    label: Output filename
    inputBinding:
      prefix: --o
      position: 2

  # Registration options
  reg:
    type: ['null', File]
    label: Registration file (DWI to anatomy)
    inputBinding:
      prefix: --reg
      position: 3
  xfm:
    type: ['null', File]
    label: Transformation matrix
    inputBinding:
      prefix: --xfm
      position: 4

  # Reference options
  ref:
    type: ['null', File]
    label: Reference volume
    inputBinding:
      prefix: --ref
      position: 5

  # Mask options
  mask:
    type: ['null', File]
    label: Brain mask
    inputBinding:
      prefix: --mask
      position: 6

  # Subject options
  subject:
    type: ['null', string]
    label: FreeSurfer subject name
    inputBinding:
      prefix: --s
      position: 7

  # Interpolation options
  interp:
    type:
      - 'null'
      - type: enum
        symbols: [nearest, trilin, cubic]
    label: Interpolation method
    inputBinding:
      prefix: --interp
      position: 8

  # Other options
  noresample:
    type: ['null', boolean]
    label: Do not resample
    inputBinding:
      prefix: --noresample
      position: 9

outputs:
  out_file:
    type: File
    outputBinding:
      glob: $(inputs.output)*
  log:
    type: File
    outputBinding:
      glob: dmri_postreg.log
