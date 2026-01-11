#!/usr/bin/env cwl-runner

# https://afni.nimh.nih.gov/pub/dist/doc/program_help/3dLMEr.html

cwlVersion: v1.2
class: CommandLineTool
baseCommand: '3dLMEr'

hints:
  DockerRequirement:
    dockerPull: fmribuild/afni-test:latest

requirements:
  InlineJavascriptRequirement: {}
  InitialWorkDirRequirement:
    listing: |
      ${
        var lines = [];
        lines.push("Subj\tCond\tInputFile");
        (inputs.table || []).forEach(function(row) {
          var fpath = row.input_file.path || row.input_file.basename;
          lines.push([row.subj, row.cond, fpath].join("\t"));
        });
        return [{
          "class": "File",
          "basename": "dataTable.txt",
          "contents": lines.join("\n") + "\n"
        }];
      }

stdout: $(inputs.prefix).log
stderr: $(inputs.prefix).log

inputs:
  prefix:
    type: string
    label: Output filename prefix
    inputBinding: {prefix: -prefix}
  table:
    type:
      type: array
      items:
        type: record
        name: lmer_table_row
        fields:
          subj:
            type: string
          cond:
            type: string
          input_file:
            type: File
    label: Data table rows (Subj, Cond, InputFile)

  # Model specification (uses R formula syntax)
  model:
    type: string
    label: Fixed effects formula in R lmer syntax
    inputBinding: {prefix: -model}

  # Variable specification
  qVars:
    type: ['null', string]
    label: Quantitative variables (comma-separated)
    inputBinding: {prefix: -qVars}
  qVarCenters:
    type: ['null', string]
    label: Centering values for quantitative variables
    inputBinding: {prefix: -qVarCenters}
  vVars:
    type: ['null', string]
    label: Voxel-wise covariates
    inputBinding: {prefix: -vVars}
  vVarCenters:
    type: ['null', string]
    label: Centering values for voxel-wise covariates
    inputBinding: {prefix: -vVarCenters}

  # General linear tests
  num_glt:
    type: ['null', int]
    label: Number of general linear t-tests
    inputBinding: {prefix: -num_glt}
  gltLabel:
    type:
      - 'null'
      - type: array
        items: string
    label: GLT labels
    inputBinding: {prefix: -gltLabel}
  gltCode:
    type:
      - 'null'
      - type: array
        items: string
    label: GLT coding specifications
    inputBinding: {prefix: -gltCode}

  # General linear F-tests
  num_glf:
    type: ['null', int]
    label: Number of general linear F-tests
    inputBinding: {prefix: -num_glf}
  glfLabel:
    type:
      - 'null'
      - type: array
        items: string
    label: GLF labels
    inputBinding: {prefix: -glfLabel}
  glfCode:
    type:
      - 'null'
      - type: array
        items: string
    label: GLF coding specifications
    inputBinding: {prefix: -glfCode}

  # Statistical options
  SS_type:
    type: ['null', int]
    label: Sum of squares type (1=sequential, 3=marginal)
    inputBinding: {prefix: -SS_type}
  bounds:
    type: ['null', string]
    label: Outlier removal range (lb ub)
    inputBinding: {prefix: -bounds}
  ML:
    type: ['null', boolean]
    label: Use Maximum Likelihood instead of REML
    inputBinding: {prefix: -ML}

  # Output options
  resid:
    type: ['null', string]
    label: Output filename for residuals
    inputBinding: {prefix: -resid}
  RE:
    type: ['null', string]
    label: Random effects to save
    inputBinding: {prefix: -RE}
  REprefix:
    type: ['null', string]
    label: Output filename for random effects
    inputBinding: {prefix: -REprefix}

  # Processing
  mask:
    type: ['null', File]
    label: Process voxels within mask only
    inputBinding: {prefix: -mask}
  jobs:
    type: ['null', int]
    label: Number of parallel processors
    inputBinding: {prefix: -jobs}

arguments:
  - -dataTable
  - "@dataTable.txt"

outputs:
  stats:
    type: File
    outputBinding:
      glob: $(inputs.prefix)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  residuals:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.resid)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  random_effects:
    type: ['null', File]
    outputBinding:
      glob: $(inputs.REprefix)+orig.HEAD
    secondaryFiles:
      - ^.BRIK
      - ^.BRIK.gz
  log:
    type: File
    outputBinding:
      glob: $(inputs.prefix).log
