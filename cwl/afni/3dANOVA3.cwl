#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA3.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA3'

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
    label: ANOVA model type (1-5 for different random/fixed combinations)
  alevels:
    type: int
    label: Number of levels for factor A
  blevels:
    type: int
    label: Number of levels for factor B
  clevels:
    type: int
    label: Number of levels for factor C
  dset:
    type:
      type: array
      items:
        type: record
        name: anova3_dset
        fields:
          alevel:
            type: int
          blevel:
            type: int
          clevel:
            type: int
          dataset:
            type: File
            secondaryFiles: '$(self.basename.match(/\\.HEAD$/) ? ["^.BRIK", "^.BRIK.gz"] : [])'
    label: Dataset specifications (level_A level_B level_C filename)
  bucket:
    type: string
    label: Output bucket dataset prefix

  # Output options - main effects
  fa:
    type: ['null', string]
    label: F-statistic for factor A
  fb:
    type: ['null', string]
    label: F-statistic for factor B
  fc:
    type: ['null', string]
    label: F-statistic for factor C

  # Output options - interactions
  fab:
    type: ['null', string]
    label: F-statistic for A x B interaction
    inputBinding: {prefix: -fab}
  fac:
    type: ['null', string]
    label: F-statistic for A x C interaction
    inputBinding: {prefix: -fac}
  fbc:
    type: ['null', string]
    label: F-statistic for B x C interaction
    inputBinding: {prefix: -fbc}
  fabc:
    type: ['null', string]
    label: F-statistic for A x B x C interaction
    inputBinding: {prefix: -fabc}

  # Mean outputs
  amean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor A
    inputBinding: {prefix: -amean}
  bmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor B
    inputBinding: {prefix: -bmean}
  cmean:
    type:
      - 'null'
      - type: array
        items: string
    label: Mean for level of factor C
    inputBinding: {prefix: -cmean}

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
        args.push("-clevels", inputs.clevels.toString());
        if (inputs.fa) {
          args.push("-fa", inputs.fa);
        }
        if (inputs.fb) {
          args.push("-fb", inputs.fb);
        }
        if (inputs.fc) {
          args.push("-fc", inputs.fc);
        }
        (inputs.dset || []).forEach(function(entry) {
          var datasetPath = entry.dataset.path || entry.dataset.basename;
          if (entry.dataset.basename.match(/\\.HEAD$/)) {
            datasetPath = datasetPath.replace(/\\.HEAD$/, '');
          }
          args.push(
            "-dset",
            entry.alevel.toString(),
            entry.blevel.toString(),
            entry.clevel.toString(),
            datasetPath
          );
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
