/**
 * Static registry linking canvas labels to CWL tool definitions.
 *
 * Structure:
 * - id: short identifier for the tool
 * - cwlPath: path to CWL file relative to project root
 * - dockerImage: Docker image name for this tool (without tag)
 * - primaryOutputs: outputs that flow to downstream steps (usually main image files)
 * - requiredInputs: inputs that MUST be satisfied for valid CWL
 *   - type: CWL type (File, string, int, double, boolean)
 *   - passthrough: if true, receives upstream primaryOutput (or becomes workflow input for source nodes)
 *   - label: human-readable description
 * - optionalInputs: inputs that can be configured but aren't required
 *   - type, label, flag, bounds, exclusive, dependsOn, options as applicable
 * - outputs: all outputs the tool produces
 *   - type: CWL type (use 'File?' for nullable, 'File[]' for arrays)
 *   - label: human-readable description
 *   - glob: file patterns that match this output
 *   - requires: optional input that must be set for this output to be produced
 */

// Docker images for each neuroimaging library
export const DOCKER_IMAGES = {
    fsl: 'brainlife/fsl',
    afni: 'brainlife/afni',
    ants: 'antsx/ants',
    freesurfer: 'freesurfer/freesurfer',
    mrtrix3: 'mrtrix3/mrtrix3',
    fmriprep: 'nipreps/fmriprep',
    mriqc: 'nipreps/mriqc',
    connectome_workbench: 'khanlab/connectome-workbench',
    amico: 'cookpa/amico-noddi'
};

