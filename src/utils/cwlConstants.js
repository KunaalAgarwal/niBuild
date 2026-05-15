/**
 * Shared constants used by NodeComponent and CustomWorkflowParamPanel.
 */
import { DOCKER_IMAGES } from './toolAnnotations.js';

export const VALID_OPERATORS = ['==', '!=', '>=', '<=', '>', '<'];

export const LIBRARY_MAP = {
    fsl: 'FSL',
    afni: 'AFNI',
    ants: 'ANTs',
    freesurfer: 'FreeSurfer',
    mrtrix3: 'MRtrix3',
    fmriprep: 'fMRIPrep',
    mriqc: 'MRIQC',
    connectome_workbench: 'Connectome Workbench',
    amico: 'AMICO',
};

// Pre-computed inverse lookup: docker image base → library display name (O(1))
export const IMAGE_TO_LIBRARY = new Map(Object.entries(DOCKER_IMAGES).map(([key, img]) => [img, LIBRARY_MAP[key]]));

export const getLibraryFromDockerImage = (dockerImage) => {
    const baseImage = dockerImage.split(':')[0];
    return IMAGE_TO_LIBRARY.get(baseImage) || null;
};
