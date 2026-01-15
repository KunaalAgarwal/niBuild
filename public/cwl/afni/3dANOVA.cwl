#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dANOVA.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dANOVA'

hints:
  DockerRequirement:
    dockerPull: brainlife/afni:latest

requirements:
  InlineJavascriptRequirement: {}

stdout: $(inputs.bucket).log
stderr: $(inputs.bucket).log

inputs:
  levels:
    type: int
    label: Number of factor levels
  dset:
    type:
      type: array
      items:
        type: record
        fields:
          level:
            type: int
          dataset:
            type: File
            secondaryFiles: '$(self.basename.match(/\\.HEAD$/) ? ["^.BRIK", "^.BRIK.gz"] : [])'
    label: Dataset specifications (level filename pairs)
  bucket:
    type: string
    label: Output bucket dataset prefix

  # Output options
  ftr:
    type: ['null', string]
    label: F-statistic for treatment effect output prefix
  mean:
    type:
      - 'null'
      - type: array
        items: string
    label: Estimate of factor level mean (level prefix pairs)
    inputBinding: {prefix: -mean}
  diff:
    type:
      - 'null'
      - type: array
        items: string
    label: Difference between factor levels (level1 level2 prefix)
    inputBinding: {prefix: -diff}
  contr:
    type:
      - 'null'
      - type: array
        items: string
    label: Contrast in factor levels (coefficients prefix)
    inputBinding: {prefix: -contr}

  # Optional flags
  mask:
    type: ['null', File]
    label: Mask dataset
    inputBinding: {prefix: -mask}
  voxel:
    type: ['null', int]
    label: Screen output for specific voxel
    inputBinding: {prefix: -voxel}
  debug:
    type: ['null', int]
    label: Debug level
    inputBinding: {prefix: -debug}
  old_method:
    type: ['null', boolean]
    label: Use previous ANOVA computation approach
    inputBinding: {prefix: -old_method}
  OK:
    type: ['null', boolean]
    label: Confirm understanding of contrast limitations
    inputBinding: {prefix: -OK}
  assume_sph:
    type: ['null', boolean]
    label: Assume sphericity for zero-sum contrasts
    inputBinding: {prefix: -assume_sph}

arguments:
  - valueFrom: |
      ${ 
         var args = [];
         args.push("-levels", inputs.levels.toString());
        inputs.dset.forEach(function(entry){
            var datasetPath = entry.dataset.path || entry.dataset.basename;
            if (entry.dataset.basename.match(/\\.HEAD$/)) {
              datasetPath = datasetPath.replace(/\\.HEAD$/, '');
            }
            args.push("-dset", entry.level.toString(), datasetPath);
        });
        if (inputs.ftr) {
          args.push("-ftr", inputs.ftr);
        }
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
  f_stat:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.ftr)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.bucket).log