export const TOOL_MAP = {
    'bet': {
        id: 'bet',
        cwlPath: 'cwl/fsl/bet.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['brain_extraction'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input T1-weighted image',
                acceptedExtensions: ['.nii', '.nii.gz']
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            overlay: {
                type: 'boolean',
                label: 'Generate brain outline image',
                flag: '-o'
            },
            mask: {
                type: 'boolean',
                label: 'Generate binary brain mask image',
                flag: '-m'
            },
            skull: {
                type: 'boolean',
                label: 'Generate skull-stripped image',
                flag: '-s'
            },
            ngenerate: {
                type: 'boolean',
                label: 'Do not generate the default output',
                flag: '-n'
            },
            frac: {
                type: 'double',
                label: 'Fractional intensity threshold',
                flag: '-f',
                bounds: [0, 1]
            },
            vert_frac: {
                type: 'double',
                label: 'Vertical gradient in fractional intensity',
                flag: '-g',
                bounds: [-1, 1]
            },
            radius: {
                type: 'double',
                label: 'Radius of the brain centre in mm',
                flag: '-r'
            },
            cog: {
                type: 'string',
                label: 'Center of gravity vox coordinates (e.g. "90 110 75")',
                flag: '-c'
            },
            threshold: {
                type: 'boolean',
                label: 'Use thresholding to estimate the brain centre',
                flag: '-t'
            },
            mesh: {
                type: 'boolean',
                label: 'Generate a mesh of the brain surface',
                flag: '-e'
            },
            // Mutually exclusive options - wrapped in single 'exclusive' input in CWL
            // This is a record type where only one variant can be used
            exclusive: {
                type: 'record',
                label: 'Mutually exclusive BET modes (choose one)',
                variants: {
                    robust: { type: 'boolean', label: 'Use robust fitting', flag: '-R' },
                    eye: { type: 'boolean', label: 'Use eye mask', flag: '-S' },
                    bias: { type: 'boolean', label: 'Use bias field correction', flag: '-B' },
                    fov: { type: 'boolean', label: 'Use field of view', flag: '-Z' },
                    fmri: { type: 'boolean', label: 'Use fMRI mode', flag: '-F' },
                    betsurf: { type: 'boolean', label: 'Use BET surface mode', flag: '-A' },
                    betsurfT2: { type: 'File', label: 'Use BET surface mode for T2-weighted images', flag: '-A2' }
                }
            }
        },

        outputs: {
            brain_extraction: {
                type: 'File?',
                label: 'Extracted brain image',
                glob: ['$(inputs.output).nii', '$(inputs.output).nii.gz']
            },
            brain_mask: {
                type: 'File?',
                label: 'Binary brain mask',
                glob: ['$(inputs.output)_mask.nii.gz', '$(inputs.output)_mask.nii'],
                requires: 'mask'
            },
            brain_skull: {
                type: 'File?',
                label: 'Skull-stripped image',
                glob: ['$(inputs.output)_skull.nii.gz', '$(inputs.output)_skull.nii'],
                requires: 'skull'
            },
            brain_mesh: {
                type: 'File?',
                label: 'Brain surface mesh',
                glob: ['$(inputs.output)_mesh.vtk'],
                requires: 'mesh'
            },
            brain_registration: {
                type: 'File[]',
                label: 'Registration-related outputs',
                glob: [
                    '$(inputs.output)_inskull_*.*',
                    '$(inputs.output)_outskin_*.*',
                    '$(inputs.output)_outskull_*.*',
                    '$(inputs.output)_skull_mask.*'
                ]
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['$(inputs.output).log']
            }
        }
    },

    'fast': {
        id: 'fast',
        cwlPath: 'cwl/fsl/fast.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['segmented_files'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image (brain extracted recommended)',
                acceptedExtensions: ['.nii', '.nii.gz']
            },
            output: {
                type: 'string',
                label: 'Output filename prefix'
            }
        },

        optionalInputs: {
            nclass: {
                type: 'int',
                label: 'Number of tissue classes',
                flag: '-n'
            },
            iterations: {
                type: 'int',
                label: 'Number of iterations during bias-field removal',
                flag: '-I'
            },
            lowpass: {
                type: 'double',
                label: 'Bias field smoothing extent (FWHM) in mm',
                flag: '-l'
            },
            image_type: {
                type: 'int',
                label: 'Image type (1=T1, 2=T2, 3=PD)',
                flag: '-t',
                options: [1, 2, 3]
            },
            fhard: {
                type: 'double',
                label: 'Initial segmentation spatial smoothness (during bias field estimation)',
                flag: '-f'
            },
            segments: {
                type: 'boolean',
                label: 'Output separate binary segmentation file for each tissue type',
                flag: '-g'
            },
            bias_field: {
                type: 'boolean',
                label: 'Output estimated bias field',
                flag: '-b'
            },
            bias_corrected_image: {
                type: 'boolean',
                label: 'Output bias-corrected image',
                flag: '-B'
            },
            nobias: {
                type: 'boolean',
                label: 'Do not remove bias field',
                flag: '-N'
            },
            channels: {
                type: 'int',
                label: 'Number of channels to use',
                flag: '-S'
            },
            initialization_iterations: {
                type: 'int',
                label: 'Initial number of segmentation-initialisation iterations',
                flag: '-W'
            },
            mixel: {
                type: 'double',
                label: 'Spatial smoothness for mixeltype',
                flag: '-R'
            },
            fixed: {
                type: 'int',
                label: 'Number of main-loop iterations after bias-field removal',
                flag: '-O'
            },
            hyper: {
                type: 'double',
                label: 'Segmentation spatial smoothness',
                flag: '-H'
            },
            manualseg: {
                type: 'File',
                label: 'Manual segmentation file',
                flag: '-s'
            },
            probability_maps: {
                type: 'boolean',
                label: 'Output individual probability maps',
                flag: '-p'
            },
            // Dependent parameters (priors) - these work together
            priors: {
                type: 'record',
                label: 'Prior initialization settings',
                variants: {
                    initialize_priors: { type: 'File', label: 'FLIRT transformation file for prior initialization', flag: '-a' },
                    use_priors: { type: 'boolean', label: 'Use priors', flag: '-P' }
                }
            }
        },

        outputs: {
            segmented_files: {
                type: 'File[]',
                label: 'Segmentation output files',
                glob: [
                    '$(inputs.output)_seg.nii.gz',
                    '$(inputs.output)_pve_*.nii.gz',
                    '$(inputs.output)_mixeltype.nii.gz',
                    '$(inputs.output)_pveseg.nii.gz'
                ]
            },
            output_bias_field: {
                type: 'File?',
                label: 'Estimated bias field',
                glob: ['$(inputs.output)_bias.nii.gz'],
                requires: 'bias_field'
            },
            output_bias_corrected_image: {
                type: 'File?',
                label: 'Bias-corrected image',
                glob: ['$(inputs.output)_restore.nii.gz'],
                requires: 'bias_corrected_image'
            },
            output_probability_maps: {
                type: 'File[]',
                label: 'Individual probability maps',
                glob: ['$(inputs.output)_prob_*.nii.gz'],
                requires: 'probability_maps'
            },
            output_segments: {
                type: 'File[]',
                label: 'Separate binary segmentation files',
                glob: ['$(inputs.output)_seg_*.nii.gz'],
                requires: 'segments'
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['$(inputs.output).log']
            }
        }
    },

    // ==================== PHASE 1: SIMPLE UTILITIES ====================

    'fslreorient2std': {
        id: 'fslreorient2std',
        cwlPath: 'cwl/fsl/fslreorient2std.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['reoriented_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image to reorient',
                acceptedExtensions: ['.nii', '.nii.gz']
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {},

        outputs: {
            reoriented_image: {
                type: 'File',
                label: 'Reoriented image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['$(inputs.output).log']
            }
        }
    },

    'fslroi': {
        id: 'fslroi',
        cwlPath: 'cwl/fsl/fslroi.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['roi_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            x_min: { type: 'int', label: 'Minimum x index' },
            x_size: { type: 'int', label: 'Size in x dimension' },
            y_min: { type: 'int', label: 'Minimum y index' },
            y_size: { type: 'int', label: 'Size in y dimension' },
            z_min: { type: 'int', label: 'Minimum z index' },
            z_size: { type: 'int', label: 'Size in z dimension' },
            t_min: { type: 'int', label: 'Minimum time index' },
            t_size: { type: 'int', label: 'Number of time points' }
        },

        outputs: {
            roi_image: {
                type: 'File',
                label: 'ROI extracted image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['$(inputs.output).log']
            }
        }
    },

    'fslsplit': {
        id: 'fslsplit',
        cwlPath: 'cwl/fsl/fslsplit.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['split_files'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D image'
            }
        },

        optionalInputs: {
            output_basename: { type: 'string', label: 'Output basename' },
            dimension: {
                type: 'string',
                label: 'Split dimension (t, x, y, z)',
                options: ['t', 'x', 'y', 'z']
            }
        },

        outputs: {
            split_files: {
                type: 'File[]',
                label: 'Split 3D volumes',
                glob: ['*.nii.gz', '*.nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fslsplit.log']
            }
        }
    },

    'fslmerge': {
        id: 'fslmerge',
        cwlPath: 'cwl/fsl/fslmerge.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['merged_image'],

        requiredInputs: {
            dimension: {
                type: 'string',
                label: 'Merge dimension (t, x, y, z, a)'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            },
            input_files: {
                type: 'File[]',
                passthrough: true,
                label: 'Input files to merge'
            }
        },

        optionalInputs: {
            tr: { type: 'double', label: 'TR in seconds (for time merge)' }
        },

        outputs: {
            merged_image: {
                type: 'File',
                label: 'Merged image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['$(inputs.output).log']
            }
        }
    },

    'fslstats': {
        id: 'fslstats',
        cwlPath: 'cwl/fsl/fslstats.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['stats_output'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask image', flag: '-k' },
            robust_range: { type: 'boolean', label: 'Robust min/max (2nd/98th percentile)', flag: '-r' },
            mean: { type: 'boolean', label: 'Output mean', flag: '-m' },
            std: { type: 'boolean', label: 'Output standard deviation', flag: '-s' },
            volume: { type: 'boolean', label: 'Output voxel count', flag: '-v' }
        },

        outputs: {
            stats_output: {
                type: 'File',
                label: 'Statistics output',
                glob: ['fslstats_output.txt']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fslstats.log']
            }
        }
    },

    'fslmeants': {
        id: 'fslmeants',
        cwlPath: 'cwl/fsl/fslmeants.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['timeseries'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D image'
            },
            output: {
                type: 'string',
                label: 'Output text file'
            }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask image', flag: '-m' },
            label: { type: 'File', label: 'Label image', flag: '--label' },
            eig: { type: 'boolean', label: 'Calculate eigenvariates', flag: '--eig' },
            transpose: { type: 'boolean', label: 'Transpose output', flag: '--transpose' }
        },

        outputs: {
            timeseries: {
                type: 'File',
                label: 'Time series output',
                glob: ['$(inputs.output)']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fslmeants.log']
            }
        }
    },

    'cluster': {
        id: 'cluster',
        cwlPath: 'cwl/fsl/cluster.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['cluster_table'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input statistical image'
            },
            threshold: {
                type: 'double',
                label: 'Cluster-forming threshold'
            }
        },

        optionalInputs: {
            oindex: { type: 'string', label: 'Output cluster index image', flag: '--oindex' },
            othresh: { type: 'string', label: 'Output thresholded image', flag: '--othresh' },
            osize: { type: 'string', label: 'Output cluster size image', flag: '--osize' },
            pthresh: { type: 'double', label: 'P-value threshold', flag: '--pthresh' },
            cope: { type: 'File', label: 'COPE image', flag: '--cope' },
            mm: { type: 'boolean', label: 'Use mm coordinates', flag: '--mm' }
        },

        outputs: {
            cluster_table: {
                type: 'File',
                label: 'Cluster table',
                glob: ['cluster_table.txt']
            },
            cluster_index: {
                type: 'File?',
                label: 'Cluster index image',
                glob: ['$(inputs.oindex).nii.gz', '$(inputs.oindex).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['cluster.log']
            }
        }
    },

    // ==================== PHASE 2: CORE PREPROCESSING ====================

    'mcflirt': {
        id: 'mcflirt',
        cwlPath: 'cwl/fsl/mcflirt.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['motion_corrected'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D timeseries',
                acceptedExtensions: ['.nii', '.nii.gz']
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            ref_vol: { type: 'int', label: 'Reference volume number', flag: '-refvol' },
            cost: {
                type: 'string',
                label: 'Cost function',
                flag: '-cost',
                options: ['mutualinfo', 'corratio', 'normcorr', 'normmi', 'leastsquares']
            },
            save_mats: { type: 'boolean', label: 'Save transformation matrices', flag: '-mats' },
            save_plots: { type: 'boolean', label: 'Save motion plots', flag: '-plots' },
            mean_vol: { type: 'boolean', label: 'Register to mean volume', flag: '-meanvol' }
        },

        outputs: {
            motion_corrected: {
                type: 'File',
                label: 'Motion corrected image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            motion_parameters: {
                type: 'File?',
                label: 'Motion parameters',
                glob: ['$(inputs.output).par']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['mcflirt.log']
            }
        }
    },

    'slicetimer': {
        id: 'slicetimer',
        cwlPath: 'cwl/fsl/slicetimer.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['slice_time_corrected'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D timeseries'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            tr: { type: 'double', label: 'TR in seconds', flag: '--repeat' },
            direction: { type: 'int', label: 'Slice direction (1=x, 2=y, 3=z)', flag: '--direction' }
        },

        outputs: {
            slice_time_corrected: {
                type: 'File',
                label: 'Slice-time corrected image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['slicetimer.log']
            }
        }
    },

    'susan': {
        id: 'susan',
        cwlPath: 'cwl/fsl/susan.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['smoothed_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            },
            brightness_threshold: {
                type: 'double',
                label: 'Brightness threshold'
            },
            fwhm: {
                type: 'double',
                label: 'FWHM in mm'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            dimension: { type: 'int', label: 'Dimensionality (2 or 3)' },
            use_median: { type: 'int', label: 'Use median (1) or mean (0)' }
        },

        outputs: {
            smoothed_image: {
                type: 'File',
                label: 'Smoothed image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii', '$(inputs.output)']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['susan.log']
            }
        }
    },

    'flirt': {
        id: 'flirt',
        cwlPath: 'cwl/fsl/flirt.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['registered_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image',
                acceptedExtensions: ['.nii', '.nii.gz']
            },
            reference: {
                type: 'File',
                label: 'Reference image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            output_matrix: { type: 'string', label: 'Output matrix filename', flag: '-omat' },
            dof: { type: 'int', label: 'Degrees of freedom (6, 7, 9, 12)', flag: '-dof' },
            cost: {
                type: 'string',
                label: 'Cost function',
                flag: '-cost',
                options: ['mutualinfo', 'corratio', 'normcorr', 'normmi', 'leastsq', 'bbr']
            },
            interp: {
                type: 'string',
                label: 'Interpolation',
                flag: '-interp',
                options: ['trilinear', 'nearestneighbour', 'sinc', 'spline']
            },
            init_matrix: { type: 'File', label: 'Initial matrix', flag: '-init' },
            apply_xfm: { type: 'boolean', label: 'Apply transformation', flag: '-applyxfm' }
        },

        outputs: {
            registered_image: {
                type: 'File?',
                label: 'Registered image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            transformation_matrix: {
                type: 'File?',
                label: 'Transformation matrix',
                glob: ['$(inputs.output_matrix)']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['flirt.log']
            }
        }
    },

    'applywarp': {
        id: 'applywarp',
        cwlPath: 'cwl/fsl/applywarp.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['warped_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            },
            reference: {
                type: 'File',
                label: 'Reference image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            warp: { type: 'File', label: 'Warp field', flag: '--warp' },
            premat: { type: 'File', label: 'Pre-transform matrix', flag: '--premat' },
            postmat: { type: 'File', label: 'Post-transform matrix', flag: '--postmat' },
            interp: {
                type: 'string',
                label: 'Interpolation',
                flag: '--interp',
                options: ['nn', 'trilinear', 'sinc', 'spline']
            }
        },

        outputs: {
            warped_image: {
                type: 'File',
                label: 'Warped image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['applywarp.log']
            }
        }
    },

    'invwarp': {
        id: 'invwarp',
        cwlPath: 'cwl/fsl/invwarp.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['inverse_warp'],

        requiredInputs: {
            warp: {
                type: 'File',
                passthrough: true,
                label: 'Warp field to invert'
            },
            reference: {
                type: 'File',
                label: 'Reference image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            relative: { type: 'boolean', label: 'Relative warp', flag: '--rel' },
            absolute: { type: 'boolean', label: 'Absolute warp', flag: '--abs' },
            noconstraint: { type: 'boolean', label: 'No Jacobian constraint', flag: '--noconstraint' }
        },

        outputs: {
            inverse_warp: {
                type: 'File',
                label: 'Inverse warp field',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['invwarp.log']
            }
        }
    },

    'convertwarp': {
        id: 'convertwarp',
        cwlPath: 'cwl/fsl/convertwarp.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['combined_warp'],

        requiredInputs: {
            reference: {
                type: 'File',
                label: 'Reference image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            warp1: { type: 'File', label: 'First warp field', flag: '--warp1' },
            warp2: { type: 'File', label: 'Second warp field', flag: '--warp2' },
            premat: { type: 'File', label: 'Pre-transform matrix', flag: '--premat' },
            postmat: { type: 'File', label: 'Post-transform matrix', flag: '--postmat' },
            shiftmap: { type: 'File', label: 'Shift map', flag: '--shiftmap' }
        },

        outputs: {
            combined_warp: {
                type: 'File',
                label: 'Combined warp field',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['convertwarp.log']
            }
        }
    },

    'fslmaths': {
        id: 'fslmaths',
        cwlPath: 'cwl/fsl/fslmaths.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['output_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            },
            output: {
                type: 'string',
                label: 'Output filename'
            }
        },

        optionalInputs: {
            add_value: { type: 'double', label: 'Add value', flag: '-add' },
            sub_value: { type: 'double', label: 'Subtract value', flag: '-sub' },
            mul_value: { type: 'double', label: 'Multiply by value', flag: '-mul' },
            div_value: { type: 'double', label: 'Divide by value', flag: '-div' },
            thr: { type: 'double', label: 'Lower threshold', flag: '-thr' },
            uthr: { type: 'double', label: 'Upper threshold', flag: '-uthr' },
            bin: { type: 'boolean', label: 'Binarize', flag: '-bin' },
            mas: { type: 'File', label: 'Apply mask', flag: '-mas' },
            s: { type: 'double', label: 'Gaussian smoothing sigma', flag: '-s' },
            Tmean: { type: 'boolean', label: 'Mean across time', flag: '-Tmean' },
            Tstd: { type: 'boolean', label: 'Std across time', flag: '-Tstd' }
        },

        outputs: {
            output_image: {
                type: 'File',
                label: 'Output image',
                glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii', '$(inputs.output)']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fslmaths.log']
            }
        }
    },

    // ==================== PHASE 3: ADVANCED REGISTRATION ====================

    'fnirt': {
        id: 'fnirt',
        cwlPath: 'cwl/fsl/fnirt.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['warped_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input image'
            },
            reference: {
                type: 'File',
                label: 'Reference image'
            }
        },

        optionalInputs: {
            affine: { type: 'File', label: 'Affine matrix from FLIRT', flag: '--aff' },
            config: { type: 'File', label: 'Configuration file', flag: '--config' },
            cout: { type: 'string', label: 'Output warp coefficients', flag: '--cout' },
            iout: { type: 'string', label: 'Output warped image', flag: '--iout' },
            fout: { type: 'string', label: 'Output displacement field', flag: '--fout' },
            warpres: { type: 'string', label: 'Warp resolution (mm)', flag: '--warpres' },
            refmask: { type: 'File', label: 'Reference mask', flag: '--refmask' }
        },

        outputs: {
            warp_coefficients: {
                type: 'File?',
                label: 'Warp coefficients',
                glob: ['$(inputs.cout).nii.gz', '$(inputs.cout).nii']
            },
            warped_image: {
                type: 'File?',
                label: 'Warped image',
                glob: ['$(inputs.iout).nii.gz', '$(inputs.iout).nii']
            },
            displacement_field: {
                type: 'File?',
                label: 'Displacement field',
                glob: ['$(inputs.fout).nii.gz', '$(inputs.fout).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fnirt.log']
            }
        }
    },

    'fugue': {
        id: 'fugue',
        cwlPath: 'cwl/fsl/fugue.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['unwarped_image'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'EPI image to unwarp'
            }
        },

        optionalInputs: {
            loadfmap: { type: 'File', label: 'Fieldmap in rad/s', flag: '--loadfmap' },
            unwarp: { type: 'string', label: 'Output unwarped image', flag: '-u' },
            dwell: { type: 'double', label: 'Dwell time (seconds)', flag: '--dwell' },
            unwarpdir: {
                type: 'string',
                label: 'Unwarp direction',
                flag: '--unwarpdir',
                options: ['x', 'y', 'z', 'x-', 'y-', 'z-']
            },
            mask: { type: 'File', label: 'Brain mask', flag: '--mask' }
        },

        outputs: {
            unwarped_image: {
                type: 'File?',
                label: 'Unwarped image',
                glob: ['$(inputs.unwarp).nii.gz', '$(inputs.unwarp).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fugue.log']
            }
        }
    },

    'topup': {
        id: 'topup',
        cwlPath: 'cwl/fsl/topup.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['fieldcoef'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D with reversed PE images'
            },
            encoding_file: {
                type: 'File',
                label: 'Acquisition parameters file'
            },
            output: {
                type: 'string',
                label: 'Output basename'
            }
        },

        optionalInputs: {
            config: { type: 'File', label: 'Configuration file', flag: '--config' },
            fout: { type: 'string', label: 'Output fieldmap', flag: '--fout' },
            iout: { type: 'string', label: 'Output corrected images', flag: '--iout' },
            warpres: { type: 'string', label: 'Warp resolution', flag: '--warpres' }
        },

        outputs: {
            fieldcoef: {
                type: 'File',
                label: 'Field coefficients',
                glob: ['$(inputs.output)_fieldcoef.nii.gz', '$(inputs.output)_fieldcoef.nii']
            },
            movpar: {
                type: 'File',
                label: 'Movement parameters',
                glob: ['$(inputs.output)_movpar.txt']
            },
            fieldmap: {
                type: 'File?',
                label: 'Fieldmap',
                glob: ['$(inputs.fout).nii.gz', '$(inputs.fout).nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['topup.log']
            }
        }
    },

    // ==================== PHASE 4: STATISTICAL ANALYSIS ====================

    'film_gls': {
        id: 'film_gls',
        cwlPath: 'cwl/fsl/film_gls.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['results'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input 4D data'
            },
            design_file: {
                type: 'File',
                label: 'Design matrix file'
            }
        },

        optionalInputs: {
            threshold: { type: 'double', label: 'Threshold (default 1000)' },
            results_dir: { type: 'string', label: 'Results directory', flag: '-rn' },
            autocorr_noestimate: { type: 'boolean', label: 'No autocorrelation estimation', flag: '-noest' },
            smooth_autocorr: { type: 'boolean', label: 'Smooth autocorrelation', flag: '-sa' }
        },

        outputs: {
            results: {
                type: 'Directory',
                label: 'Results directory',
                glob: ['results']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['film_gls.log']
            }
        }
    },

    'flameo': {
        id: 'flameo',
        cwlPath: 'cwl/fsl/flameo.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['stats_dir'],

        requiredInputs: {
            cope_file: {
                type: 'File',
                passthrough: true,
                label: 'COPE file'
            },
            mask_file: {
                type: 'File',
                label: 'Mask file'
            },
            design_file: {
                type: 'File',
                label: 'Design matrix'
            },
            t_con_file: {
                type: 'File',
                label: 'T-contrast file'
            },
            cov_split_file: {
                type: 'File',
                label: 'Covariance split file'
            },
            run_mode: {
                type: 'string',
                label: 'Run mode (fe, ols, flame1, flame12)'
            }
        },

        optionalInputs: {
            var_cope_file: { type: 'File', label: 'Variance COPE file', flag: '--varcopefile' },
            f_con_file: { type: 'File', label: 'F-contrast file', flag: '--fcontrastsfile' },
            log_dir: { type: 'string', label: 'Output directory', flag: '--ld' }
        },

        outputs: {
            stats_dir: {
                type: 'Directory',
                label: 'Statistics directory',
                glob: ['stats']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['flameo.log']
            }
        }
    },

    'randomise': {
        id: 'randomise',
        cwlPath: 'cwl/fsl/randomise.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['tstat'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: '4D input image'
            },
            output: {
                type: 'string',
                label: 'Output basename'
            }
        },

        optionalInputs: {
            design_mat: { type: 'File', label: 'Design matrix', flag: '-d' },
            tcon: { type: 'File', label: 'T-contrast file', flag: '-t' },
            fcon: { type: 'File', label: 'F-contrast file', flag: '-f' },
            mask: { type: 'File', label: 'Mask image', flag: '-m' },
            num_perm: { type: 'int', label: 'Number of permutations', flag: '-n' },
            tfce: { type: 'boolean', label: 'Use TFCE', flag: '-T' },
            one_sample_group_mean: { type: 'boolean', label: 'One-sample test', flag: '-1' },
            vox_p_values: { type: 'boolean', label: 'Voxelwise p-values', flag: '-x' }
        },

        outputs: {
            tstat: {
                type: 'File[]',
                label: 'T-statistic images',
                glob: ['$(inputs.output)_tstat*.nii.gz']
            },
            t_corrp: {
                type: 'File[]',
                label: 'Corrected p-value images',
                glob: ['$(inputs.output)_tfce_corrp_tstat*.nii.gz', '$(inputs.output)_vox_corrp_tstat*.nii.gz']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['randomise.log']
            }
        }
    },

    // ==================== PHASE 5: ICA/DENOISING ====================

    'melodic': {
        id: 'melodic',
        cwlPath: 'cwl/fsl/melodic.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['melodic_IC'],

        requiredInputs: {
            input_files: {
                type: 'File',
                passthrough: true,
                label: 'Input file(s)'
            },
            output_dir: {
                type: 'string',
                label: 'Output directory'
            }
        },

        optionalInputs: {
            dim: { type: 'int', label: 'Number of dimensions', flag: '-d' },
            approach: {
                type: 'string',
                label: 'ICA approach',
                flag: '-a',
                options: ['defl', 'symm', 'tica', 'concat']
            },
            tr_sec: { type: 'double', label: 'TR in seconds', flag: '--tr' },
            no_bet: { type: 'boolean', label: 'Skip brain extraction', flag: '--nobet' },
            mask: { type: 'File', label: 'Mask file', flag: '-m' },
            report: { type: 'boolean', label: 'Generate report', flag: '--report' },
            out_all: { type: 'boolean', label: 'Output all', flag: '--Oall' }
        },

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['$(inputs.output_dir)']
            },
            melodic_IC: {
                type: 'File?',
                label: 'IC spatial maps',
                glob: ['$(inputs.output_dir)/melodic_IC.nii.gz']
            },
            melodic_mix: {
                type: 'File?',
                label: 'Mixing matrix',
                glob: ['$(inputs.output_dir)/melodic_mix']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['melodic.log']
            }
        }
    },

    'dual_regression': {
        id: 'dual_regression',
        cwlPath: 'cwl/fsl/dual_regression.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['stage2_spatial_maps'],

        requiredInputs: {
            group_IC_maps: {
                type: 'File',
                passthrough: true,
                label: 'Group ICA maps'
            },
            des_norm: {
                type: 'int',
                label: 'Variance normalize (0 or 1)'
            },
            design_mat: {
                type: 'File',
                label: 'Design matrix'
            },
            design_con: {
                type: 'File',
                label: 'Contrast file'
            },
            n_perm: {
                type: 'int',
                label: 'Number of permutations'
            },
            output_dir: {
                type: 'string',
                label: 'Output directory'
            },
            input_files: {
                type: 'File[]',
                label: 'Input 4D files'
            }
        },

        optionalInputs: {},

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['$(inputs.output_dir)']
            },
            stage1_timeseries: {
                type: 'File[]',
                label: 'Stage 1 timeseries',
                glob: ['$(inputs.output_dir)/dr_stage1_subject*.txt']
            },
            stage2_spatial_maps: {
                type: 'File[]',
                label: 'Stage 2 spatial maps',
                glob: ['$(inputs.output_dir)/dr_stage2_subject*.nii.gz']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['dual_regression.log']
            }
        }
    },

    // ==================== PHASE 6: STRUCTURAL PIPELINES ====================

    'run_first_all': {
        id: 'run_first_all',
        cwlPath: 'cwl/fsl/run_first_all.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['segmentation_files'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input T1 image'
            },
            output: {
                type: 'string',
                label: 'Output basename'
            }
        },

        optionalInputs: {
            brain_extracted: { type: 'boolean', label: 'Input is brain extracted', flag: '-b' },
            method: {
                type: 'string',
                label: 'Boundary correction method',
                flag: '-m',
                options: ['auto', 'fast', 'none']
            },
            structures: { type: 'string', label: 'Structures to segment', flag: '-s' },
            affine: { type: 'File', label: 'Affine matrix for registration', flag: '-a' },
            three_stage: { type: 'boolean', label: 'Use 3-stage registration', flag: '-3' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' },
            debug: { type: 'boolean', label: 'Debug mode (keep temporary files)', flag: '-d' }
        },

        outputs: {
            segmentation_files: {
                type: 'File[]',
                label: 'Segmentation files',
                glob: ['$(inputs.output)_all_fast_firstseg.nii.gz', '$(inputs.output)_all_fast_origsegs.nii.gz', '$(inputs.output)-*_first.nii.gz']
            },
            vtk_meshes: {
                type: 'File[]',
                label: 'VTK meshes',
                glob: ['$(inputs.output)-*.vtk']
            },
            bvars: {
                type: 'File[]',
                label: 'BVARS shape/appearance model files',
                glob: ['$(inputs.output)-*.bvars']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['run_first_all.log']
            }
        }
    },

    'sienax': {
        id: 'sienax',
        cwlPath: 'cwl/fsl/sienax.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['report'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input T1 image'
            }
        },

        optionalInputs: {
            output_dir: { type: 'string', label: 'Output directory', flag: '-o' },
            bet_options: { type: 'string', label: 'BET options', flag: '-B' },
            two_class: { type: 'boolean', label: 'Two-class segmentation', flag: '-2' },
            regional: { type: 'boolean', label: 'Estimate regional volumes', flag: '-r' },
            lesion_mask: { type: 'File', label: 'Lesion mask', flag: '-lm' }
        },

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['*_sienax']
            },
            report: {
                type: 'File',
                label: 'SIENAX report',
                glob: ['*_sienax/report.sienax']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['sienax.log']
            }
        }
    },

    'siena': {
        id: 'siena',
        cwlPath: 'cwl/fsl/siena.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['report'],

        requiredInputs: {
            input1: {
                type: 'File',
                passthrough: true,
                label: 'Input T1 (timepoint 1)'
            },
            input2: {
                type: 'File',
                label: 'Input T1 (timepoint 2)'
            }
        },

        optionalInputs: {
            output_dir: { type: 'string', label: 'Output directory', flag: '-o' },
            bet_options: { type: 'string', label: 'BET options', flag: '-B' },
            two_class: { type: 'boolean', label: 'Two-class segmentation', flag: '-2' },
            ventricle_analysis: { type: 'boolean', label: 'Ventricular analysis', flag: '-V' }
        },

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['*_to_*_siena']
            },
            report: {
                type: 'File',
                label: 'SIENA report',
                glob: ['*_to_*_siena/report.siena']
            },
            edge_points: {
                type: 'File[]?',
                label: 'Edge point images',
                glob: ['*_to_*_siena/*_edge*.nii.gz', '*_to_*_siena/*_edge*.nii']
            },
            flow_images: {
                type: 'File[]?',
                label: 'Flow images',
                glob: ['*_to_*_siena/*_flow*.nii.gz', '*_to_*_siena/*_flow*.nii']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['siena.log']
            }
        }
    },

    'fsl_anat': {
        id: 'fsl_anat',
        cwlPath: 'cwl/fsl/fsl_anat.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['t1_biascorr_brain'],

        requiredInputs: {
            input: {
                type: 'File',
                passthrough: true,
                label: 'Input structural image'
            }
        },

        optionalInputs: {
            output_dir: { type: 'string', label: 'Output directory', flag: '-o' },
            t2: { type: 'boolean', label: 'Input is T2-weighted', flag: '--t2' },
            nobias: { type: 'boolean', label: 'Skip bias correction', flag: '--nobias' },
            noreg: { type: 'boolean', label: 'Skip registration', flag: '--noreg' },
            noseg: { type: 'boolean', label: 'Skip segmentation', flag: '--noseg' },
            nosubcortseg: { type: 'boolean', label: 'Skip subcortical seg', flag: '--nosubcortseg' },
            betfparam: { type: 'double', label: 'BET -f parameter', flag: '--betfparam' }
        },

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['*.anat']
            },
            t1_biascorr_brain: {
                type: 'File?',
                label: 'Bias-corrected brain',
                glob: ['*.anat/T1_biascorr_brain.nii.gz']
            },
            segmentation: {
                type: 'File?',
                label: 'Tissue segmentation',
                glob: ['*.anat/T1_fast_seg.nii.gz']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['fsl_anat.log']
            }
        }
    },

    'probtrackx2': {
        id: 'probtrackx2',
        cwlPath: 'cwl/fsl/probtrackx2.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['fdt_paths'],

        requiredInputs: {
            samples: {
                type: 'string',
                label: 'Samples basename'
            },
            mask: {
                type: 'File',
                label: 'Brain mask'
            },
            seed: {
                type: 'File',
                passthrough: true,
                label: 'Seed volume'
            },
            output_dir: {
                type: 'string',
                label: 'Output directory'
            }
        },

        optionalInputs: {
            n_samples: { type: 'int', label: 'Number of samples', flag: '--nsamples' },
            n_steps: { type: 'int', label: 'Steps per sample', flag: '--nsteps' },
            c_thresh: { type: 'double', label: 'Curvature threshold', flag: '--cthr' },
            waypoints: { type: 'File', label: 'Waypoint mask', flag: '--waypoints' },
            avoid: { type: 'File', label: 'Exclusion mask', flag: '--avoid' },
            stop: { type: 'File', label: 'Stop mask', flag: '--stop' },
            loopcheck: { type: 'boolean', label: 'Loop checking', flag: '--loopcheck' },
            opd: { type: 'boolean', label: 'Output path distribution', flag: '--opd' },
            xfm: { type: 'File', label: 'Transform matrix', flag: '--xfm' }
        },

        outputs: {
            output_directory: {
                type: 'Directory',
                label: 'Output directory',
                glob: ['$(inputs.output_dir)']
            },
            fdt_paths: {
                type: 'File?',
                label: 'Path distribution',
                glob: ['$(inputs.output_dir)/fdt_paths.nii.gz']
            },
            way_total: {
                type: 'File?',
                label: 'Waypoint totals',
                glob: ['$(inputs.output_dir)/waytotal']
            },
            log: {
                type: 'File',
                label: 'Log file',
                glob: ['probtrackx2.log']
            }
        }
    },

    // ==================== AFNI PREPROCESSING TOOLS ====================

    '3dSkullStrip': {
        id: '3dSkullStrip',
        cwlPath: 'cwl/afni/3dSkullStrip.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['skull_stripped'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input volume', acceptedExtensions: ['.nii', '.nii.gz', '+orig.*', '+tlrc.*'] },
            prefix: { type: 'string', label: 'Output volume prefix' }
        },

        optionalInputs: {
            mask_vol: { type: 'boolean', label: 'Output mask volume', flag: '-mask_vol' },
            orig_vol: { type: 'boolean', label: 'Preserve original intensity', flag: '-orig_vol' },
            shrink_fac: { type: 'double', label: 'Shrink factor (0-1)', flag: '-shrink_fac', bounds: [0, 1] },
            push_to_edge: { type: 'boolean', label: 'Push to brain edges', flag: '-push_to_edge' },
            blur_fwhm: { type: 'double', label: 'Blur kernel FWHM', flag: '-blur_fwhm' }
        },

        outputs: {
            skull_stripped: { type: 'File', label: 'Skull-stripped output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            mask: { type: 'File?', label: 'Brain mask', glob: ['$(inputs.prefix)_mask*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dvolreg': {
        id: '3dvolreg',
        cwlPath: 'cwl/afni/3dvolreg.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['registered'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 4D dataset', acceptedExtensions: ['.nii', '.nii.gz', '+orig.*', '+tlrc.*'] },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            base: { type: 'int', label: 'Base volume index', flag: '-base' },
            dfile: { type: 'string', label: 'Motion parameters file', flag: '-dfile' },
            oned_file: { type: 'string', label: '1D motion file', flag: '-1Dfile' },
            twopass: { type: 'boolean', label: 'Two-pass registration', flag: '-twopass' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-verbose' }
        },

        outputs: {
            registered: { type: 'File', label: 'Registered output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            motion_params: { type: 'File?', label: 'Motion parameters', glob: ['$(inputs.dfile)'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dTshift': {
        id: '3dTshift',
        cwlPath: 'cwl/afni/3dTshift.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['shifted'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            TR: { type: 'double', label: 'TR in seconds', flag: '-TR' },
            tzero: { type: 'double', label: 'Align to time offset', flag: '-tzero' },
            tpattern: { type: 'string', label: 'Slice timing pattern', flag: '-tpattern' },
            ignore: { type: 'int', label: 'Ignore first N points', flag: '-ignore' }
        },

        outputs: {
            shifted: { type: 'File', label: 'Time-shifted output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dDespike': {
        id: '3dDespike',
        cwlPath: 'cwl/afni/3dDespike.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['despiked'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            ignore: { type: 'int', label: 'Ignore first I points', flag: '-ignore' },
            corder: { type: 'int', label: 'Curve fit order', flag: '-corder' },
            nomask: { type: 'boolean', label: 'Process all voxels', flag: '-nomask' },
            NEW: { type: 'boolean', label: 'Use faster method', flag: '-NEW' }
        },

        outputs: {
            despiked: { type: 'File', label: 'Despiked output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dBandpass': {
        id: '3dBandpass',
        cwlPath: 'cwl/afni/3dBandpass.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['filtered'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            prefix: { type: 'string', label: 'Output prefix' },
            fbot: { type: 'double', label: 'Low frequency (Hz)' },
            ftop: { type: 'double', label: 'High frequency (Hz)' }
        },

        optionalInputs: {
            despike: { type: 'boolean', label: 'Despike before processing', flag: '-despike' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            blur: { type: 'double', label: 'Spatial blur FWHM', flag: '-blur' },
            norm: { type: 'boolean', label: 'Normalize output', flag: '-norm' }
        },

        outputs: {
            filtered: { type: 'File', label: 'Bandpassed output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dBlurToFWHM': {
        id: '3dBlurToFWHM',
        cwlPath: 'cwl/afni/3dBlurToFWHM.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['blurred'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            FWHM: { type: 'double', label: 'Target 3D FWHM (mm)', flag: '-FWHM' },
            FWHMxy: { type: 'double', label: 'Target 2D FWHM (mm)', flag: '-FWHMxy' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            ACF: { type: 'boolean', label: 'Use ACF method', flag: '-ACF' }
        },

        outputs: {
            blurred: { type: 'File', label: 'Blurred output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dmerge': {
        id: '3dmerge',
        cwlPath: 'cwl/afni/3dmerge.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['merged'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            blur_fwhm: { type: 'double', label: 'Gaussian blur FWHM', flag: '-1blur_fwhm' },
            clust: { type: 'string', label: 'Cluster parameters (rmm vmul)', flag: '-1clust' },
            noneg: { type: 'boolean', label: 'Zero out negative values', flag: '-1noneg' },
            doall: { type: 'boolean', label: 'Apply to all sub-bricks', flag: '-doall' }
        },

        outputs: {
            merged: { type: 'File', label: 'Merged output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dAllineate': {
        id: '3dAllineate',
        cwlPath: 'cwl/afni/3dAllineate.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['aligned'],

        requiredInputs: {
            source: { type: 'File', passthrough: true, label: 'Source dataset' },
            base: { type: 'File', label: 'Base/reference dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            cost: { type: 'string', label: 'Cost function', flag: '-cost', options: ['ls', 'mi', 'crM', 'nmi', 'hel', 'lpc'] },
            warp: { type: 'string', label: 'Warp type', flag: '-warp', options: ['shift_only', 'shift_rotate', 'shift_rotate_scale', 'affine_general'] },
            interp: { type: 'string', label: 'Interpolation', flag: '-interp', options: ['NN', 'linear', 'cubic', 'quintic'] },
            oned_matrix_save: { type: 'string', label: 'Save transformation matrix', flag: '-1Dmatrix_save' },
            autoweight: { type: 'boolean', label: 'Auto-compute weights', flag: '-autoweight' }
        },

        outputs: {
            aligned: { type: 'File', label: 'Aligned output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            matrix: { type: 'File?', label: 'Transformation matrix', glob: ['$(inputs.oned_matrix_save)'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dQwarp': {
        id: '3dQwarp',
        cwlPath: 'cwl/afni/3dQwarp.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['warped'],

        requiredInputs: {
            source: { type: 'File', passthrough: true, label: 'Source dataset' },
            base: { type: 'File', label: 'Base/template dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            allineate: { type: 'boolean', label: 'Affine alignment first', flag: '-allineate' },
            blur: { type: 'string', label: 'Blur amount (voxels)', flag: '-blur' },
            minpatch: { type: 'int', label: 'Minimum patch size', flag: '-minpatch' },
            iwarp: { type: 'boolean', label: 'Compute inverse warp', flag: '-iwarp' }
        },

        outputs: {
            warped: { type: 'File?', label: 'Warped output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            warp: { type: 'File?', label: 'Warp field', glob: ['$(inputs.prefix)_WARP+orig.*', '$(inputs.prefix)_WARP+tlrc.*', '$(inputs.prefix)_WARP.nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dUnifize': {
        id: '3dUnifize',
        cwlPath: 'cwl/afni/3dUnifize.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['unifized'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            T2: { type: 'boolean', label: 'Process as T2-weighted', flag: '-T2' },
            EPI: { type: 'boolean', label: 'Process EPI time series', flag: '-EPI' },
            GM: { type: 'boolean', label: 'Unifize gray matter', flag: '-GM' }
        },

        outputs: {
            unifized: { type: 'File', label: 'Unifized output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dAutomask': {
        id: '3dAutomask',
        cwlPath: 'cwl/afni/3dAutomask.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['mask'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output mask prefix' }
        },

        optionalInputs: {
            clfrac: { type: 'double', label: 'Clip level fraction', flag: '-clfrac', bounds: [0.1, 0.9] },
            dilate: { type: 'int', label: 'Dilate mask N times', flag: '-dilate' },
            erode: { type: 'int', label: 'Erode mask N times', flag: '-erode' },
            peels: { type: 'int', label: 'Erode then dilate N times', flag: '-peels' }
        },

        outputs: {
            mask: { type: 'File', label: 'Output mask', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dTcat': {
        id: '3dTcat',
        cwlPath: 'cwl/afni/3dTcat.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['concatenated'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset(s)' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            rlt: { type: 'boolean', label: 'Remove linear trends', flag: '-rlt' },
            tr: { type: 'double', label: 'TR in seconds', flag: '-tr' },
            verb: { type: 'boolean', label: 'Verbose output', flag: '-verb' }
        },

        outputs: {
            concatenated: { type: 'File', label: 'Concatenated output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '@auto_tlrc': {
        id: '@auto_tlrc',
        cwlPath: 'cwl/afni/auto_tlrc.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['tlrc_anat'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input anatomical' },
            base: { type: 'File', label: 'Template in standard space' }
        },

        optionalInputs: {
            no_ss: { type: 'boolean', label: 'Do not skull strip', flag: '-no_ss' },
            warp_orig_vol: { type: 'boolean', label: 'Warp original volume (preserve skull)', flag: '-warp_orig_vol' },
            dxyz: { type: 'double', label: 'Cubic voxel size (mm)', flag: '-dxyz' },
            dx: { type: 'double', label: 'X voxel dimension (mm)', flag: '-dx' },
            dy: { type: 'double', label: 'Y voxel dimension (mm)', flag: '-dy' },
            dz: { type: 'double', label: 'Z voxel dimension (mm)', flag: '-dz' },
            pad_base: { type: 'double', label: 'Padding in mm', flag: '-pad_base' },
            xform: { type: 'string', label: 'Warp type', flag: '-xform', options: ['affine_general', 'shift_rotate_scale'] },
            suffix: { type: 'string', label: 'Output suffix', flag: '-suffix' },
            init_xform: { type: 'File', label: 'Initial affine transform', flag: '-init_xform' },
            maxite: { type: 'int', label: 'Max iterations', flag: '-maxite' },
            use_3dAllineate: { type: 'boolean', label: 'Use 3dAllineate', flag: '-3dAllineate' },
            apar: { type: 'File', label: 'Reference anatomical for transform', flag: '-apar' },
            onewarp: { type: 'boolean', label: 'Single interpolation', flag: '-onewarp' },
            twowarp: { type: 'boolean', label: 'Dual interpolation', flag: '-twowarp' },
            overwrite: { type: 'boolean', label: 'Overwrite existing', flag: '-overwrite' }
        },

        outputs: {
            tlrc_anat: { type: 'File', label: 'TLRC-aligned anatomical', glob: ['*+orig.*', '*+tlrc.*', '*.nii*'] },
            transform: { type: 'File?', label: 'Transform file', glob: ['*.Xat.1D'] },
            log: { type: 'File?', label: 'Log file', glob: ['*.log'] }
        }
    },

    '@SSwarper': {
        id: '@SSwarper',
        cwlPath: 'cwl/afni/SSwarper.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['skull_stripped', 'warped'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input anatomical' },
            base: { type: 'File', label: 'Base template' },
            subid: { type: 'string', label: 'Subject ID' }
        },

        optionalInputs: {
            odir: { type: 'string', label: 'Output directory', flag: '-odir' },
            minp: { type: 'int', label: 'Minimum patch size', flag: '-minp' },
            giant_move: { type: 'boolean', label: 'Large movement alignment', flag: '-giant_move' }
        },

        outputs: {
            skull_stripped: { type: 'File', label: 'Skull-stripped output', glob: ['anatSS.$(inputs.subid)+orig.*', 'anatSS.$(inputs.subid)+tlrc.*', 'anatSS.$(inputs.subid).nii*'] },
            warped: { type: 'File', label: 'Warped to template', glob: ['anatQQ.$(inputs.subid)+orig.*', 'anatQQ.$(inputs.subid)+tlrc.*', 'anatQQ.$(inputs.subid).nii*'] },
            warp: { type: 'File', label: 'Warp field', glob: ['anatQQ.$(inputs.subid)_WARP+orig.*', 'anatQQ.$(inputs.subid)_WARP+tlrc.*', 'anatQQ.$(inputs.subid)_WARP.nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.subid)_SSwarper.log'] }
        }
    },

    'align_epi_anat': {
        id: 'align_epi_anat',
        cwlPath: 'cwl/afni/align_epi_anat.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['aligned_anat', 'aligned_epi'],

        requiredInputs: {
            epi: { type: 'File', passthrough: true, label: 'EPI dataset' },
            anat: { type: 'File', label: 'Anatomical dataset' },
            epi_base: { type: 'string', label: 'EPI base (0/mean/median)' }
        },

        optionalInputs: {
            anat2epi: { type: 'boolean', label: 'Align anat to EPI', flag: '-anat2epi' },
            epi2anat: { type: 'boolean', label: 'Align EPI to anat', flag: '-epi2anat' },
            giant_move: { type: 'boolean', label: 'Large movement', flag: '-giant_move' },
            cost: { type: 'string', label: 'Cost function', flag: '-cost' }
        },

        outputs: {
            aligned_anat: { type: 'File?', label: 'Aligned anatomical', glob: ['*_al+orig.*', '*_al+tlrc.*', '*_al.nii*'] },
            aligned_epi: { type: 'File?', label: 'Aligned EPI', glob: ['*_al_reg+orig.*', '*_al_reg+tlrc.*', '*_al_reg.nii*'] },
            transform_matrix: { type: 'File?', label: 'Transform matrix', glob: ['*.aff12.1D'] },
            log: { type: 'File', label: 'Log file', glob: ['align_epi_anat.log'] }
        }
    },

    // ==================== AFNI STATISTICAL TOOLS ====================

    '3dDeconvolve': {
        id: '3dDeconvolve',
        cwlPath: 'cwl/afni/3dDeconvolve.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            bucket: { type: 'string', label: 'Output bucket prefix' }
        },

        optionalInputs: {
            polort: { type: 'string', label: 'Polynomial baseline order', flag: '-polort' },
            num_stimts: { type: 'int', label: 'Number of stimulus regressors', flag: '-num_stimts' },
            fout: { type: 'boolean', label: 'Output F-statistics', flag: '-fout' },
            tout: { type: 'boolean', label: 'Output t-statistics', flag: '-tout' },
            x1D: { type: 'string', label: 'Save design matrix', flag: '-x1D' },
            jobs: { type: 'int', label: 'Number of parallel jobs', flag: '-jobs' }
        },

        outputs: {
            stats: { type: 'File', label: 'Statistics output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket)+tlrc.*', '$(inputs.bucket).nii*'] },
            design_matrix: { type: 'File?', label: 'Design matrix', glob: ['$(inputs.x1D)'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.bucket).log'] }
        }
    },

    '3dREMLfit': {
        id: '3dREMLfit',
        cwlPath: 'cwl/afni/3dREMLfit.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input time series' },
            matrix: { type: 'File', label: 'Design matrix (.xmat.1D)' },
            Rbuck: { type: 'string', label: 'Output bucket prefix' }
        },

        optionalInputs: {
            fout: { type: 'boolean', label: 'Output F-statistics', flag: '-fout' },
            tout: { type: 'boolean', label: 'Output t-statistics', flag: '-tout' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            verb: { type: 'boolean', label: 'Verbose output', flag: '-verb' }
        },

        outputs: {
            stats: { type: 'File', label: 'REML statistics', glob: ['$(inputs.Rbuck)+orig.*', '$(inputs.Rbuck)+tlrc.*', '$(inputs.Rbuck).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.Rbuck).log'] }
        }
    },

    '3dttest++': {
        id: '3dttest++',
        cwlPath: 'cwl/afni/3dttest++.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            setA: { type: 'File', passthrough: true, label: 'Primary sample set' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            setB: { type: 'File', label: 'Secondary sample set', flag: '-setB' },
            paired: { type: 'boolean', label: 'Paired t-test', flag: '-paired' },
            unpooled: { type: 'boolean', label: 'Unpooled variance', flag: '-unpooled' },
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            Clustsim: { type: 'int', label: 'Run cluster simulation', flag: '-Clustsim' }
        },

        outputs: {
            stats: { type: 'File', label: 'T-test output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dANOVA': {
        id: '3dANOVA',
        cwlPath: 'cwl/afni/3dANOVA.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            levels: { type: 'int', label: 'Number of factor levels' },
            bucket: { type: 'string', label: 'Output bucket prefix' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            ftr: { type: 'string', label: 'F-statistic output', flag: '-ftr' }
        },

        outputs: {
            stats: { type: 'File', label: 'ANOVA output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket)+tlrc.*', '$(inputs.bucket).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.bucket).log'] }
        }
    },

    '3dANOVA2': {
        id: '3dANOVA2',
        cwlPath: 'cwl/afni/3dANOVA2.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            type: { type: 'int', label: 'ANOVA model type (1-3)' },
            alevels: { type: 'int', label: 'Factor A levels' },
            blevels: { type: 'int', label: 'Factor B levels' },
            bucket: { type: 'string', label: 'Output bucket prefix' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' }
        },

        outputs: {
            stats: { type: 'File', label: 'ANOVA2 output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket)+tlrc.*', '$(inputs.bucket).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.bucket).log'] }
        }
    },

    '3dANOVA3': {
        id: '3dANOVA3',
        cwlPath: 'cwl/afni/3dANOVA3.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            type: { type: 'int', label: 'ANOVA model type (1-5)' },
            alevels: { type: 'int', label: 'Factor A levels' },
            blevels: { type: 'int', label: 'Factor B levels' },
            clevels: { type: 'int', label: 'Factor C levels' },
            bucket: { type: 'string', label: 'Output bucket prefix' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' }
        },

        outputs: {
            stats: { type: 'File', label: 'ANOVA3 output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket)+tlrc.*', '$(inputs.bucket).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.bucket).log'] }
        }
    },

    '3dClustSim': {
        id: '3dClustSim',
        cwlPath: 'cwl/afni/3dClustSim.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['clustsim_1D'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            acf: { type: 'string', label: 'ACF parameters (a b c)', flag: '-acf' },
            iter: { type: 'int', label: 'Number of iterations', flag: '-iter' },
            pthr: { type: 'string', label: 'P-value thresholds', flag: '-pthr' }
        },

        outputs: {
            clustsim_1D: { type: 'File?', label: 'Cluster simulation results', glob: ['$(inputs.prefix).NN*.1D'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dFWHMx': {
        id: '3dFWHMx',
        cwlPath: 'cwl/afni/3dFWHMx.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['fwhm_output'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            out: { type: 'string', label: 'Output file' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            acf: { type: 'string', label: 'ACF output file', flag: '-acf' },
            detrend: { type: 'int', label: 'Detrend order', flag: '-detrend' }
        },

        outputs: {
            fwhm_output: { type: 'File', label: 'FWHM estimates', glob: ['$(inputs.out)'] },
            acf_output: { type: 'File?', label: 'ACF parameters', glob: ['$(inputs.acf)'] },
            log: { type: 'File', label: 'Log file', glob: ['3dFWHMx.log'] }
        }
    },

    '3dMEMA': {
        id: '3dMEMA',
        cwlPath: 'cwl/afni/3dMEMA.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            HKtest: { type: 'boolean', label: 'Hartung-Knapp adjustment', flag: '-HKtest' },
            jobs: { type: 'int', label: 'Parallel processors', flag: '-jobs' }
        },

        outputs: {
            stats: { type: 'File', label: 'MEMA output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dMVM': {
        id: '3dMVM',
        cwlPath: 'cwl/afni/3dMVM.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' },
            dataTable: { type: 'File', label: 'Data table file' }
        },

        optionalInputs: {
            bsVars: { type: 'string', label: 'Between-subjects formula', flag: '-bsVars' },
            wsVars: { type: 'string', label: 'Within-subject formula', flag: '-wsVars' },
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            jobs: { type: 'int', label: 'Parallel processors', flag: '-jobs' }
        },

        outputs: {
            stats: { type: 'File', label: 'MVM output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dLME': {
        id: '3dLME',
        cwlPath: 'cwl/afni/3dLME.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' },
            dataTable: { type: 'File', label: 'Data table file' },
            model: { type: 'string', label: 'Fixed effects formula' },
            ranEff: { type: 'string', label: 'Random effects formula' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            jobs: { type: 'int', label: 'Parallel processors', flag: '-jobs' },
            ICC: { type: 'boolean', label: 'Compute ICC', flag: '-ICC' }
        },

        outputs: {
            stats: { type: 'File', label: 'LME output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dLMEr': {
        id: '3dLMEr',
        cwlPath: 'cwl/afni/3dLMEr.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' },
            dataTable: { type: 'File', label: 'Data table file' },
            model: { type: 'string', label: 'Model formula (R lmer syntax)' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            jobs: { type: 'int', label: 'Parallel processors', flag: '-jobs' }
        },

        outputs: {
            stats: { type: 'File', label: 'LMEr output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    // ==================== AFNI CONNECTIVITY TOOLS ====================

    '3dNetCorr': {
        id: '3dNetCorr',
        cwlPath: 'cwl/afni/3dNetCorr.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['correlation_matrix'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' },
            inset: { type: 'File', passthrough: true, label: 'Input 4D time series' },
            in_rois: { type: 'File', label: 'ROI mask with labels' }
        },

        optionalInputs: {
            fish_z: { type: 'boolean', label: 'Fisher Z-transform', flag: '-fish_z' },
            ts_out: { type: 'boolean', label: 'Output time series', flag: '-ts_out' },
            ts_wb_corr: { type: 'boolean', label: 'Whole brain correlation maps', flag: '-ts_wb_corr' }
        },

        outputs: {
            correlation_matrix: { type: 'File', label: 'Correlation matrix', glob: ['$(inputs.prefix)_000.netcc'] },
            time_series: { type: 'File?', label: 'ROI time series', glob: ['$(inputs.prefix)_000.netts'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dTcorr1D': {
        id: '3dTcorr1D',
        cwlPath: 'cwl/afni/3dTcorr1D.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['correlation'],

        requiredInputs: {
            xset: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            y1D: { type: 'File', label: '1D reference time series' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            pearson: { type: 'boolean', label: 'Pearson correlation', flag: '-pearson' },
            spearman: { type: 'boolean', label: 'Spearman correlation', flag: '-spearman' },
            Fisher: { type: 'boolean', label: 'Fisher Z-transform', flag: '-Fisher' }
        },

        outputs: {
            correlation: { type: 'File', label: 'Correlation output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dTcorrMap': {
        id: '3dTcorrMap',
        cwlPath: 'cwl/afni/3dTcorrMap.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['mean_corr'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' }
        },

        optionalInputs: {
            Mean: { type: 'string', label: 'Mean correlation output', flag: '-Mean' },
            Zmean: { type: 'string', label: 'Fisher Z mean output', flag: '-Zmean' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            polort: { type: 'int', label: 'Polynomial detrend order', flag: '-polort' }
        },

        outputs: {
            mean_corr: { type: 'File?', label: 'Mean correlation', glob: ['$(inputs.Mean)+orig.*', '$(inputs.Mean)+tlrc.*', '$(inputs.Mean).nii*'] },
            zmean_corr: { type: 'File?', label: 'Fisher Z mean', glob: ['$(inputs.Zmean)+orig.*', '$(inputs.Zmean)+tlrc.*', '$(inputs.Zmean).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['3dTcorrMap.log'] }
        }
    },

    '3dRSFC': {
        id: '3dRSFC',
        cwlPath: 'cwl/afni/3dRSFC.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['filtered'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            prefix: { type: 'string', label: 'Output prefix' },
            fbot: { type: 'double', label: 'Low frequency (Hz)' },
            ftop: { type: 'double', label: 'High frequency (Hz)' }
        },

        optionalInputs: {
            despike: { type: 'boolean', label: 'Despike first', flag: '-despike' },
            automask: { type: 'boolean', label: 'Auto-generate mask', flag: '-automask' },
            no_rsfa: { type: 'boolean', label: 'Skip RSFA calculation', flag: '-no_rsfa' }
        },

        outputs: {
            filtered: { type: 'File', label: 'Bandpassed output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            alff: { type: 'File?', label: 'ALFF output', glob: ['$(inputs.prefix)_ALFF*'] },
            falff: { type: 'File?', label: 'fALFF output', glob: ['$(inputs.prefix)_fALFF*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    // ==================== AFNI ROI/PARCELLATION TOOLS ====================

    '3dROIstats': {
        id: '3dROIstats',
        cwlPath: 'cwl/afni/3dROIstats.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            mask: { type: 'File', label: 'ROI mask' }
        },

        optionalInputs: {
            nzmean: { type: 'boolean', label: 'Non-zero mean', flag: '-nzmean' },
            sigma: { type: 'boolean', label: 'Standard deviation', flag: '-sigma' },
            median: { type: 'boolean', label: 'Median', flag: '-median' },
            quiet: { type: 'boolean', label: 'Suppress labels', flag: '-quiet' }
        },

        outputs: {
            stats: { type: 'stdout', label: 'ROI statistics' },
            log: { type: 'File', label: 'Log file', glob: ['3dROIstats.log'] }
        }
    },

    '3dmaskave': {
        id: '3dmaskave',
        cwlPath: 'cwl/afni/3dmaskave.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['average'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Mask dataset', flag: '-mask' },
            sigma: { type: 'boolean', label: 'Compute std dev', flag: '-sigma' },
            median: { type: 'boolean', label: 'Compute median', flag: '-median' },
            quiet: { type: 'boolean', label: 'Minimal output', flag: '-quiet' }
        },

        outputs: {
            average: { type: 'stdout', label: 'Average values' },
            log: { type: 'File', label: 'Log file', glob: ['3dmaskave.log'] }
        }
    },

    '3dUndump': {
        id: '3dUndump',
        cwlPath: 'cwl/afni/3dUndump.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['dataset'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Coordinate text file' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            master: { type: 'File', label: 'Master grid dataset', flag: '-master' },
            dimen: { type: 'string', label: 'Output dimensions (I J K)', flag: '-dimen' },
            datum: { type: 'string', label: 'Data type', flag: '-datum', options: ['byte', 'short', 'float'] },
            srad: { type: 'double', label: 'Sphere radius', flag: '-srad' }
        },

        outputs: {
            dataset: { type: 'File', label: 'Output dataset', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    'whereami': {
        id: 'whereami',
        cwlPath: 'cwl/afni/whereami.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['output'],

        requiredInputs: {},

        optionalInputs: {
            coord: { type: 'string', label: 'Coordinates (x y z)' },
            coord_file: { type: 'File', label: 'Coordinate file', flag: '-coord_file' },
            atlas: { type: 'string', label: 'Atlas to use', flag: '-atlas' },
            space: { type: 'string', label: 'Template space', flag: '-space' }
        },

        outputs: {
            output: { type: 'stdout', label: 'Location information' },
            log: { type: 'File', label: 'Log file', glob: ['whereami.log'] }
        }
    },

    '3dresample': {
        id: '3dresample',
        cwlPath: 'cwl/afni/3dresample.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['resampled'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            master: { type: 'File', label: 'Master grid dataset', flag: '-master' },
            dxyz: { type: 'string', label: 'New voxel dimensions (dx dy dz)', flag: '-dxyz' },
            orient: { type: 'string', label: 'New orientation', flag: '-orient' },
            rmode: { type: 'string', label: 'Resampling mode', flag: '-rmode', options: ['NN', 'Li', 'Cu', 'Bk'] }
        },

        outputs: {
            resampled: { type: 'File', label: 'Resampled output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dfractionize': {
        id: '3dfractionize',
        cwlPath: 'cwl/afni/3dfractionize.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['fractionized'],

        requiredInputs: {
            template: { type: 'File', label: 'Template defining output grid' },
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            clip: { type: 'double', label: 'Occupancy threshold', flag: '-clip' },
            preserve: { type: 'boolean', label: 'Preserve input values', flag: '-preserve' }
        },

        outputs: {
            fractionized: { type: 'File', label: 'Fractionized output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    // ==================== AFNI UTILITY TOOLS ====================

    '3dcalc': {
        id: '3dcalc',
        cwlPath: 'cwl/afni/3dcalc.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['result'],

        requiredInputs: {
            a: { type: 'File', passthrough: true, label: 'Input dataset a' },
            expr: { type: 'string', label: 'Mathematical expression' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            b: { type: 'File', label: 'Input dataset b', flag: '-b' },
            c: { type: 'File', label: 'Input dataset c', flag: '-c' },
            datum: { type: 'string', label: 'Output data type', flag: '-datum', options: ['byte', 'short', 'float'] }
        },

        outputs: {
            result: { type: 'File', label: 'Calculated output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dTstat': {
        id: '3dTstat',
        cwlPath: 'cwl/afni/3dTstat.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['stats'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input 3D+time dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            mean: { type: 'boolean', label: 'Compute mean', flag: '-mean' },
            stdev: { type: 'boolean', label: 'Compute std dev', flag: '-stdev' },
            min: { type: 'boolean', label: 'Compute minimum', flag: '-min' },
            max: { type: 'boolean', label: 'Compute maximum', flag: '-max' },
            median: { type: 'boolean', label: 'Compute median', flag: '-median' },
            tsnr: { type: 'boolean', label: 'Compute TSNR', flag: '-tsnr' }
        },

        outputs: {
            stats: { type: 'File', label: 'Statistics output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dinfo': {
        id: '3dinfo',
        cwlPath: 'cwl/afni/3dinfo.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['info'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' }
        },

        optionalInputs: {
            verb: { type: 'boolean', label: 'Verbose output', flag: '-verb' },
            prefix: { type: 'boolean', label: 'Show prefix', flag: '-prefix' },
            space: { type: 'boolean', label: 'Show space', flag: '-space' },
            tr: { type: 'boolean', label: 'Show TR', flag: '-tr' }
        },

        outputs: {
            info: { type: 'stdout', label: 'Dataset information' },
            log: { type: 'File', label: 'Log file', glob: ['3dinfo.log'] }
        }
    },

    '3dcopy': {
        id: '3dcopy',
        cwlPath: 'cwl/afni/3dcopy.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['copied'],

        requiredInputs: {
            old_dataset: { type: 'File', passthrough: true, label: 'Source dataset' },
            new_prefix: { type: 'string', label: 'New prefix' }
        },

        optionalInputs: {
            verb: { type: 'boolean', label: 'Verbose', flag: '-verb' },
            denote: { type: 'boolean', label: 'Remove notes', flag: '-denote' }
        },

        outputs: {
            copied: { type: 'File', label: 'Copied dataset', glob: ['$(inputs.new_prefix)+orig.*', '$(inputs.new_prefix)+tlrc.*', '$(inputs.new_prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.new_prefix).log'] }
        }
    },

    '3dZeropad': {
        id: '3dZeropad',
        cwlPath: 'cwl/afni/3dZeropad.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['padded'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            I: { type: 'int', label: 'Inferior padding', flag: '-I' },
            S: { type: 'int', label: 'Superior padding', flag: '-S' },
            A: { type: 'int', label: 'Anterior padding', flag: '-A' },
            P: { type: 'int', label: 'Posterior padding', flag: '-P' },
            L: { type: 'int', label: 'Left padding', flag: '-L' },
            R: { type: 'int', label: 'Right padding', flag: '-R' },
            master: { type: 'File', label: 'Master grid', flag: '-master' }
        },

        outputs: {
            padded: { type: 'File', label: 'Padded output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dNwarpApply': {
        id: '3dNwarpApply',
        cwlPath: 'cwl/afni/3dNwarpApply.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['warped'],

        requiredInputs: {
            nwarp: { type: 'string', label: '3D warp dataset(s)' },
            source: { type: 'File', passthrough: true, label: 'Source dataset' },
            prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            master: { type: 'string', label: 'Master grid', flag: '-master' },
            iwarp: { type: 'boolean', label: 'Invert warp', flag: '-iwarp' },
            interp: { type: 'string', label: 'Interpolation', flag: '-interp', options: ['NN', 'linear', 'cubic', 'quintic', 'wsinc5'] }
        },

        outputs: {
            warped: { type: 'File', label: 'Warped output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    '3dNwarpCat': {
        id: '3dNwarpCat',
        cwlPath: 'cwl/afni/3dNwarpCat.cwl',
        dockerImage: DOCKER_IMAGES.afni,
        primaryOutputs: ['concatenated_warp'],

        requiredInputs: {
            prefix: { type: 'string', label: 'Output prefix' },
            warp1: { type: 'File', passthrough: true, label: 'First warp' }
        },

        optionalInputs: {
            warp2: { type: 'File', label: 'Second warp', flag: '-warp2' },
            warp3: { type: 'File', label: 'Third warp', flag: '-warp3' },
            iwarp: { type: 'boolean', label: 'Invert output', flag: '-iwarp' },
            interp: { type: 'string', label: 'Interpolation', flag: '-interp', options: ['linear', 'quintic', 'wsinc5'] }
        },

        outputs: {
            concatenated_warp: { type: 'File', label: 'Combined warp', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix)+tlrc.*', '$(inputs.prefix).nii*'] },
            log: { type: 'File', label: 'Log file', glob: ['$(inputs.prefix).log'] }
        }
    },

    // ====================================
    // FreeSurfer Tools - Surface Reconstruction
    // ====================================

    'mri_convert': {
        id: 'mri_convert',
        cwlPath: 'cwl/freesurfer/mri_convert.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['converted'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input volume file', acceptedExtensions: ['.nii', '.nii.gz', '.mgz', '.mgh'] },
            output: { type: 'string', label: 'Output filename' }
        },

        optionalInputs: {
            in_type: { type: 'string', label: 'Input file format', flag: '--in_type' },
            out_type: { type: 'string', label: 'Output file format', flag: '--out_type' },
            conform: { type: 'boolean', label: 'Conform to 1mm voxel size', flag: '--conform' },
            conform_min: { type: 'boolean', label: 'Conform to minimum voxel size', flag: '--conform_min' },
            conform_size: { type: 'double', label: 'Conform to specified voxel size (mm)', flag: '--conform_size' },
            vox_size: { type: 'string', label: 'Output voxel size (x y z)', flag: '--voxsize' },
            out_orientation: { type: 'string', label: 'Output orientation (e.g., RAS)', flag: '--out_orientation' },
            resample_type: { type: 'string', label: 'Interpolation method', flag: '--resample_type', options: ['interpolate', 'weighted', 'nearest', 'sinc', 'cubic'] },
            reslice_like: { type: 'File', label: 'Reslice to match template', flag: '--reslice_like' },
            apply_transform: { type: 'File', label: 'Apply transformation', flag: '--apply_transform' },
            frame: { type: 'int', label: 'Keep specified frame', flag: '--frame' },
            fwhm: { type: 'double', label: 'Smooth by FWHM (mm)', flag: '--fwhm' }
        },

        outputs: {
            converted: { type: 'File', label: 'Converted volume', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_convert.log'] }
        }
    },

    'mri_watershed': {
        id: 'mri_watershed',
        cwlPath: 'cwl/freesurfer/mri_watershed.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['brain'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input T1 volume' },
            output: { type: 'string', label: 'Output brain volume filename' }
        },

        optionalInputs: {
            atlas: { type: 'boolean', label: 'Apply atlas correction', flag: '-atlas' },
            preflooding_height: { type: 'int', label: 'Preflooding height (%)', flag: '-h' },
            watershed_weight: { type: 'double', label: 'Preweight using atlas', flag: '-w' },
            less: { type: 'boolean', label: 'Shrink surface (less skull)', flag: '-less' },
            more: { type: 'boolean', label: 'Expand surface (more skull)', flag: '-more' },
            threshold: { type: 'int', label: 'Adjust watershed threshold', flag: '-t' },
            t1: { type: 'boolean', label: 'Specify T1 input', flag: '-T1' },
            surf: { type: 'string', label: 'Save BEM surfaces directory', flag: '-surf' }
        },

        outputs: {
            brain: { type: 'File', label: 'Brain volume', glob: ['$(inputs.output)*'] },
            bem_surfaces: { type: 'Directory', label: 'BEM surfaces', glob: ['$(inputs.surf)'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_watershed.log'] }
        }
    },

    'mri_normalize': {
        id: 'mri_normalize',
        cwlPath: 'cwl/freesurfer/mri_normalize.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['normalized'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input volume' },
            output: { type: 'string', label: 'Output normalized volume' }
        },

        optionalInputs: {
            gradient: { type: 'double', label: 'Max intensity/mm gradient', flag: '-g' },
            niters: { type: 'int', label: 'Number of iterations', flag: '-n' },
            mask: { type: 'File', label: 'Input mask file', flag: '-mask' },
            noskull: { type: 'boolean', label: 'Do not normalize skull', flag: '-noskull' },
            aseg: { type: 'File', label: 'Segmentation for guidance', flag: '-aseg' },
            conform: { type: 'boolean', label: 'Conform to 256^3', flag: '-conform' },
            mprage: { type: 'boolean', label: 'Assume MPRAGE contrast', flag: '-mprage' }
        },

        outputs: {
            normalized: { type: 'File', label: 'Normalized volume', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_normalize.log'] }
        }
    },

    'mri_segment': {
        id: 'mri_segment',
        cwlPath: 'cwl/freesurfer/mri_segment.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['segmentation'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input normalized volume' },
            output: { type: 'string', label: 'Output segmentation filename' }
        },

        optionalInputs: {
            wlo: { type: 'double', label: 'WM low threshold', flag: '-wlo' },
            whi: { type: 'double', label: 'WM high threshold', flag: '-whi' },
            glo: { type: 'double', label: 'GM low threshold', flag: '-glo' },
            ghi: { type: 'double', label: 'GM high threshold', flag: '-ghi' },
            thicken: { type: 'int', label: 'Thicken option', flag: '-thicken' },
            mprage: { type: 'boolean', label: 'MPRAGE contrast', flag: '-mprage' }
        },

        outputs: {
            segmentation: { type: 'File', label: 'Segmentation volume', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_segment.log'] }
        }
    },

    'mris_inflate': {
        id: 'mris_inflate',
        cwlPath: 'cwl/freesurfer/mris_inflate.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['inflated'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input surface file' },
            output: { type: 'string', label: 'Output inflated surface' }
        },

        optionalInputs: {
            n: { type: 'int', label: 'Max iterations (default 10)', flag: '-n' },
            dist: { type: 'double', label: 'Distance for inflation', flag: '-dist' },
            no_save_sulc: { type: 'boolean', label: 'Do not save sulc file', flag: '-no-save-sulc' },
            sulc: { type: 'string', label: 'Output sulc filename', flag: '-sulc' }
        },

        outputs: {
            inflated: { type: 'File', label: 'Inflated surface', glob: ['$(inputs.output)*'] },
            sulc_file: { type: 'File', label: 'Sulc file', glob: ['*.sulc'] },
            log: { type: 'File', label: 'Log file', glob: ['mris_inflate.log'] }
        }
    },

    'mris_sphere': {
        id: 'mris_sphere',
        cwlPath: 'cwl/freesurfer/mris_sphere.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['sphere'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input inflated surface' },
            output: { type: 'string', label: 'Output spherical surface' }
        },

        optionalInputs: {
            seed: { type: 'int', label: 'Random seed', flag: '-seed' },
            niters: { type: 'int', label: 'Number of iterations', flag: '-i' },
            in_smoothwm: { type: 'File', label: 'Smooth WM reference', flag: '-w' }
        },

        outputs: {
            sphere: { type: 'File', label: 'Spherical surface', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mris_sphere.log'] }
        }
    },

    // ====================================
    // FreeSurfer Tools - Parcellation
    // ====================================

    'mri_aparc2aseg': {
        id: 'mri_aparc2aseg',
        cwlPath: 'cwl/freesurfer/mri_aparc2aseg.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['aparc_aseg'],

        requiredInputs: {
            subject: { type: 'string', label: 'Subject name' }
        },

        optionalInputs: {
            output: { type: 'string', label: 'Output volume filename', flag: '--o' },
            annot: { type: 'string', label: 'Parcellation name', flag: '--annot' },
            a2005s: { type: 'boolean', label: 'Use aparc.a2005s', flag: '--a2005s' },
            a2009s: { type: 'boolean', label: 'Use aparc.a2009s', flag: '--a2009s' },
            labelwm: { type: 'boolean', label: 'Also label white matter', flag: '--labelwm' },
            noribbon: { type: 'boolean', label: 'No ribbon constraint', flag: '--noribbon' }
        },

        outputs: {
            aparc_aseg: { type: 'File', label: 'Combined parcellation', glob: ['$(inputs.output)', '*aparc+aseg*.mgz'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_aparc2aseg.log'] }
        }
    },

    'mri_annotation2label': {
        id: 'mri_annotation2label',
        cwlPath: 'cwl/freesurfer/mri_annotation2label.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['labels'],

        requiredInputs: {
            subject: { type: 'string', label: 'Subject name' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' },
            outdir: { type: 'string', label: 'Output directory' }
        },

        optionalInputs: {
            annotation: { type: 'string', label: 'Annotation name', flag: '--annotation' },
            surface: { type: 'string', label: 'Surface name', flag: '--surface' },
            labelbase: { type: 'string', label: 'Label base name', flag: '--labelbase' }
        },

        outputs: {
            labels: { type: 'Directory', label: 'Label files directory', glob: ['$(inputs.outdir)'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_annotation2label.log'] }
        }
    },

    'mris_ca_label': {
        id: 'mris_ca_label',
        cwlPath: 'cwl/freesurfer/mris_ca_label.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['annotation'],

        requiredInputs: {
            subject: { type: 'string', label: 'Subject name' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' },
            canonsurf: { type: 'File', passthrough: true, label: 'Canonical surface' },
            classifier: { type: 'File', label: 'Atlas classifier (.gcs)' },
            output: { type: 'string', label: 'Output annotation filename' }
        },

        optionalInputs: {
            aseg: { type: 'File', label: 'Aseg volume', flag: '-aseg' },
            seed: { type: 'int', label: 'Random seed', flag: '-seed' },
            novar: { type: 'boolean', label: 'No variance', flag: '-novar' }
        },

        outputs: {
            annotation: { type: 'File', label: 'Annotation file', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mris_ca_label.log'] }
        }
    },

    'mri_label2vol': {
        id: 'mri_label2vol',
        cwlPath: 'cwl/freesurfer/mri_label2vol.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['label_volume'],

        requiredInputs: {
            temp: { type: 'File', passthrough: true, label: 'Template volume' },
            output: { type: 'string', label: 'Output volume filename' }
        },

        optionalInputs: {
            label: { type: 'File', label: 'Label file', flag: '--label' },
            annot: { type: 'File', label: 'Annotation file', flag: '--annot' },
            seg: { type: 'File', label: 'Segmentation file', flag: '--seg' },
            reg: { type: 'File', label: 'Registration file', flag: '--reg' },
            identity: { type: 'boolean', label: 'Use identity registration', flag: '--identity' },
            subject: { type: 'string', label: 'Subject name', flag: '--subject' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)', flag: '--hemi' },
            fill_thresh: { type: 'double', label: 'Fill threshold (0-1)', flag: '--fillthresh' }
        },

        outputs: {
            label_volume: { type: 'File', label: 'Label volume', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_label2vol.log'] }
        }
    },

    // ====================================
    // FreeSurfer Tools - Functional
    // ====================================

    'bbregister': {
        id: 'bbregister',
        cwlPath: 'cwl/freesurfer/bbregister.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['out_reg'],

        requiredInputs: {
            subject: { type: 'string', label: 'FreeSurfer subject name' },
            source_file: { type: 'File', passthrough: true, label: 'Source volume to register' },
            out_reg_file: { type: 'string', label: 'Output registration file' }
        },

        optionalInputs: {
            contrast_type: { type: 'string', label: 'Contrast type', options: ['t1', 't2', 'bold', 'dti'] },
            init: { type: 'string', label: 'Initialization method', flag: '--init', options: ['coreg', 'rr', 'spm', 'fsl', 'header', 'best'] },
            init_fsl: { type: 'boolean', label: 'Initialize with FSL', flag: '--init-fsl' },
            dof: { type: 'string', label: 'Degrees of freedom', flag: '--dof', options: ['6', '9', '12'] },
            lta: { type: 'boolean', label: 'Output as LTA format', flag: '--lta' },
            fslmat: { type: 'string', label: 'Output FSL matrix file', flag: '--fslmat' }
        },

        outputs: {
            out_reg: { type: 'File', label: 'Registration file', glob: ['$(inputs.out_reg_file)*'] },
            out_fsl_mat: { type: 'File', label: 'FSL matrix', glob: ['$(inputs.fslmat)'] },
            log: { type: 'File', label: 'Log file', glob: ['bbregister.log'] }
        }
    },

    'mri_vol2surf': {
        id: 'mri_vol2surf',
        cwlPath: 'cwl/freesurfer/mri_vol2surf.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['out_file'],

        requiredInputs: {
            source_file: { type: 'File', passthrough: true, label: 'Volume to sample' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' },
            output: { type: 'string', label: 'Output surface file' }
        },

        optionalInputs: {
            reg_file: { type: 'File', label: 'Registration file', flag: '--reg' },
            reg_header: { type: 'File', label: 'Header registration', flag: '--regheader' },
            subject: { type: 'string', label: 'Subject name', flag: '--s' },
            trgsubject: { type: 'string', label: 'Target subject', flag: '--trgsubject' },
            projfrac: { type: 'double', label: 'Projection fraction', flag: '--projfrac' },
            interp: { type: 'string', label: 'Interpolation', flag: '--interp', options: ['nearest', 'trilinear'] },
            surf: { type: 'string', label: 'Surface name', flag: '--surf' },
            cortex: { type: 'boolean', label: 'Use cortex label mask', flag: '--cortex' }
        },

        outputs: {
            out_file: { type: 'File', label: 'Surface data', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_vol2surf.log'] }
        }
    },

    'mri_surf2vol': {
        id: 'mri_surf2vol',
        cwlPath: 'cwl/freesurfer/mri_surf2vol.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['out_file'],

        requiredInputs: {
            source_file: { type: 'File', passthrough: true, label: 'Surface values file' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' },
            output: { type: 'string', label: 'Output volume filename' }
        },

        optionalInputs: {
            reg: { type: 'File', label: 'Registration file', flag: '--reg' },
            identity: { type: 'string', label: 'Subject for identity registration', flag: '--identity' },
            template: { type: 'File', label: 'Template volume', flag: '--template' },
            subject: { type: 'string', label: 'Subject name', flag: '--subject' },
            surf: { type: 'string', label: 'Surface name', flag: '--surf' },
            projfrac: { type: 'double', label: 'Projection fraction', flag: '--projfrac' },
            fillribbon: { type: 'boolean', label: 'Fill cortical ribbon', flag: '--fillribbon' }
        },

        outputs: {
            out_file: { type: 'File', label: 'Volume data', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_surf2vol.log'] }
        }
    },

    'mris_preproc': {
        id: 'mris_preproc',
        cwlPath: 'cwl/freesurfer/mris_preproc.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['out_file'],

        requiredInputs: {
            output: { type: 'string', label: 'Output concatenated file' },
            target: { type: 'string', label: 'Target subject (e.g., fsaverage)' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' }
        },

        optionalInputs: {
            fsgd: { type: 'File', label: 'FSGD file', flag: '--fsgd' },
            meas: { type: 'string', label: 'Surface measure', flag: '--meas' },
            fwhm: { type: 'double', label: 'Smooth on target (FWHM mm)', flag: '--fwhm' },
            fwhm_src: { type: 'double', label: 'Smooth on source (FWHM mm)', flag: '--fwhm-src' },
            cache_in: { type: 'string', label: 'Use qcache data', flag: '--cache-in' },
            paired_diff: { type: 'boolean', label: 'Compute paired differences', flag: '--paired-diff' },
            cortex: { type: 'boolean', label: 'Use cortex label mask', flag: '--cortex' }
        },

        outputs: {
            out_file: { type: 'File', label: 'Concatenated surface data', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['mris_preproc.log'] }
        }
    },

    'mri_glmfit': {
        id: 'mri_glmfit',
        cwlPath: 'cwl/freesurfer/mri_glmfit.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['glm_dir'],

        requiredInputs: {
            y: { type: 'File', passthrough: true, label: 'Input data file' },
            glmdir: { type: 'string', label: 'Output GLM directory' }
        },

        optionalInputs: {
            fsgd: { type: 'File', label: 'FSGD file', flag: '--fsgd' },
            design: { type: 'File', label: 'Design matrix', flag: '--X' },
            osgm: { type: 'boolean', label: 'One-sample group mean', flag: '--osgm' },
            surface: { type: 'string', label: 'Surface (subject hemi)', flag: '--surface' },
            cortex: { type: 'boolean', label: 'Use cortex label mask', flag: '--cortex' },
            fwhm: { type: 'double', label: 'Smooth input (FWHM mm)', flag: '--fwhm' },
            var_fwhm: { type: 'double', label: 'Smooth variance (FWHM mm)', flag: '--var-fwhm' },
            mask: { type: 'File', label: 'Mask volume', flag: '--mask' },
            save_eres: { type: 'boolean', label: 'Save residual error', flag: '--eres-save' },
            nii_gz: { type: 'boolean', label: 'Use compressed NIfTI', flag: '--nii.gz' }
        },

        outputs: {
            glm_dir: { type: 'Directory', label: 'GLM output directory', glob: ['$(inputs.glmdir)'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_glmfit.log'] }
        }
    },

    // ====================================
    // FreeSurfer Tools - Morphometry
    // ====================================

    'mris_anatomical_stats': {
        id: 'mris_anatomical_stats',
        cwlPath: 'cwl/freesurfer/mris_anatomical_stats.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['stats_table'],

        requiredInputs: {
            subject: { type: 'string', label: 'Subject name' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' }
        },

        optionalInputs: {
            annotation: { type: 'File', label: 'Annotation file', flag: '-a' },
            tablefile: { type: 'string', label: 'Output table filename', flag: '-f' },
            label: { type: 'File', label: 'Limit to label region', flag: '-l' },
            cortex: { type: 'File', label: 'Cortex label file', flag: '-cortex' },
            th3: { type: 'boolean', label: 'Use tetrahedra for volume', flag: '-th3' },
            b: { type: 'boolean', label: 'Report brain volume', flag: '-b' },
            mgz: { type: 'boolean', label: 'Use mgz format', flag: '-mgz' }
        },

        outputs: {
            stats_table: { type: 'File', label: 'Stats table', glob: ['$(inputs.tablefile)', '*.stats'] },
            log: { type: 'File', label: 'Log file', glob: ['mris_anatomical_stats.log'] }
        }
    },

    'mri_segstats': {
        id: 'mri_segstats',
        cwlPath: 'cwl/freesurfer/mri_segstats.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['summary'],

        requiredInputs: {
            seg: { type: 'File', passthrough: true, label: 'Segmentation volume' },
            sum: { type: 'string', label: 'Output summary file' }
        },

        optionalInputs: {
            in_file: { type: 'File', label: 'Input for intensity stats', flag: '--in' },
            ctab: { type: 'File', label: 'Color table file', flag: '--ctab' },
            ctab_default: { type: 'boolean', label: 'Use default color table', flag: '--ctab-default' },
            excludeid: { type: 'int', label: 'Exclude segmentation ID', flag: '--excludeid' },
            nonempty: { type: 'boolean', label: 'Only non-empty segments', flag: '--nonempty' },
            mask: { type: 'File', label: 'Mask volume', flag: '--mask' },
            subject: { type: 'string', label: 'Subject name', flag: '--subject' },
            brain_vol_from_seg: { type: 'boolean', label: 'Brain volume from seg', flag: '--brain-vol-from-seg' }
        },

        outputs: {
            summary: { type: 'File', label: 'Summary file', glob: ['$(inputs.sum)'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_segstats.log'] }
        }
    },

    'aparcstats2table': {
        id: 'aparcstats2table',
        cwlPath: 'cwl/freesurfer/aparcstats2table.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['table'],

        requiredInputs: {
            subjects: { type: 'string[]', label: 'List of subject names' },
            hemi: { type: 'string', label: 'Hemisphere (lh/rh)' },
            tablefile: { type: 'string', label: 'Output table filename' }
        },

        optionalInputs: {
            parc: { type: 'string', label: 'Parcellation name', flag: '--parc' },
            meas: { type: 'string', label: 'Measurement', flag: '--meas', options: ['area', 'volume', 'thickness', 'thicknessstd', 'meancurv', 'gauscurv', 'foldind', 'curvind'] },
            delimiter: { type: 'string', label: 'Delimiter', flag: '--delimiter', options: ['tab', 'comma', 'space', 'semicolon'] },
            skip: { type: 'boolean', label: 'Skip missing subjects', flag: '--skip' },
            transpose: { type: 'boolean', label: 'Transpose table', flag: '--transpose' }
        },

        outputs: {
            table: { type: 'File', label: 'Stats table', glob: ['$(inputs.tablefile)'] },
            log: { type: 'File', label: 'Log file', glob: ['aparcstats2table.log'] }
        }
    },

    'asegstats2table': {
        id: 'asegstats2table',
        cwlPath: 'cwl/freesurfer/asegstats2table.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['table'],

        requiredInputs: {
            subjects: { type: 'string[]', label: 'List of subject names' },
            tablefile: { type: 'string', label: 'Output table filename' }
        },

        optionalInputs: {
            meas: { type: 'string', label: 'Measurement', flag: '--meas', options: ['volume', 'mean'] },
            statsfile: { type: 'string', label: 'Stats file name', flag: '--statsfile' },
            delimiter: { type: 'string', label: 'Delimiter', flag: '--delimiter', options: ['tab', 'comma', 'space', 'semicolon'] },
            skip: { type: 'boolean', label: 'Skip missing subjects', flag: '--skip' },
            all_segs: { type: 'boolean', label: 'Include all segments', flag: '--all-segs' },
            transpose: { type: 'boolean', label: 'Transpose table', flag: '--transpose' },
            etiv: { type: 'boolean', label: 'Include eTIV', flag: '--etiv' }
        },

        outputs: {
            table: { type: 'File', label: 'Stats table', glob: ['$(inputs.tablefile)'] },
            log: { type: 'File', label: 'Log file', glob: ['asegstats2table.log'] }
        }
    },

    // ====================================
    // FreeSurfer Tools - Diffusion
    // ====================================

    'dmri_postreg': {
        id: 'dmri_postreg',
        cwlPath: 'cwl/freesurfer/dmri_postreg.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['out_file'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input diffusion volume' },
            output: { type: 'string', label: 'Output filename' }
        },

        optionalInputs: {
            reg: { type: 'File', label: 'Registration file', flag: '--reg' },
            xfm: { type: 'File', label: 'Transformation matrix', flag: '--xfm' },
            ref: { type: 'File', label: 'Reference volume', flag: '--ref' },
            mask: { type: 'File', label: 'Brain mask', flag: '--mask' },
            subject: { type: 'string', label: 'FreeSurfer subject', flag: '--s' },
            interp: { type: 'string', label: 'Interpolation', flag: '--interp', options: ['nearest', 'trilin', 'cubic'] }
        },

        outputs: {
            out_file: { type: 'File', label: 'Output volume', glob: ['$(inputs.output)*'] },
            log: { type: 'File', label: 'Log file', glob: ['dmri_postreg.log'] }
        }
    },

    // ====================================
    // ANTs Tools - Utilities
    // ====================================

    'N4BiasFieldCorrection': {
        id: 'N4BiasFieldCorrection',
        cwlPath: 'cwl/ants/N4BiasFieldCorrection.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['corrected_image'],

        requiredInputs: {
            input_image: { type: 'File', passthrough: true, label: 'Input image for bias correction', acceptedExtensions: ['.nii', '.nii.gz'] },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)', flag: '-d' },
            mask_image: { type: 'File', label: 'Mask image', flag: '-x' },
            weight_image: { type: 'File', label: 'Weight image', flag: '-w' },
            shrink_factor: { type: 'int', label: 'Shrink factor (1-4)', flag: '-s' },
            convergence: { type: 'string', label: 'Convergence [iters,thresh]', flag: '-c' },
            bspline_fitting: { type: 'string', label: 'B-spline [spacing,order]', flag: '-b' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            corrected_image: { type: 'File', label: 'Bias-corrected image', glob: ['$(inputs.output_prefix)_corrected.nii.gz'] },
            bias_field: { type: 'File', label: 'Bias field', glob: ['$(inputs.output_prefix)_biasfield.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['N4BiasFieldCorrection.log'] }
        }
    },

    'DenoiseImage': {
        id: 'DenoiseImage',
        cwlPath: 'cwl/ants/DenoiseImage.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['denoised_image'],

        requiredInputs: {
            input_image: { type: 'File', passthrough: true, label: 'Input image for denoising' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)', flag: '-d' },
            noise_model: { type: 'string', label: 'Noise model', flag: '-n', options: ['Rician', 'Gaussian'] },
            mask_image: { type: 'File', label: 'Mask image', flag: '-x' },
            shrink_factor: { type: 'int', label: 'Shrink factor', flag: '-s' },
            patch_radius: { type: 'string', label: 'Patch radius', flag: '-p' },
            search_radius: { type: 'string', label: 'Search radius', flag: '-r' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            denoised_image: { type: 'File', label: 'Denoised image', glob: ['$(inputs.output_prefix)_denoised.nii.gz'] },
            noise_image: { type: 'File', label: 'Noise image', glob: ['$(inputs.output_prefix)_noise.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['DenoiseImage.log'] }
        }
    },

    'ImageMath': {
        id: 'ImageMath',
        cwlPath: 'cwl/ants/ImageMath.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['output'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)' },
            output_image: { type: 'string', label: 'Output image filename' },
            operation: { type: 'string', label: 'Operation (m, +, -, /, G, MD, ME, etc.)' },
            input_image: { type: 'File', passthrough: true, label: 'Input image' }
        },

        optionalInputs: {
            second_input: { type: 'File', label: 'Second input image', flag: '' },
            scalar_value: { type: 'double', label: 'Scalar value', flag: '' }
        },

        outputs: {
            output: { type: 'File', label: 'Output image', glob: ['$(inputs.output_image)'] },
            log: { type: 'File', label: 'Log file', glob: ['ImageMath.log'] }
        }
    },

    'ThresholdImage': {
        id: 'ThresholdImage',
        cwlPath: 'cwl/ants/ThresholdImage.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['thresholded'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)' },
            input_image: { type: 'File', passthrough: true, label: 'Input image' },
            output_image: { type: 'string', label: 'Output image filename' }
        },

        optionalInputs: {
            threshold_mode: { type: 'string', label: 'Threshold mode', flag: '', options: ['Otsu', 'Kmeans'] },
            num_thresholds: { type: 'int', label: 'Number of thresholds', flag: '' },
            threshold_low: { type: 'double', label: 'Lower threshold', flag: '' },
            threshold_high: { type: 'double', label: 'Upper threshold', flag: '' },
            inside_value: { type: 'double', label: 'Inside value', flag: '' },
            outside_value: { type: 'double', label: 'Outside value', flag: '' }
        },

        outputs: {
            thresholded: { type: 'File', label: 'Thresholded image', glob: ['$(inputs.output_image)'] },
            log: { type: 'File', label: 'Log file', glob: ['ThresholdImage.log'] }
        }
    },

    'LabelGeometryMeasures': {
        id: 'LabelGeometryMeasures',
        cwlPath: 'cwl/ants/LabelGeometryMeasures.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['csv_output'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            label_image: { type: 'File', passthrough: true, label: 'Label/segmentation image' }
        },

        optionalInputs: {
            intensity_image: { type: 'File', label: 'Intensity image', flag: '' },
            output_csv: { type: 'string', label: 'Output CSV file', flag: '' }
        },

        outputs: {
            csv_output: { type: 'File', label: 'CSV measurements', glob: ['$(inputs.output_csv)'] },
            log: { type: 'File', label: 'Log file', glob: ['LabelGeometryMeasures.log'] }
        }
    },

    'antsJointLabelFusion.sh': {
        id: 'antsJointLabelFusion.sh',
        cwlPath: 'cwl/ants/antsJointLabelFusion.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['labeled_image'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            output_prefix: { type: 'string', label: 'Output prefix' },
            target_image: { type: 'File', passthrough: true, label: 'Target image to label' },
            atlas_images: { type: 'File[]', label: 'Atlas images' },
            atlas_labels: { type: 'File[]', label: 'Atlas label images' }
        },

        optionalInputs: {
            mask_image: { type: 'File', label: 'Mask image', flag: '-x' },
            num_threads: { type: 'int', label: 'Number of threads', flag: '-j' },
            search_radius: { type: 'string', label: 'Search radius', flag: '-s' },
            patch_radius: { type: 'string', label: 'Patch radius', flag: '-p' }
        },

        outputs: {
            labeled_image: { type: 'File', label: 'Labeled image', glob: ['$(inputs.output_prefix)Labels.nii.gz'] },
            intensity_fusion: { type: 'File', label: 'Intensity fusion', glob: ['$(inputs.output_prefix)Intensity.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsJointLabelFusion.log'] }
        }
    },

    // ====================================
    // ANTs Tools - Registration
    // ====================================

    'antsRegistration': {
        id: 'antsRegistration',
        cwlPath: 'cwl/ants/antsRegistration.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['warped_image', 'forward_transforms'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            output_prefix: { type: 'string', label: 'Output prefix' },
            fixed_image: { type: 'File', passthrough: true, label: 'Fixed/reference image' },
            moving_image: { type: 'File', label: 'Moving image' },
            metric: { type: 'string', label: 'Metric specification' },
            transform: { type: 'string', label: 'Transform specification' },
            convergence: { type: 'string', label: 'Convergence specification' },
            shrink_factors: { type: 'string', label: 'Shrink factors' },
            smoothing_sigmas: { type: 'string', label: 'Smoothing sigmas' }
        },

        optionalInputs: {
            initial_moving_transform: { type: 'File', label: 'Initial transform', flag: '-r' },
            masks: { type: 'string', label: 'Mask specification', flag: '-x' },
            use_histogram_matching: { type: 'boolean', label: 'Histogram matching', flag: '-u' },
            interpolation: { type: 'string', label: 'Interpolation', flag: '-n', options: ['Linear', 'NearestNeighbor', 'BSpline', 'Gaussian'] },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            warped_image: { type: 'File', label: 'Warped image', glob: ['$(inputs.output_prefix)Warped.nii.gz'] },
            inverse_warped_image: { type: 'File', label: 'Inverse warped', glob: ['$(inputs.output_prefix)InverseWarped.nii.gz'] },
            forward_transforms: { type: 'File[]', label: 'Forward transforms', glob: ['$(inputs.output_prefix)*GenericAffine.mat', '$(inputs.output_prefix)*Warp.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsRegistration.log'] }
        }
    },

    'antsRegistrationSyN.sh': {
        id: 'antsRegistrationSyN.sh',
        cwlPath: 'cwl/ants/antsRegistrationSyN.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['warped_image', 'affine_transform', 'warp_field'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            fixed_image: { type: 'File', passthrough: true, label: 'Fixed/reference image' },
            moving_image: { type: 'File', label: 'Moving image' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            transform_type: { type: 'string', label: 'Transform type', flag: '-t', options: ['t', 'r', 'a', 's', 'sr', 'b', 'br'] },
            num_threads: { type: 'int', label: 'Number of threads', flag: '-n' },
            masks: { type: 'string', label: 'Masks (fixed,moving)', flag: '-x' },
            initial_transform: { type: 'File', label: 'Initial transform', flag: '-i' },
            histogram_matching: { type: 'boolean', label: 'Histogram matching', flag: '-j' },
            reproducible: { type: 'boolean', label: 'Reproducible mode', flag: '-y' }
        },

        outputs: {
            warped_image: { type: 'File', label: 'Warped image', glob: ['$(inputs.output_prefix)Warped.nii.gz'] },
            inverse_warped_image: { type: 'File', label: 'Inverse warped', glob: ['$(inputs.output_prefix)InverseWarped.nii.gz'] },
            affine_transform: { type: 'File', label: 'Affine transform', glob: ['$(inputs.output_prefix)0GenericAffine.mat'] },
            warp_field: { type: 'File', label: 'Warp field', glob: ['$(inputs.output_prefix)1Warp.nii.gz'] },
            inverse_warp_field: { type: 'File', label: 'Inverse warp', glob: ['$(inputs.output_prefix)1InverseWarp.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsRegistrationSyN.log'] }
        }
    },

    'antsRegistrationSyNQuick.sh': {
        id: 'antsRegistrationSyNQuick.sh',
        cwlPath: 'cwl/ants/antsRegistrationSyNQuick.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['warped_image', 'affine_transform'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            fixed_image: { type: 'File', passthrough: true, label: 'Fixed/reference image' },
            moving_image: { type: 'File', label: 'Moving image' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            transform_type: { type: 'string', label: 'Transform type', flag: '-t', options: ['t', 'r', 'a', 's', 'sr', 'b', 'br'] },
            num_threads: { type: 'int', label: 'Number of threads', flag: '-n' },
            masks: { type: 'string', label: 'Masks (fixed,moving)', flag: '-x' },
            initial_transform: { type: 'File', label: 'Initial transform', flag: '-i' },
            histogram_matching: { type: 'boolean', label: 'Histogram matching', flag: '-j' }
        },

        outputs: {
            warped_image: { type: 'File', label: 'Warped image', glob: ['$(inputs.output_prefix)Warped.nii.gz'] },
            affine_transform: { type: 'File', label: 'Affine transform', glob: ['$(inputs.output_prefix)0GenericAffine.mat'] },
            warp_field: { type: 'File', label: 'Warp field', glob: ['$(inputs.output_prefix)1Warp.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsRegistrationSyNQuick.log'] }
        }
    },

    'antsApplyTransforms': {
        id: 'antsApplyTransforms',
        cwlPath: 'cwl/ants/antsApplyTransforms.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['transformed_image'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)' },
            input_image: { type: 'File', passthrough: true, label: 'Input image' },
            reference_image: { type: 'File', label: 'Reference image' },
            output_image: { type: 'string', label: 'Output filename' },
            transforms: { type: 'File[]', label: 'Transform files' }
        },

        optionalInputs: {
            interpolation: { type: 'string', label: 'Interpolation', flag: '-n', options: ['Linear', 'NearestNeighbor', 'Gaussian', 'BSpline', 'GenericLabel'] },
            default_value: { type: 'double', label: 'Default value', flag: '-f' },
            input_image_type: { type: 'string', label: 'Image type', flag: '-e', options: ['0', '1', '2', '3'] },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            transformed_image: { type: 'File', label: 'Transformed image', glob: ['$(inputs.output_image)'] },
            log: { type: 'File', label: 'Log file', glob: ['antsApplyTransforms.log'] }
        }
    },

    'antsMotionCorr': {
        id: 'antsMotionCorr',
        cwlPath: 'cwl/ants/antsMotionCorr.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['corrected_image'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            fixed_image: { type: 'File', passthrough: true, label: 'Fixed/reference 3D image' },
            moving_image: { type: 'File', label: 'Moving 4D time series' },
            output_prefix: { type: 'string', label: 'Output prefix' },
            metric: { type: 'string', label: 'Metric specification' },
            transform: { type: 'string', label: 'Transform type' },
            iterations: { type: 'string', label: 'Iterations per level' },
            shrink_factors: { type: 'string', label: 'Shrink factors' },
            smoothing_sigmas: { type: 'string', label: 'Smoothing sigmas' }
        },

        optionalInputs: {
            num_images: { type: 'int', label: 'Number of images', flag: '-n' },
            write_displacement: { type: 'boolean', label: 'Write displacement field', flag: '-w' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            corrected_image: { type: 'File', label: 'Motion-corrected image', glob: ['$(inputs.output_prefix)_corrected.nii.gz'] },
            average_image: { type: 'File', label: 'Average image', glob: ['$(inputs.output_prefix)_avg.nii.gz'] },
            motion_parameters: { type: 'File[]', label: 'Motion parameters', glob: ['$(inputs.output_prefix)MOCOparams.csv'] },
            log: { type: 'File', label: 'Log file', glob: ['antsMotionCorr.log'] }
        }
    },

    'antsIntermodalityIntrasubject.sh': {
        id: 'antsIntermodalityIntrasubject.sh',
        cwlPath: 'cwl/ants/antsIntermodalityIntrasubject.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['warped_image', 'affine_transform'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            input_image: { type: 'File', passthrough: true, label: 'Input scalar image (b0/pCASL)' },
            reference_image: { type: 'File', label: 'Reference T1 image' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            brain_mask: { type: 'File', label: 'Brain mask', flag: '-x' },
            transform_type: { type: 'string', label: 'Transform type', flag: '-t', options: ['0', '1', '2', '3'] },
            template_prefix: { type: 'string', label: 'Template transform prefix', flag: '-w' },
            auxiliary_images: { type: 'File[]', label: 'Auxiliary images to warp', flag: '-a' }
        },

        outputs: {
            warped_image: { type: 'File', label: 'Warped image', glob: ['$(inputs.output_prefix)anatomical.nii.gz'] },
            affine_transform: { type: 'File', label: 'Affine transform', glob: ['$(inputs.output_prefix)0GenericAffine.mat'] },
            warp_field: { type: 'File', label: 'Warp field', glob: ['$(inputs.output_prefix)1Warp.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsIntermodalityIntrasubject.log'] }
        }
    },

    // ====================================
    // ANTs Tools - Segmentation
    // ====================================

    'Atropos': {
        id: 'Atropos',
        cwlPath: 'cwl/ants/Atropos.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['segmentation'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3/4)' },
            intensity_image: { type: 'File', passthrough: true, label: 'Input intensity image' },
            mask_image: { type: 'File', label: 'Mask image' },
            output_prefix: { type: 'string', label: 'Output filename' },
            initialization: { type: 'string', label: 'Initialization (kmeans[n], otsu[n], priors[...])' }
        },

        optionalInputs: {
            likelihood_model: { type: 'string', label: 'Likelihood model', flag: '-k', options: ['Gaussian', 'HistogramParzenWindows', 'ManifoldParzenWindows'] },
            mrf: { type: 'string', label: 'MRF parameters', flag: '-m' },
            convergence: { type: 'string', label: 'Convergence [iters,thresh]', flag: '-c' },
            prior_weighting: { type: 'double', label: 'Prior weight', flag: '-w' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '--verbose' }
        },

        outputs: {
            segmentation: { type: 'File', label: 'Segmentation image', glob: ['$(inputs.output_prefix)'] },
            posteriors: { type: 'File[]', label: 'Posterior images', glob: ['$(inputs.output_prefix)*Posteriors*.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['Atropos.log'] }
        }
    },

    'antsAtroposN4.sh': {
        id: 'antsAtroposN4.sh',
        cwlPath: 'cwl/ants/antsAtroposN4.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['segmentation', 'bias_corrected'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            input_image: { type: 'File', passthrough: true, label: 'Input anatomical image' },
            mask_image: { type: 'File', label: 'Mask image' },
            output_prefix: { type: 'string', label: 'Output prefix' },
            num_classes: { type: 'int', label: 'Number of tissue classes' }
        },

        optionalInputs: {
            n4_atropos_iterations: { type: 'int', label: 'N4-Atropos iterations', flag: '-m' },
            atropos_iterations: { type: 'int', label: 'Atropos iterations', flag: '-n' },
            prior_images: { type: 'string', label: 'Prior images pattern', flag: '-p' },
            prior_weight: { type: 'double', label: 'Prior weight', flag: '-w' },
            use_random_seeding: { type: 'boolean', label: 'Random seeding', flag: '-u' }
        },

        outputs: {
            segmentation: { type: 'File', label: 'Segmentation', glob: ['$(inputs.output_prefix)Segmentation.nii.gz'] },
            posteriors: { type: 'File[]', label: 'Posteriors', glob: ['$(inputs.output_prefix)SegmentationPosteriors*.nii.gz'] },
            bias_corrected: { type: 'File', label: 'Bias-corrected', glob: ['$(inputs.output_prefix)BrainSegmentation0N4.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsAtroposN4.log'] }
        }
    },

    'antsBrainExtraction.sh': {
        id: 'antsBrainExtraction.sh',
        cwlPath: 'cwl/ants/antsBrainExtraction.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['brain_extracted', 'brain_mask'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            anatomical_image: { type: 'File', passthrough: true, label: 'Input T1 image' },
            template: { type: 'File', label: 'Brain template (with skull)' },
            brain_probability_mask: { type: 'File', label: 'Brain probability mask' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            registration_mask: { type: 'File', label: 'Registration mask', flag: '-f' },
            keep_temporary_files: { type: 'boolean', label: 'Keep temp files', flag: '-k' },
            image_suffix: { type: 'string', label: 'Image suffix', flag: '-s' },
            use_floatingpoint: { type: 'boolean', label: 'Float precision', flag: '-q' }
        },

        outputs: {
            brain_extracted: { type: 'File', label: 'Extracted brain', glob: ['$(inputs.output_prefix)BrainExtractionBrain.nii.gz'] },
            brain_mask: { type: 'File', label: 'Brain mask', glob: ['$(inputs.output_prefix)BrainExtractionMask.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsBrainExtraction.log'] }
        }
    },

    'KellyKapowski': {
        id: 'KellyKapowski',
        cwlPath: 'cwl/ants/KellyKapowski.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['thickness_image'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            segmentation_image: { type: 'File', passthrough: true, label: 'Segmentation image' },
            gray_matter_prob: { type: 'File', label: 'Gray matter probability' },
            white_matter_prob: { type: 'File', label: 'White matter probability' },
            output_image: { type: 'string', label: 'Output thickness image' }
        },

        optionalInputs: {
            convergence: { type: 'string', label: 'Convergence [iters,thresh,prior]', flag: '-c' },
            thickness_prior: { type: 'double', label: 'Thickness prior', flag: '-t' },
            gradient_step: { type: 'double', label: 'Gradient step', flag: '-r' },
            smoothing_sigma: { type: 'double', label: 'Smoothing sigma', flag: '-m' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            thickness_image: { type: 'File', label: 'Cortical thickness', glob: ['$(inputs.output_image)'] },
            log: { type: 'File', label: 'Log file', glob: ['KellyKapowski.log'] }
        }
    },

    'antsCorticalThickness.sh': {
        id: 'antsCorticalThickness.sh',
        cwlPath: 'cwl/ants/antsCorticalThickness.cwl',
        dockerImage: DOCKER_IMAGES.ants,
        primaryOutputs: ['cortical_thickness', 'brain_segmentation', 'brain_extraction_mask'],

        requiredInputs: {
            dimensionality: { type: 'int', label: 'Image dimensionality (2/3)' },
            anatomical_image: { type: 'File', passthrough: true, label: 'Input T1 image' },
            template: { type: 'File', label: 'Brain template (with skull)' },
            brain_probability_mask: { type: 'File', label: 'Brain probability mask' },
            segmentation_priors: { type: 'string', label: 'Segmentation priors pattern' },
            output_prefix: { type: 'string', label: 'Output prefix' }
        },

        optionalInputs: {
            registration_mask: { type: 'File', label: 'Registration mask', flag: '-f' },
            quick_registration: { type: 'boolean', label: 'Quick registration', flag: '-q' },
            run_stage: { type: 'string', label: 'Stage to run', flag: '-y', options: ['0', '1', '2', '3'] },
            keep_temporary: { type: 'boolean', label: 'Keep temp files', flag: '-k' },
            test_mode: { type: 'boolean', label: 'Test/debug mode', flag: '-z' }
        },

        outputs: {
            cortical_thickness: { type: 'File', label: 'Cortical thickness', glob: ['$(inputs.output_prefix)CorticalThickness.nii.gz'] },
            brain_segmentation: { type: 'File', label: 'Brain segmentation', glob: ['$(inputs.output_prefix)BrainSegmentation.nii.gz'] },
            brain_extraction_mask: { type: 'File', label: 'Brain mask', glob: ['$(inputs.output_prefix)BrainExtractionMask.nii.gz'] },
            brain_normalized: { type: 'File', label: 'Normalized brain', glob: ['$(inputs.output_prefix)BrainNormalizedToTemplate.nii.gz'] },
            segmentation_posteriors: { type: 'File[]', label: 'Posteriors', glob: ['$(inputs.output_prefix)BrainSegmentationPosteriors*.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['antsCorticalThickness.log'] }
        }
    },

    // ==================== FSL DIFFUSION TOOLS ====================

    'eddy': {
        id: 'eddy',
        cwlPath: 'cwl/fsl/eddy.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['corrected_image'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input DWI image', acceptedExtensions: ['.nii', '.nii.gz'] },
            bvals: { type: 'File', label: 'b-values file' },
            bvecs: { type: 'File', label: 'b-vectors file' },
            acqp: { type: 'File', label: 'Acquisition parameters file' },
            index: { type: 'File', label: 'Index file mapping volumes to acquisition parameters' },
            mask: { type: 'File', label: 'Brain mask' },
            output: { type: 'string', label: 'Output basename' }
        },

        optionalInputs: {
            topup: { type: 'string', label: 'Topup results basename', flag: '--topup=' },
            repol: { type: 'boolean', label: 'Detect and replace outlier slices', flag: '--repol' },
            slm: { type: 'string', label: 'Second level model (none/linear/quadratic)', flag: '--slm=' },
            niter: { type: 'int', label: 'Number of iterations', flag: '--niter=' },
            fwhm: { type: 'string', label: 'FWHM for conditioning regularisation (comma-separated)', flag: '--fwhm=' },
            flm: { type: 'string', label: 'First level EC model (movement/linear/quadratic/cubic)', flag: '--flm=' },
            interp: { type: 'string', label: 'Interpolation model (spline/trilinear)', flag: '--interp=' },
            dont_sep_offs_move: { type: 'boolean', label: 'Do not separate field offset from subject movement', flag: '--dont_sep_offs_move' },
            data_is_shelled: { type: 'boolean', label: 'Assume data is shelled (skip check)', flag: '--data_is_shelled' }
        },

        outputs: {
            corrected_image: { type: 'File', label: 'Eddy-corrected image', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii'] },
            rotated_bvecs: { type: 'File', label: 'Rotated b-vectors', glob: ['$(inputs.output).eddy_rotated_bvecs'] },
            parameters: { type: 'File', label: 'Eddy parameters', glob: ['$(inputs.output).eddy_parameters'] },
            log: { type: 'File', label: 'Log file', glob: ['eddy.log'] }
        }
    },

    'dtifit': {
        id: 'dtifit',
        cwlPath: 'cwl/fsl/dtifit.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['FA', 'MD'],

        requiredInputs: {
            data: { type: 'File', passthrough: true, label: 'Input diffusion data', acceptedExtensions: ['.nii', '.nii.gz'] },
            mask: { type: 'File', label: 'Brain mask' },
            bvecs: { type: 'File', label: 'b-vectors file' },
            bvals: { type: 'File', label: 'b-values file' },
            output: { type: 'string', label: 'Output basename' }
        },

        optionalInputs: {
            wls: { type: 'boolean', label: 'Use weighted least squares', flag: '-w' },
            sse: { type: 'boolean', label: 'Output sum of squared errors', flag: '--sse' },
            save_tensor: { type: 'boolean', label: 'Save tensor elements', flag: '--save_tensor' }
        },

        outputs: {
            FA: { type: 'File', label: 'Fractional anisotropy', glob: ['$(inputs.output)_FA.nii.gz', '$(inputs.output)_FA.nii'] },
            MD: { type: 'File', label: 'Mean diffusivity', glob: ['$(inputs.output)_MD.nii.gz', '$(inputs.output)_MD.nii'] },
            L1: { type: 'File?', label: 'First eigenvalue', glob: ['$(inputs.output)_L1.nii.gz', '$(inputs.output)_L1.nii'] },
            L2: { type: 'File?', label: 'Second eigenvalue', glob: ['$(inputs.output)_L2.nii.gz', '$(inputs.output)_L2.nii'] },
            L3: { type: 'File?', label: 'Third eigenvalue', glob: ['$(inputs.output)_L3.nii.gz', '$(inputs.output)_L3.nii'] },
            V1: { type: 'File?', label: 'First eigenvector', glob: ['$(inputs.output)_V1.nii.gz', '$(inputs.output)_V1.nii'] },
            V2: { type: 'File?', label: 'Second eigenvector', glob: ['$(inputs.output)_V2.nii.gz', '$(inputs.output)_V2.nii'] },
            V3: { type: 'File?', label: 'Third eigenvector', glob: ['$(inputs.output)_V3.nii.gz', '$(inputs.output)_V3.nii'] },
            tensor: { type: 'File?', label: 'Tensor image', glob: ['$(inputs.output)_tensor.nii.gz', '$(inputs.output)_tensor.nii'], requires: 'save_tensor' },
            log: { type: 'File', label: 'Log file', glob: ['dtifit.log'] }
        }
    },

    'bedpostx': {
        id: 'bedpostx',
        cwlPath: 'cwl/fsl/bedpostx.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            data_dir: { type: 'Directory', passthrough: true, label: 'Input data directory (must contain data, bvals, bvecs, nodif_brain_mask)' }
        },

        optionalInputs: {
            nfibres: { type: 'int', label: 'Number of fibres per voxel (default 3)', flag: '-n' },
            model: { type: 'int', label: 'Deconvolution model (1=monoexp, 2=multiexp, 3=zeppelin)', flag: '-model' },
            rician: { type: 'boolean', label: 'Use Rician noise modelling', flag: '--rician' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'BedpostX output directory', glob: ['$(inputs.data_dir.basename).bedpostX'] },
            merged_samples: { type: 'File[]', label: 'Merged samples', glob: ['$(inputs.data_dir.basename).bedpostX/merged_*samples.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['bedpostx.log'] }
        }
    },

    // ==================== FSL TBSS TOOLS ====================

    'tbss_1_preproc': {
        id: 'tbss_1_preproc',
        cwlPath: 'cwl/fsl/tbss_1_preproc.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['FA_directory'],

        requiredInputs: {
            fa_images: { type: 'File[]', passthrough: true, label: 'Input FA images' }
        },

        optionalInputs: {},

        outputs: {
            FA_directory: { type: 'Directory', label: 'Preprocessed FA directory', glob: ['FA'] },
            log: { type: 'File', label: 'Log file', glob: ['tbss_1_preproc.log'] }
        }
    },

    'tbss_2_reg': {
        id: 'tbss_2_reg',
        cwlPath: 'cwl/fsl/tbss_2_reg.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['FA_directory'],

        requiredInputs: {
            fa_directory: { type: 'Directory', passthrough: true, label: 'FA directory from tbss_1_preproc' }
        },

        optionalInputs: {
            use_fmrib_target: { type: 'boolean', label: 'Use FMRIB58_FA standard-space image as target', flag: '-T' },
            target_image: { type: 'File', label: 'Use specified image as target', flag: '-t' },
            find_best_target: { type: 'boolean', label: 'Find best target from all subjects', flag: '-n' }
        },

        outputs: {
            FA_directory: { type: 'Directory', label: 'Registered FA directory', glob: ['FA'] },
            log: { type: 'File', label: 'Log file', glob: ['tbss_2_reg.log'] }
        }
    },

    'tbss_3_postreg': {
        id: 'tbss_3_postreg',
        cwlPath: 'cwl/fsl/tbss_3_postreg.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['mean_FA', 'mean_FA_skeleton', 'all_FA'],

        requiredInputs: {
            fa_directory: { type: 'Directory', passthrough: true, label: 'FA directory from tbss_2_reg' }
        },

        optionalInputs: {
            study_specific: { type: 'boolean', label: 'Derive mean FA and skeleton from study data', flag: '-S' },
            use_fmrib: { type: 'boolean', label: 'Use FMRIB58_FA mean FA and skeleton', flag: '-T' }
        },

        outputs: {
            mean_FA: { type: 'File', label: 'Mean FA image', glob: ['stats/mean_FA.nii.gz'] },
            mean_FA_skeleton: { type: 'File', label: 'Mean FA skeleton', glob: ['stats/mean_FA_skeleton.nii.gz'] },
            all_FA: { type: 'File', label: 'All FA data (4D)', glob: ['stats/all_FA.nii.gz'] },
            FA_directory: { type: 'Directory', label: 'FA directory', glob: ['FA'] },
            stats_directory: { type: 'Directory', label: 'Stats directory', glob: ['stats'] },
            log: { type: 'File', label: 'Log file', glob: ['tbss_3_postreg.log'] }
        }
    },

    'tbss_4_prestats': {
        id: 'tbss_4_prestats',
        cwlPath: 'cwl/fsl/tbss_4_prestats.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['all_FA_skeletonised'],

        requiredInputs: {
            threshold: { type: 'double', label: 'FA threshold for skeleton (e.g., 0.2)' },
            fa_directory: { type: 'Directory', passthrough: true, label: 'FA directory from tbss_3_postreg' },
            stats_directory: { type: 'Directory', label: 'Stats directory from tbss_3_postreg' }
        },

        optionalInputs: {},

        outputs: {
            all_FA_skeletonised: { type: 'File', label: 'Skeletonised FA data (4D)', glob: ['stats/all_FA_skeletonised.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['tbss_4_prestats.log'] }
        }
    },

    // ==================== FSL ASL TOOLS ====================

    'oxford_asl': {
        id: 'oxford_asl',
        cwlPath: 'cwl/fsl/oxford_asl.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input ASL data', acceptedExtensions: ['.nii', '.nii.gz'] },
            output_dir: { type: 'string', label: 'Output directory name' }
        },

        optionalInputs: {
            structural: { type: 'File', label: 'Structural (T1) image', flag: '-s' },
            casl: { type: 'boolean', label: 'Data is CASL/pCASL (continuous ASL)', flag: '--casl' },
            pasl: { type: 'boolean', label: 'Data is PASL (pulsed ASL)', flag: '--pasl' },
            iaf: { type: 'string', label: 'Input ASL format (tc/ct/diff)', flag: '--iaf' },
            tis: { type: 'string', label: 'Inversion times (comma-separated)', flag: '--tis' },
            bolus: { type: 'double', label: 'Bolus duration (seconds)', flag: '--bolus' },
            bat: { type: 'double', label: 'Bolus arrival time (seconds)', flag: '--bat' },
            calib: { type: 'File', label: 'Calibration (M0) image', flag: '-c' },
            wp: { type: 'boolean', label: 'Use white paper quantification', flag: '--wp' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'Output directory', glob: ['$(inputs.output_dir)'] },
            perfusion: { type: 'File?', label: 'Perfusion image', glob: ['$(inputs.output_dir)/native_space/perfusion.nii.gz'] },
            arrival: { type: 'File?', label: 'Arrival time image', glob: ['$(inputs.output_dir)/native_space/arrival.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['oxford_asl.log'] }
        }
    },

    'basil': {
        id: 'basil',
        cwlPath: 'cwl/fsl/basil.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input ASL difference data', acceptedExtensions: ['.nii', '.nii.gz'] },
            output_dir: { type: 'string', label: 'Output directory name' }
        },

        optionalInputs: {
            casl: { type: 'boolean', label: 'Data is CASL/pCASL', flag: '--casl' },
            pasl: { type: 'boolean', label: 'Data is PASL', flag: '--pasl' },
            tis: { type: 'string', label: 'Inversion times (comma-separated)', flag: '--tis' },
            bolus: { type: 'double', label: 'Bolus duration (seconds)', flag: '--bolus' },
            bat: { type: 'double', label: 'Bolus arrival time (seconds)', flag: '--bat' },
            mask: { type: 'File', label: 'Brain mask', flag: '-m' },
            spatial: { type: 'boolean', label: 'Use spatial regularisation', flag: '--spatial' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'Output directory', glob: ['$(inputs.output_dir)'] },
            perfusion: { type: 'File?', label: 'Perfusion image', glob: ['$(inputs.output_dir)/mean_ftiss.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['basil.log'] }
        }
    },

    'asl_calib': {
        id: 'asl_calib',
        cwlPath: 'cwl/fsl/asl_calib.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['calibrated_perfusion'],

        requiredInputs: {
            perfusion: { type: 'File', passthrough: true, label: 'Input perfusion image (relative units)', acceptedExtensions: ['.nii', '.nii.gz'] },
            calib_image: { type: 'File', label: 'Calibration (M0) image' },
            output: { type: 'string', label: 'Output filename' }
        },

        optionalInputs: {
            structural: { type: 'File', label: 'Structural (T1) image', flag: '-s' },
            mode: { type: 'string', label: 'Calibration mode (voxel/longtr/satrecov)', flag: '--mode' },
            tr: { type: 'double', label: 'TR of calibration image (seconds)', flag: '--tr' },
            te: { type: 'double', label: 'TE of calibration image (ms)', flag: '--te' },
            cgain: { type: 'double', label: 'Calibration gain', flag: '--cgain' }
        },

        outputs: {
            calibrated_perfusion: { type: 'File', label: 'Calibrated perfusion image', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii'] },
            log: { type: 'File', label: 'Log file', glob: ['asl_calib.log'] }
        }
    },

    // ==================== MRTRIX3 TOOLS ====================

    'dwidenoise': {
        id: 'dwidenoise',
        cwlPath: 'cwl/mrtrix3/dwidenoise.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['denoised'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input DWI image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] },
            output: { type: 'string', label: 'Output denoised image filename' }
        },

        optionalInputs: {
            noise: { type: 'string', label: 'Output noise map filename', flag: '-noise' },
            extent: { type: 'string', label: 'Sliding window extent (e.g., 5,5,5)', flag: '-extent' },
            mask: { type: 'File', label: 'Processing mask', flag: '-mask' }
        },

        outputs: {
            denoised: { type: 'File', label: 'Denoised image', glob: ['$(inputs.output)'] },
            noise_map: { type: 'File?', label: 'Noise map', glob: ['$(inputs.noise)'], requires: 'noise' },
            log: { type: 'File', label: 'Log file', glob: ['dwidenoise.log'] }
        }
    },

    'mrdegibbs': {
        id: 'mrdegibbs',
        cwlPath: 'cwl/mrtrix3/mrdegibbs.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['degibbs'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] },
            output: { type: 'string', label: 'Output corrected image filename' }
        },

        optionalInputs: {
            axes: { type: 'string', label: 'Slice axes (comma-separated, e.g., 0,1)', flag: '-axes' },
            nshifts: { type: 'int', label: 'Number of sub-voxel shifts', flag: '-nshifts' },
            minW: { type: 'int', label: 'Minimum window size', flag: '-minW' },
            maxW: { type: 'int', label: 'Maximum window size', flag: '-maxW' }
        },

        outputs: {
            degibbs: { type: 'File', label: 'Gibbs-corrected image', glob: ['$(inputs.output)'] },
            log: { type: 'File', label: 'Log file', glob: ['mrdegibbs.log'] }
        }
    },

    'dwi2tensor': {
        id: 'dwi2tensor',
        cwlPath: 'cwl/mrtrix3/dwi2tensor.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['tensor'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input DWI image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] },
            output: { type: 'string', label: 'Output tensor image filename' }
        },

        optionalInputs: {
            mask: { type: 'File', label: 'Processing mask', flag: '-mask' },
            b0: { type: 'string', label: 'Output mean b=0 image filename', flag: '-b0' },
            dkt: { type: 'string', label: 'Output diffusion kurtosis tensor filename', flag: '-dkt' },
            ols: { type: 'boolean', label: 'Use ordinary least squares estimator', flag: '-ols' },
            iter: { type: 'int', label: 'Number of iteratively-reweighted LS iterations', flag: '-iter' }
        },

        outputs: {
            tensor: { type: 'File', label: 'Tensor image', glob: ['$(inputs.output)'] },
            b0_image: { type: 'File?', label: 'Mean b=0 image', glob: ['$(inputs.b0)'], requires: 'b0' },
            kurtosis_tensor: { type: 'File?', label: 'Kurtosis tensor image', glob: ['$(inputs.dkt)'], requires: 'dkt' },
            log: { type: 'File', label: 'Log file', glob: ['dwi2tensor.log'] }
        }
    },

    'tensor2metric': {
        id: 'tensor2metric',
        cwlPath: 'cwl/mrtrix3/tensor2metric.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['fa_map'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input tensor image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] }
        },

        optionalInputs: {
            fa: { type: 'string', label: 'Output FA map filename', flag: '-fa' },
            adc: { type: 'string', label: 'Output mean diffusivity (ADC) map filename', flag: '-adc' },
            ad: { type: 'string', label: 'Output axial diffusivity map filename', flag: '-ad' },
            rd: { type: 'string', label: 'Output radial diffusivity map filename', flag: '-rd' },
            vector: { type: 'string', label: 'Output eigenvector map filename', flag: '-vector' },
            value: { type: 'string', label: 'Output eigenvalue map filename', flag: '-value' },
            mask: { type: 'File', label: 'Processing mask', flag: '-mask' }
        },

        outputs: {
            fa_map: { type: 'File?', label: 'Fractional anisotropy map', glob: ['$(inputs.fa)'], requires: 'fa' },
            md_map: { type: 'File?', label: 'Mean diffusivity map', glob: ['$(inputs.adc)'], requires: 'adc' },
            ad_map: { type: 'File?', label: 'Axial diffusivity map', glob: ['$(inputs.ad)'], requires: 'ad' },
            rd_map: { type: 'File?', label: 'Radial diffusivity map', glob: ['$(inputs.rd)'], requires: 'rd' },
            log: { type: 'File', label: 'Log file', glob: ['tensor2metric.log'] }
        }
    },

    'dwi2fod': {
        id: 'dwi2fod',
        cwlPath: 'cwl/mrtrix3/dwi2fod.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['wm_fod_image'],

        requiredInputs: {
            algorithm: { type: 'string', label: 'FOD algorithm (csd/msmt_csd)' },
            input: { type: 'File', passthrough: true, label: 'Input DWI image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] },
            wm_response: { type: 'File', label: 'White matter response function' },
            wm_fod: { type: 'string', label: 'Output WM FOD image filename' }
        },

        optionalInputs: {
            gm_response: { type: 'File', label: 'Grey matter response function' },
            gm_fod: { type: 'string', label: 'Output GM FOD image filename' },
            csf_response: { type: 'File', label: 'CSF response function' },
            csf_fod: { type: 'string', label: 'Output CSF FOD image filename' },
            mask: { type: 'File', label: 'Processing mask', flag: '-mask' }
        },

        outputs: {
            wm_fod_image: { type: 'File', label: 'WM fibre orientation distribution', glob: ['$(inputs.wm_fod)'] },
            gm_fod_image: { type: 'File?', label: 'GM FOD image', glob: ['$(inputs.gm_fod)'] },
            csf_fod_image: { type: 'File?', label: 'CSF FOD image', glob: ['$(inputs.csf_fod)'] },
            log: { type: 'File', label: 'Log file', glob: ['dwi2fod.log'] }
        }
    },

    'tckgen': {
        id: 'tckgen',
        cwlPath: 'cwl/mrtrix3/tckgen.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['tractogram'],

        requiredInputs: {
            source: { type: 'File', passthrough: true, label: 'Input FOD or tensor image', acceptedExtensions: ['.nii', '.nii.gz', '.mif'] },
            output: { type: 'string', label: 'Output tractogram filename' }
        },

        optionalInputs: {
            algorithm: { type: 'string', label: 'Tracking algorithm (iFOD2/Tensor_Det/Tensor_Prob)', flag: '-algorithm' },
            seed_image: { type: 'File', label: 'Seed image for tractography', flag: '-seed_image' },
            select: { type: 'int', label: 'Number of streamlines to select', flag: '-select' },
            cutoff: { type: 'double', label: 'FOD amplitude cutoff for termination', flag: '-cutoff' },
            act: { type: 'File', label: 'ACT tissue-segmented image', flag: '-act' },
            step: { type: 'double', label: 'Step size (mm)', flag: '-step' },
            angle: { type: 'double', label: 'Maximum angle between steps (degrees)', flag: '-angle' },
            maxlength: { type: 'double', label: 'Maximum streamline length (mm)', flag: '-maxlength' }
        },

        outputs: {
            tractogram: { type: 'File', label: 'Tractogram', glob: ['$(inputs.output)'] },
            log: { type: 'File', label: 'Log file', glob: ['tckgen.log'] }
        }
    },

    'tcksift': {
        id: 'tcksift',
        cwlPath: 'cwl/mrtrix3/tcksift.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['filtered_tractogram'],

        requiredInputs: {
            input_tracks: { type: 'File', passthrough: true, label: 'Input tractogram', acceptedExtensions: ['.tck'] },
            fod: { type: 'File', label: 'FOD image for filtering' },
            output: { type: 'string', label: 'Output filtered tractogram filename' }
        },

        optionalInputs: {
            act: { type: 'File', label: 'ACT tissue-segmented image', flag: '-act' },
            term_number: { type: 'int', label: 'Target number of streamlines', flag: '-term_number' },
            term_ratio: { type: 'double', label: 'Target ratio of streamlines to keep', flag: '-term_ratio' }
        },

        outputs: {
            filtered_tractogram: { type: 'File', label: 'Filtered tractogram', glob: ['$(inputs.output)'] },
            log: { type: 'File', label: 'Log file', glob: ['tcksift.log'] }
        }
    },

    'tck2connectome': {
        id: 'tck2connectome',
        cwlPath: 'cwl/mrtrix3/tck2connectome.cwl',
        dockerImage: DOCKER_IMAGES.mrtrix3,
        primaryOutputs: ['connectome'],

        requiredInputs: {
            input_tracks: { type: 'File', passthrough: true, label: 'Input tractogram', acceptedExtensions: ['.tck'] },
            parcellation: { type: 'File', label: 'Parcellation image (atlas)' },
            output: { type: 'string', label: 'Output connectivity matrix filename' }
        },

        optionalInputs: {
            assignment_radial_search: { type: 'double', label: 'Radial search distance for node assignment (mm)', flag: '-assignment_radial_search' },
            scale_length: { type: 'boolean', label: 'Scale by streamline length', flag: '-scale_length' },
            scale_invlength: { type: 'boolean', label: 'Scale by inverse streamline length', flag: '-scale_invlength' },
            scale_invnodevol: { type: 'boolean', label: 'Scale by inverse node volume', flag: '-scale_invnodevol' },
            stat_edge: { type: 'string', label: 'Edge statistic (sum/mean/min/max)', flag: '-stat_edge' },
            symmetric: { type: 'boolean', label: 'Make matrix symmetric', flag: '-symmetric' },
            zero_diagonal: { type: 'boolean', label: 'Zero the diagonal of the matrix', flag: '-zero_diagonal' }
        },

        outputs: {
            connectome: { type: 'File', label: 'Connectivity matrix', glob: ['$(inputs.output)'] },
            log: { type: 'File', label: 'Log file', glob: ['tck2connectome.log'] }
        }
    },

    // ==================== PIPELINE TOOLS ====================

    'fmriprep': {
        id: 'fmriprep',
        cwlPath: 'cwl/fmriprep/fmriprep.cwl',
        dockerImage: DOCKER_IMAGES.fmriprep,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            bids_dir: { type: 'Directory', passthrough: true, label: 'BIDS dataset directory' },
            output_dir: { type: 'string', label: 'Output directory' },
            analysis_level: { type: 'string', label: 'Analysis level (participant)' }
        },

        optionalInputs: {
            participant_label: { type: 'string', label: 'Participant label (without sub- prefix)', flag: '--participant-label' },
            output_spaces: { type: 'string', label: 'Output spaces (e.g., MNI152NLin2009cAsym)', flag: '--output-spaces' },
            fs_license_file: { type: 'File', label: 'FreeSurfer license file', flag: '--fs-license-file' },
            nprocs: { type: 'int', label: 'Number of processors', flag: '--nprocs' },
            mem_mb: { type: 'int', label: 'Memory limit (MB)', flag: '--mem-mb' },
            skip_bids_validation: { type: 'boolean', label: 'Skip BIDS validation', flag: '--skip-bids-validation' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'fMRIPrep output directory', glob: ['$(inputs.output_dir)'] },
            log: { type: 'File', label: 'Log file', glob: ['fmriprep.log'] }
        }
    },

    'mriqc': {
        id: 'mriqc',
        cwlPath: 'cwl/mriqc/mriqc.cwl',
        dockerImage: DOCKER_IMAGES.mriqc,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            bids_dir: { type: 'Directory', passthrough: true, label: 'BIDS dataset directory' },
            output_dir: { type: 'string', label: 'Output directory' },
            analysis_level: { type: 'string', label: 'Analysis level (participant/group)' }
        },

        optionalInputs: {
            participant_label: { type: 'string', label: 'Participant label (without sub- prefix)', flag: '--participant-label' },
            modalities: { type: 'string', label: 'Modalities to process (T1w/T2w/bold)', flag: '--modalities' },
            no_sub: { type: 'boolean', label: 'Disable submission of quality metrics', flag: '--no-sub' },
            nprocs: { type: 'int', label: 'Number of processors', flag: '--nprocs' },
            mem_gb: { type: 'int', label: 'Memory limit (GB)', flag: '--mem-gb' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'MRIQC output directory', glob: ['$(inputs.output_dir)'] },
            log: { type: 'File', label: 'Log file', glob: ['mriqc.log'] }
        }
    },

    // ==================== FREESURFER PET TOOLS ====================

    'mri_gtmpvc': {
        id: 'mri_gtmpvc',
        cwlPath: 'cwl/freesurfer/mri_gtmpvc.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['output_directory'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input PET image', acceptedExtensions: ['.nii', '.nii.gz', '.mgz'] },
            psf: { type: 'double', label: 'Point spread function FWHM (mm)' },
            seg: { type: 'File', label: 'Segmentation file' },
            output_dir: { type: 'string', label: 'Output directory' }
        },

        optionalInputs: {
            auto_mask_fwhm: { type: 'double', label: 'Auto-mask smoothing FWHM (mm)', flag: '--auto-mask' },
            auto_mask_thresh: { type: 'double', label: 'Auto-mask threshold (use with auto_mask_fwhm)' },
            reg: { type: 'File', label: 'Registration file (LTA or reg.dat)', flag: '--reg' },
            regheader: { type: 'boolean', label: 'Assume registration is identity (header registration)', flag: '--regheader' },
            no_rescale: { type: 'boolean', label: 'Do not global rescale', flag: '--no-rescale' },
            no_reduce_fov: { type: 'boolean', label: 'Do not reduce FOV', flag: '--no-reduce-fov' },
            default_seg_merge: { type: 'boolean', label: 'Use default scheme to merge hemispheres and set tissue types', flag: '--default-seg-merge' },
            ctab_default: { type: 'boolean', label: 'Use default FreeSurfer color table with tissue types', flag: '--ctab-default' },
            vg_thresh: { type: 'double', label: 'Volume geometry threshold for registration check', flag: '--vg-thresh' }
        },

        outputs: {
            output_directory: { type: 'Directory', label: 'GTM PVC output directory', glob: ['$(inputs.output_dir)'] },
            gtm_stats: { type: 'File?', label: 'GTM statistics', glob: ['$(inputs.output_dir)/gtm.stats.dat'] },
            log: { type: 'File', label: 'Log file', glob: ['mri_gtmpvc.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['mri_gtmpvc.err.log'] }
        }
    },

    // ==================== FSL TBSS NON-FA ====================

    'tbss_non_FA': {
        id: 'tbss_non_FA',
        cwlPath: 'cwl/fsl/tbss_non_FA.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['skeletonised_data'],

        requiredInputs: {
            measure: { type: 'string', label: 'Non-FA measure name (e.g., MD, AD, RD)' },
            fa_directory: { type: 'Directory', passthrough: true, label: 'FA directory from TBSS pipeline' },
            stats_directory: { type: 'Directory', label: 'Stats directory (mean_FA_skeleton, skeleton_mask, all_FA, all_FA_skeletonised)' },
            measure_directory: { type: 'Directory', label: 'Directory with per-subject non-FA images (names matching FA subjects without _FA suffix)' }
        },

        optionalInputs: {},

        outputs: {
            skeletonised_data: { type: 'File', label: 'Skeletonised non-FA data (4D)', glob: ['stats/all_$(inputs.measure)_skeletonised.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['tbss_non_FA.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['tbss_non_FA.err.log'] }
        }
    },

    // ==================== FSL DISTORTION CORRECTION ====================

    'applytopup': {
        id: 'applytopup',
        cwlPath: 'cwl/fsl/applytopup.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['corrected_images'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input image(s) to correct', acceptedExtensions: ['.nii', '.nii.gz'] },
            topup_fieldcoef: { type: 'File', label: 'Topup field coefficients file (_fieldcoef.nii.gz)', acceptedExtensions: ['.nii', '.nii.gz'] },
            topup_movpar: { type: 'File', label: 'Topup movement parameters file (_movpar.txt)', acceptedExtensions: ['.txt'] },
            encoding_file: { type: 'File', label: 'Acquisition parameters file' },
            inindex: { type: 'string', label: 'Comma-separated indices into encoding file' },
            output: { type: 'string', label: 'Output basename for corrected images' }
        },

        optionalInputs: {
            method: { type: 'string', label: 'Resampling method (jac or lsr)', flag: '--method' },
            interp: { type: 'string', label: 'Interpolation method (trilinear or spline)', flag: '--interp' },
            datatype: { type: 'string', label: 'Force output data type', flag: '--datatype' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            corrected_images: { type: 'File', label: 'Distortion-corrected images', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii'] },
            log: { type: 'File', label: 'Log file', glob: ['applytopup.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['applytopup.err.log'] }
        }
    },

    'fsl_prepare_fieldmap': {
        id: 'fsl_prepare_fieldmap',
        cwlPath: 'cwl/fsl/fsl_prepare_fieldmap.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['fieldmap'],

        requiredInputs: {
            scanner: { type: 'string', label: 'Scanner type (e.g., SIEMENS)' },
            phase_image: { type: 'File', passthrough: true, label: 'Phase difference image', acceptedExtensions: ['.nii', '.nii.gz'] },
            magnitude_image: { type: 'File', label: 'Brain-extracted magnitude image', acceptedExtensions: ['.nii', '.nii.gz'] },
            output: { type: 'string', label: 'Output fieldmap filename' },
            delta_TE: { type: 'double', label: 'Echo time difference in milliseconds' }
        },

        optionalInputs: {
            nocheck: { type: 'boolean', label: 'Suppress sanity checking', flag: '--nocheck' }
        },

        outputs: {
            fieldmap: { type: 'File', label: 'Fieldmap in rad/s', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii', '$(inputs.output)'] },
            log: { type: 'File', label: 'Log file', glob: ['fsl_prepare_fieldmap.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['fsl_prepare_fieldmap.err.log'] }
        }
    },

    'prelude': {
        id: 'prelude',
        cwlPath: 'cwl/fsl/prelude.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['unwrapped_phase'],

        requiredInputs: {
            phase: { type: 'File', passthrough: true, label: 'Wrapped phase image', acceptedExtensions: ['.nii', '.nii.gz'] },
            output: { type: 'string', label: 'Output unwrapped phase image filename' }
        },

        optionalInputs: {
            magnitude: { type: 'File', label: 'Magnitude image (for masking)', flag: '-a' },
            complex_input: { type: 'File', label: 'Complex input image', flag: '-c' },
            mask: { type: 'File', label: 'Brain mask image', flag: '-m' },
            num_partitions: { type: 'int', label: 'Number of phase partitions', flag: '-n' },
            process2d: { type: 'boolean', label: 'Do 2D processing (slice by slice)', flag: '-s' },
            labelslices: { type: 'boolean', label: '2D labeling with 3D unwrapping', flag: '--labelslices' },
            force3d: { type: 'boolean', label: 'Force full 3D processing', flag: '--force3D' },
            removeramps: { type: 'boolean', label: 'Remove phase ramps', flag: '--removeramps' },
            savemask: { type: 'string', label: 'Save the generated mask volume', flag: '--savemask=' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            unwrapped_phase: { type: 'File', label: 'Unwrapped phase image', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii', '$(inputs.output)'] },
            saved_mask: { type: 'File?', label: 'Saved mask volume', glob: ['$(inputs.savemask).nii.gz', '$(inputs.savemask).nii'] },
            log: { type: 'File', label: 'Log file', glob: ['prelude.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['prelude.err.log'] }
        }
    },

    // ==================== FSL LESION SEGMENTATION ====================

    'bianca': {
        id: 'bianca',
        cwlPath: 'cwl/fsl/bianca.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['wmh_map'],

        requiredInputs: {
            singlefile: { type: 'File', passthrough: true, label: 'Master file listing subjects, images, masks, and transformations' },
            training_data: { type: 'Directory', label: 'Directory containing all subject data files referenced in master file' },
            querysubjectnum: { type: 'int', label: 'Row number for subject to segment' },
            brainmaskfeaturenum: { type: 'int', label: 'Column number containing brain mask' },
            labelfeaturenum: { type: 'int', label: 'Column number containing manual lesion mask' },
            trainingnums: { type: 'string', label: 'Training subject row numbers (comma-separated or "all")' }
        },

        optionalInputs: {
            output_name: { type: 'string', label: 'Output file basename (default: bianca_output)' },
            featuresubset: { type: 'string', label: 'Column numbers for intensity features (comma-separated)', flag: '--featuresubset' },
            matfeaturenum: { type: 'int', label: 'Column number containing MNI transformation matrices', flag: '--matfeaturenum' },
            spatialweight: { type: 'double', label: 'Weighting for MNI spatial coordinates (default 1)', flag: '--spatialweight' },
            patchsizes: { type: 'string', label: 'Patch sizes in voxels (comma-separated)', flag: '--patchsizes' },
            patch3D: { type: 'boolean', label: 'Enable 3D patch processing', flag: '--patch3D' },
            selectpts: { type: 'string', label: 'Non-lesion point selection (any/noborder/surround)', flag: '--selectpts' },
            trainingpts: { type: 'string', label: 'Max lesion training points per subject', flag: '--trainingpts' },
            nonlespts: { type: 'int', label: 'Max non-lesion points per subject', flag: '--nonlespts' },
            saveclassifierdata: { type: 'string', label: 'Save training data to file', flag: '--saveclassifierdata=' },
            loadclassifierdata: { type: 'string', label: 'Load pre-saved classifier data', flag: '--loadclassifierdata=' },
            verbose: { type: 'boolean', label: 'Verbose output', flag: '-v' }
        },

        outputs: {
            wmh_map: { type: 'File', label: 'WMH probability map', glob: ['$(inputs.output_name).nii.gz', '$(inputs.output_name)'] },
            log: { type: 'File', label: 'Log file', glob: ['bianca.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['bianca.err.log'] }
        }
    },

    // ==================== FSL UTILITIES ====================

    'robustfov': {
        id: 'robustfov',
        cwlPath: 'cwl/fsl/robustfov.cwl',
        dockerImage: DOCKER_IMAGES.fsl,
        primaryOutputs: ['cropped_image'],

        requiredInputs: {
            input: { type: 'File', passthrough: true, label: 'Input image (full head coverage)', acceptedExtensions: ['.nii', '.nii.gz'] },
            output: { type: 'string', label: 'Output cropped image filename' }
        },

        optionalInputs: {
            matrix_output: { type: 'string', label: 'Output transformation matrix filename', flag: '-m' },
            brain_size: { type: 'int', label: 'Brain size estimate in mm (default 170)', flag: '-b' }
        },

        outputs: {
            cropped_image: { type: 'File', label: 'Cropped image', glob: ['$(inputs.output).nii.gz', '$(inputs.output).nii', '$(inputs.output)'] },
            transform_matrix: { type: 'File?', label: 'Transformation matrix', glob: ['$(inputs.matrix_output)'] },
            log: { type: 'File', label: 'Log file', glob: ['robustfov.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['robustfov.err.log'] }
        }
    },

    // ==================== FREESURFER RECON-ALL ====================

    'recon-all': {
        id: 'recon-all',
        cwlPath: 'cwl/freesurfer/recon-all.cwl',
        dockerImage: DOCKER_IMAGES.freesurfer,
        primaryOutputs: ['subjects_output_dir'],

        requiredInputs: {
            subjects_dir: { type: 'Directory', label: 'FreeSurfer subjects directory' },
            fs_license: { type: 'File', label: 'FreeSurfer license file' },
            subject_id: { type: 'string', label: 'Subject identifier' },
            input_t1: { type: 'File', passthrough: true, label: 'Input T1-weighted image', acceptedExtensions: ['.nii', '.nii.gz', '.mgz'] }
        },

        optionalInputs: {
            run_all: { type: 'boolean', label: 'Run full pipeline', flag: '-all' },
            autorecon1: { type: 'boolean', label: 'Run autorecon1 (skull stripping, Talairach)', flag: '-autorecon1' },
            autorecon2: { type: 'boolean', label: 'Run autorecon2 (segmentation, surfaces)', flag: '-autorecon2' },
            autorecon3: { type: 'boolean', label: 'Run autorecon3 (parcellation, statistics)', flag: '-autorecon3' },
            t2_image: { type: 'File', label: 'T2-weighted image for pial refinement', flag: '-T2' },
            flair_image: { type: 'File', label: 'FLAIR image for pial refinement', flag: '-FLAIR' },
            t2pial: { type: 'boolean', label: 'Use T2 for pial surface placement', flag: '-T2pial' },
            flair_pial: { type: 'boolean', label: 'Use FLAIR for pial surface placement', flag: '-FLAIRpial' },
            openmp: { type: 'int', label: 'Number of OpenMP threads', flag: '-openmp' },
            parallel: { type: 'boolean', label: 'Enable parallel processing', flag: '-parallel' }
        },

        outputs: {
            subjects_output_dir: { type: 'Directory', label: 'Reconstructed subject directory', glob: ['$(inputs.subject_id)'] },
            log: { type: 'File', label: 'Log file', glob: ['recon-all.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['recon-all.err.log'] }
        }
    },

    // ==================== CONNECTOME WORKBENCH ====================

    'wb_command_cifti_create_dense_timeseries': {
        id: 'wb_command_cifti_create_dense_timeseries',
        cwlPath: 'cwl/connectome_workbench/wb_command_cifti_create_dense_timeseries.cwl',
        dockerImage: DOCKER_IMAGES.connectome_workbench,
        primaryOutputs: ['cifti_output'],

        requiredInputs: {
            cifti_out: { type: 'string', label: 'Output CIFTI dense timeseries file (.dtseries.nii)' }
        },

        optionalInputs: {
            volume_data: { type: 'File', label: 'Volume file for all volume structures', flag: '-volume' },
            structure_label_volume: { type: 'File', label: 'Label volume identifying CIFTI structures' },
            left_metric: { type: 'File', label: 'Left cortical surface metric', flag: '-left-metric' },
            roi_left: { type: 'File', label: 'Left surface ROI', flag: '-roi-left' },
            right_metric: { type: 'File', label: 'Right cortical surface metric', flag: '-right-metric' },
            roi_right: { type: 'File', label: 'Right surface ROI', flag: '-roi-right' },
            cerebellum_metric: { type: 'File', label: 'Cerebellum surface metric', flag: '-cerebellum-metric' },
            timestep: { type: 'double', label: 'Time step between frames (seconds, default 1.0)', flag: '-timestep' },
            timestart: { type: 'double', label: 'Starting time (seconds, default 0.0)', flag: '-timestart' },
            unit: { type: 'string', label: 'Unit of timestep (SECOND, HERTZ, METER, RADIAN)', flag: '-unit' }
        },

        outputs: {
            cifti_output: { type: 'File', label: 'CIFTI dense timeseries file', glob: ['$(inputs.cifti_out)'] },
            log: { type: 'File', label: 'Log file', glob: ['wb_cifti_create_dense_timeseries.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['wb_cifti_create_dense_timeseries.err.log'] }
        }
    },

    'wb_command_cifti_separate': {
        id: 'wb_command_cifti_separate',
        cwlPath: 'cwl/connectome_workbench/wb_command_cifti_separate.cwl',
        dockerImage: DOCKER_IMAGES.connectome_workbench,
        primaryOutputs: ['volume_output'],

        requiredInputs: {
            cifti_in: { type: 'File', passthrough: true, label: 'Input CIFTI file to separate' },
            direction: { type: 'string', label: 'Separation direction (ROW or COLUMN)' }
        },

        optionalInputs: {
            volume_all: { type: 'string', label: 'Output volume file for all volume structures', flag: '-volume-all' },
            volume_all_crop: { type: 'boolean', label: 'Crop volume to data size', flag: '-crop' },
            metric_left: { type: 'string', label: 'Output metric file for left cortex', flag: '-metric CORTEX_LEFT' },
            metric_right: { type: 'string', label: 'Output metric file for right cortex', flag: '-metric CORTEX_RIGHT' }
        },

        outputs: {
            volume_output: { type: 'File?', label: 'Separated volume data', glob: ['$(inputs.volume_all)'] },
            left_metric_output: { type: 'File?', label: 'Left cortex metric data', glob: ['$(inputs.metric_left)'] },
            right_metric_output: { type: 'File?', label: 'Right cortex metric data', glob: ['$(inputs.metric_right)'] },
            log: { type: 'File', label: 'Log file', glob: ['wb_cifti_separate.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['wb_cifti_separate.err.log'] }
        }
    },

    'wb_command_cifti_smoothing': {
        id: 'wb_command_cifti_smoothing',
        cwlPath: 'cwl/connectome_workbench/wb_command_cifti_smoothing.cwl',
        dockerImage: DOCKER_IMAGES.connectome_workbench,
        primaryOutputs: ['smoothed_cifti'],

        requiredInputs: {
            cifti_in: { type: 'File', passthrough: true, label: 'Input CIFTI file' },
            surface_kernel: { type: 'double', label: 'Gaussian surface smoothing kernel (mm)' },
            volume_kernel: { type: 'double', label: 'Gaussian volume smoothing kernel (mm)' },
            direction: { type: 'string', label: 'Smoothing dimension (ROW or COLUMN)' },
            cifti_out: { type: 'string', label: 'Output smoothed CIFTI file' }
        },

        optionalInputs: {
            fwhm: { type: 'boolean', label: 'Interpret kernel sizes as FWHM', flag: '-fwhm' },
            left_surface: { type: 'File', label: 'Left cortical surface file', flag: '-left-surface' },
            right_surface: { type: 'File', label: 'Right cortical surface file', flag: '-right-surface' },
            cerebellum_surface: { type: 'File', label: 'Cerebellum surface file', flag: '-cerebellum-surface' },
            fix_zeros_volume: { type: 'boolean', label: 'Treat volume zeros as missing data', flag: '-fix-zeros-volume' },
            fix_zeros_surface: { type: 'boolean', label: 'Treat surface zeros as missing data', flag: '-fix-zeros-surface' },
            merged_volume: { type: 'boolean', label: 'Smooth across subcortical boundaries', flag: '-merged-volume' },
            cifti_roi: { type: 'File', label: 'CIFTI ROI to restrict smoothing', flag: '-cifti-roi' }
        },

        outputs: {
            smoothed_cifti: { type: 'File', label: 'Smoothed CIFTI file', glob: ['$(inputs.cifti_out)'] },
            log: { type: 'File', label: 'Log file', glob: ['wb_cifti_smoothing.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['wb_cifti_smoothing.err.log'] }
        }
    },

    'wb_command_metric_smoothing': {
        id: 'wb_command_metric_smoothing',
        cwlPath: 'cwl/connectome_workbench/wb_command_metric_smoothing.cwl',
        dockerImage: DOCKER_IMAGES.connectome_workbench,
        primaryOutputs: ['smoothed_metric'],

        requiredInputs: {
            surface: { type: 'File', passthrough: true, label: 'Surface file (.surf.gii)' },
            metric_in: { type: 'File', label: 'Input metric file to smooth' },
            smoothing_kernel: { type: 'double', label: 'Gaussian smoothing kernel size (mm)' },
            metric_out: { type: 'string', label: 'Output smoothed metric file' }
        },

        optionalInputs: {
            fwhm: { type: 'boolean', label: 'Interpret kernel as FWHM', flag: '-fwhm' },
            roi: { type: 'File', label: 'ROI metric to restrict smoothing', flag: '-roi' },
            fix_zeros: { type: 'boolean', label: 'Treat zeros as missing data', flag: '-fix-zeros' },
            column: { type: 'string', label: 'Process single column (number or name)', flag: '-column' },
            corrected_areas: { type: 'File', label: 'Vertex areas metric for group surfaces', flag: '-corrected-areas' },
            method: { type: 'string', label: 'Smoothing method (GEO_GAUSS_AREA, GEO_GAUSS_EQUAL, GEO_GAUSS)', flag: '-method' }
        },

        outputs: {
            smoothed_metric: { type: 'File', label: 'Smoothed metric file', glob: ['$(inputs.metric_out)'] },
            log: { type: 'File', label: 'Log file', glob: ['wb_metric_smoothing.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['wb_metric_smoothing.err.log'] }
        }
    },

    'wb_command_surface_sphere_project_unproject': {
        id: 'wb_command_surface_sphere_project_unproject',
        cwlPath: 'cwl/connectome_workbench/wb_command_surface_sphere_project_unproject.cwl',
        dockerImage: DOCKER_IMAGES.connectome_workbench,
        primaryOutputs: ['output_sphere'],

        requiredInputs: {
            sphere_in: { type: 'File', passthrough: true, label: 'Input sphere with desired output mesh' },
            sphere_project_to: { type: 'File', label: 'Sphere that aligns with sphere-in' },
            sphere_unproject_from: { type: 'File', label: 'Sphere deformed to desired output space' },
            sphere_out: { type: 'string', label: 'Output sphere filename' }
        },

        optionalInputs: {},

        outputs: {
            output_sphere: { type: 'File', label: 'Resampled sphere', glob: ['$(inputs.sphere_out)'] },
            log: { type: 'File', label: 'Log file', glob: ['wb_surface_sphere_project_unproject.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['wb_surface_sphere_project_unproject.err.log'] }
        }
    },

    // ==================== AMICO NODDI ====================

    'amico_noddi': {
        id: 'amico_noddi',
        cwlPath: 'cwl/amico/amico_noddi.cwl',
        dockerImage: DOCKER_IMAGES.amico,
        primaryOutputs: ['ndi_map'],

        requiredInputs: {
            dwi: { type: 'File', passthrough: true, label: 'Multi-shell diffusion MRI 4D image', acceptedExtensions: ['.nii', '.nii.gz'] },
            bvals: { type: 'File', label: 'b-values file' },
            bvecs: { type: 'File', label: 'b-vectors file' },
            mask: { type: 'File', label: 'Brain mask image', acceptedExtensions: ['.nii', '.nii.gz'] }
        },

        optionalInputs: {
            num_threads: { type: 'int', label: 'Maximum number of CPU threads (default 1)' },
            b0_threshold: { type: 'int', label: 'Threshold for considering measurements b=0 (default 10)' },
            csf_diffusivity: { type: 'double', label: 'CSF diffusivity in mm^2/s (default 0.003)' },
            parallel_diffusivity: { type: 'double', label: 'Intracellular diffusivity parallel to neurites in mm^2/s (default 0.0017)' },
            ex_vivo: { type: 'boolean', label: 'Use ex-vivo AMICO model' }
        },

        outputs: {
            ndi_map: { type: 'File', label: 'Neurite Density Index (NDI/ICVF) map', glob: ['output/NODDI*ICVF.nii.gz'] },
            odi_map: { type: 'File', label: 'Orientation Dispersion Index (ODI) map', glob: ['output/NODDI*OD.nii.gz'] },
            fiso_map: { type: 'File', label: 'Isotropic Volume Fraction (fISO) map', glob: ['output/NODDI*ISOVF.nii.gz'] },
            log: { type: 'File', label: 'Log file', glob: ['amico_noddi.log'] },
            err_log: { type: 'File', label: 'Error log file', glob: ['amico_noddi.err.log'] }
        }
    }
};