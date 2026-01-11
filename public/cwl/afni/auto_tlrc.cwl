#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/@auto_tlrc.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: ['bash', '-lc']

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest
requirements:
  InlineJavascriptRequirement: {}

stdout: auto_tlrc.log
stderr: auto_tlrc.log

inputs:
  input:
    type: File
    label: Input anatomical dataset
  base:
    type: File
    label: Reference template in standard space (e.g., TT_N27+tlrc)
    secondaryFiles:
      - pattern: ^.BRIK
        required: false
      - pattern: ^.BRIK.gz
        required: false

  suffix:
    type: ['null', string]
    label: Output dataset suffix

  # Skull stripping options
  no_ss:
    type: ['null', boolean]
    label: Do not strip skull of input dataset
  warp_orig_vol:
    type: ['null', boolean]
    label: Preserve skull in output by warping original volume

  # Resolution options
  dxyz:
    type: ['null', double]
    label: Cubic voxel size in mm (default matches template)
  dx:
    type: ['null', double]
    label: X voxel dimension in mm
  dy:
    type: ['null', double]
    label: Y voxel dimension in mm
  dz:
    type: ['null', double]
    label: Z voxel dimension in mm

  # Padding
  pad_base:
    type: ['null', double]
    label: Padding in mm to prevent cropping (default 15)

  # Transform options
  xform:
    type:
      - 'null'
      - type: enum
        symbols: [affine_general, shift_rotate_scale]
    label: Warping transformation type
  init_xform:
    type: ['null', File]
    label: Apply preliminary affine transform before registration

  # Algorithm options
  maxite:
    type: ['null', int]
    label: Maximum iterations for alignment algorithm
  use_3dAllineate:
    type: ['null', boolean]
    label: Use 3dAllineate instead of 3dWarpDrive

  # For applying transform to other datasets
  apar:
    type: ['null', File]
    label: Reference anatomical for applying transform
  onewarp:
    type: ['null', boolean]
    label: Single interpolation step
  twowarp:
    type: ['null', boolean]
    label: Dual interpolation steps

  # Other options
  overwrite:
    type: ['null', boolean]
    label: Replace existing outputs

arguments:
  - valueFrom: |
      ${
        var input = inputs.input.path;
        var base = inputs.base.path || inputs.base.basename;
        var args = ["@auto_tlrc", "-base", base, "-input", "auto_tlrc_input.nii.gz"];

        function addFlag(name, val) {
          if (val) {
            args.push(name);
          }
        }
        function addOpt(name, val) {
          if (val !== null && val !== undefined) {
            args.push(name, val.toString());
          }
        }

        addOpt("-suffix", inputs.suffix);
        addFlag("-no_ss", inputs.no_ss);
        addFlag("-warp_orig_vol", inputs.warp_orig_vol);
        addOpt("-dxyz", inputs.dxyz);
        addOpt("-dx", inputs.dx);
        addOpt("-dy", inputs.dy);
        addOpt("-dz", inputs.dz);
        addOpt("-pad_base", inputs.pad_base);
        addOpt("-xform", inputs.xform);
        if (inputs.init_xform) {
          args.push("-init_xform", inputs.init_xform.path);
        }
        addOpt("-maxite", inputs.maxite);
        addFlag("-3dAllineate", inputs.use_3dAllineate);
        if (inputs.apar) {
          args.push("-apar", inputs.apar.path);
        }
        addFlag("-onewarp", inputs.onewarp);
        addFlag("-twowarp", inputs.twowarp);
        addFlag("-overwrite", inputs.overwrite);

        return "set -euo pipefail; cp \"" + input + "\" auto_tlrc_input.nii.gz; " + args.join(" ");
      }
    position: 0

outputs:
  tlrc_anat:
    type: File
    outputBinding:
      glob:
        - "*+tlrc.HEAD"
        - "*+tlrc.BRIK"
        - "*+tlrc.BRIK.gz"
        - "*_at.nii"
        - "*_at.nii.gz"
  transform:
    type: ['null', File]
    outputBinding:
      glob: "*.Xat.1D"
  log:
    type: ['null', File]
    outputBinding:
      glob: auto_tlrc.log
