#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA2.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA2'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest
requirements:
  InlineJavascriptRequirement: {}

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  type:
    type: int
    label: ANOVA model type (1=random A, 2=random B, 3=both fixed)
  alevels:
    type: int
    label: Number of levels for factor A
  blevels:
    type: int
    label: Number of levels for factor B
  dset:
    type:
      type: array
      items:
        type: record
        name: anova2_dset
        fields:
          alevel:
            type: int
          blevel:
            type: int
          dataset:
            type: File
            secondaryFiles: '$(self.basename.match(/\\.HEAD$/) ? ["^.BRIK", "^.BRIK.gz"] : [])'
    label: Dataset specifications (level_A level_B filename)
  bucket:
    type: string
    label: Output bucket dataset prefix

  # Output options
  fa:
    type: ['null', string]
    label: F-statistic for factor A
  fb:
    type: ['null', string]
    label: F-statistic for factor B
  fab:
    type: ['null', string]
    label: F-statistic for interaction
  amean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor A (level prefix)
    inputBinding: {prefix: -amean}
  bmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor B (level prefix)
    inputBinding: {prefix: -bmean}
  adiff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between levels of A (level1 level2 prefix)
    inputBinding: {prefix: -adiff}
  bdiff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between levels of B (level1 level2 prefix)
    inputBinding: {prefix: -bdiff}
  acontr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast for factor A
    inputBinding: {prefix: -acontr}
  bcontr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast for factor B
    inputBinding: {prefix: -bcontr}

  # Optional flags
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  debug:
    type: ['null', int]
    label: Debug level
    inputBinding: {prefix: -debug}

arguments:
  - valueFrom: |
      ${
        var args = [];
        args.push("-type", inputs.type.toString());
        args.push("-alevels", inputs.alevels.toString());
        args.push("-blevels", inputs.blevels.toString());
        if (inputs.fa) {
          args.push("-fa", inputs.fa);
        }
        if (inputs.fb) {
          args.push("-fb", inputs.fb);
        }
        if (inputs.fab) {
          args.push("-fab", inputs.fab);
        }
        (inputs.dset || []).forEach(function(entry) {
          var datasetPath = entry.dataset.path || entry.dataset.basename;
          if (entry.dataset.basename.match(/\\.HEAD$/)) {
            datasetPath = datasetPath.replace(/\\.HEAD$/, '');
          }
          args.push("-dset", entry.alevel.toString(), entry.blevel.toString(), datasetPath);
        });
        args.push("-bucket", inputs.bucket);
        return args;
      }
    position: 0

outputs:
  stats:
    type: File
    outputBinding:
      glob: $(inputs.bucket)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
