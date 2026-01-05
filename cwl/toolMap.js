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
    afni: 'afni/afni',
    ants: 'antsx/ants',
    freesurfer: 'freesurfer/freesurfer'
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
                label: 'Input T1-weighted image'
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
                label: 'Input image (brain extracted recommended)'
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
                label: 'Input image to reorient'
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
                label: 'Input 4D timeseries'
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
            structures: { type: 'string', label: 'Structures to segment', flag: '-s' }
        },

        outputs: {
            segmentation_files: {
                type: 'File[]',
                label: 'Segmentation files',
                glob: ['$(inputs.output)*_first*.nii.gz', '$(inputs.output)*_firstseg.nii.gz']
            },
            vtk_meshes: {
                type: 'File[]',
                label: 'VTK meshes',
                glob: ['$(inputs.output)*.vtk']
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
            input: { type: 'File', passthrough: true, label: 'Input volume' },
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
            skull_stripped: { type: 'File', label: 'Skull-stripped output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            input: { type: 'File', passthrough: true, label: 'Input 4D dataset' },
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
            registered: { type: 'File', label: 'Registered output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            shifted: { type: 'File', label: 'Time-shifted output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            despiked: { type: 'File', label: 'Despiked output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            filtered: { type: 'File', label: 'Bandpassed output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            blurred: { type: 'File', label: 'Blurred output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            merged: { type: 'File', label: 'Merged output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            aligned: { type: 'File', label: 'Aligned output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            warped: { type: 'File?', label: 'Warped output', glob: ['$(inputs.prefix)+*.*', '$(inputs.prefix).nii*'] },
            warp: { type: 'File?', label: 'Warp field', glob: ['$(inputs.prefix)_WARP+*.*', '$(inputs.prefix)_WARP.nii*'] },
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
            unifized: { type: 'File', label: 'Unifized output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            mask: { type: 'File', label: 'Output mask', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            concatenated: { type: 'File', label: 'Concatenated output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            dxyz: { type: 'double', label: 'Voxel size (mm)', flag: '-dxyz' },
            xform: { type: 'string', label: 'Warp type', flag: '-xform', options: ['affine_general', 'shift_rotate_scale'] }
        },

        outputs: {
            tlrc_anat: { type: 'File', label: 'TLRC-aligned anatomical', glob: ['*+tlrc.*'] },
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
            skull_stripped: { type: 'File', label: 'Skull-stripped output', glob: ['anatSS.$(inputs.subid).*'] },
            warped: { type: 'File', label: 'Warped to template', glob: ['anatQQ.$(inputs.subid).*'] },
            warp: { type: 'File', label: 'Warp field', glob: ['anatQQ.$(inputs.subid)_WARP.*'] },
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
            aligned_anat: { type: 'File?', label: 'Aligned anatomical', glob: ['*_al+orig.*', '*_al.nii*'] },
            aligned_epi: { type: 'File?', label: 'Aligned EPI', glob: ['*_al_reg+orig.*'] },
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
            stats: { type: 'File', label: 'Statistics output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket).nii*'] },
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
            stats: { type: 'File', label: 'REML statistics', glob: ['$(inputs.Rbuck)+orig.*', '$(inputs.Rbuck).nii*'] },
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
            stats: { type: 'File', label: 'T-test output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            stats: { type: 'File', label: 'ANOVA output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket).nii*'] },
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
            stats: { type: 'File', label: 'ANOVA2 output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket).nii*'] },
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
            stats: { type: 'File', label: 'ANOVA3 output', glob: ['$(inputs.bucket)+orig.*', '$(inputs.bucket).nii*'] },
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
            stats: { type: 'File', label: 'MEMA output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            stats: { type: 'File', label: 'MVM output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            stats: { type: 'File', label: 'LME output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            stats: { type: 'File', label: 'LMEr output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            correlation: { type: 'File', label: 'Correlation output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            mean_corr: { type: 'File?', label: 'Mean correlation', glob: ['$(inputs.Mean)+orig.*', '$(inputs.Mean).nii*'] },
            zmean_corr: { type: 'File?', label: 'Fisher Z mean', glob: ['$(inputs.Zmean)+orig.*', '$(inputs.Zmean).nii*'] },
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
            filtered: { type: 'File', label: 'Bandpassed output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            dataset: { type: 'File', label: 'Output dataset', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            resampled: { type: 'File', label: 'Resampled output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            fractionized: { type: 'File', label: 'Fractionized output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            result: { type: 'File', label: 'Calculated output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            stats: { type: 'File', label: 'Statistics output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            copied: { type: 'File', label: 'Copied dataset', glob: ['$(inputs.new_prefix)+orig.*', '$(inputs.new_prefix).nii*'] },
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
            padded: { type: 'File', label: 'Padded output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            warped: { type: 'File', label: 'Warped output', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            concatenated_warp: { type: 'File', label: 'Combined warp', glob: ['$(inputs.prefix)+orig.*', '$(inputs.prefix).nii*'] },
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
            input: { type: 'File', passthrough: true, label: 'Input volume file' },
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
            input_image: { type: 'File', passthrough: true, label: 'Input image for bias correction' },
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
    }
};