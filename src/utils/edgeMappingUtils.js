import { getToolConfigSync } from './toolRegistry.js';
import { checkExtensionCompatibility } from './extensionValidation.js';

/**
 * Type compatibility checking utilities for edge mapping.
 * Used by EdgeMappingModal to validate output→input connections.
 */

export const getBaseType = (type) => {
    // Remove nullable (?) and array ([]) modifiers
    return type?.replace(/[?[\]]/g, '') || 'File';
};

export const isArrayType = (type) => type?.includes('[]') || false;

export const formatTypeHint = (type, extensions) => {
    const baseType = getBaseType(type);
    const isArray = isArrayType(type);
    const suffix = isArray ? '[]' : '';

    if (baseType === 'File' && extensions && extensions.length > 0) {
        return extensions.map((ext) => ext + suffix).join(', ');
    }

    return type || 'File';
};

export const checkTypeCompatibility = (
    outputType,
    inputType,
    outputExtensions = null,
    inputAcceptedExtensions = null,
    sourceIsScattered = false,
) => {
    if (!outputType || !inputType) return { compatible: true, warning: true, reason: 'Type information unavailable' };

    const outBase = getBaseType(outputType);
    const inBase = getBaseType(inputType);

    // 'any' type (used by dummy I/O nodes) is always compatible
    if (outBase === 'any' || inBase === 'any') return { compatible: true };

    // Enum ↔ string: enums are constrained strings, treat as compatible
    if ((outBase === 'enum' && inBase === 'string') || (outBase === 'string' && inBase === 'enum')) {
        return { compatible: true };
    }

    // File[] ↔ Directory: a collection of files is compatible with a directory
    if (
        (outBase === 'File' && inBase === 'Directory' && isArrayType(outputType)) ||
        (outBase === 'Directory' && inBase === 'File' && isArrayType(inputType))
    ) {
        return { compatible: true, warning: true, reason: 'File[] treated as Directory' };
    }

    // Base type check — must match before considering array/scatter dimensions
    if (outBase !== inBase) {
        return { compatible: false, reason: `Type mismatch: ${outputType} → ${inputType}` };
    }

    // Extension compatibility check for File types
    // Save warning but don't return early — scatter/gather checks below take priority
    let extWarning = null;
    if (outBase === 'File' && (outputExtensions || inputAcceptedExtensions)) {
        const extCompat = checkExtensionCompatibility(outputExtensions, inputAcceptedExtensions);
        if (!extCompat.compatible) {
            return {
                compatible: false,
                reason: extCompat.reason,
                isExtensionMismatch: true,
            };
        }
        if (extCompat.warning) {
            extWarning = { warning: true, reason: extCompat.reason, isExtensionWarning: true };
        }
    }

    const outArray = isArrayType(outputType);
    const inArray = isArrayType(inputType);

    // Array → scalar: scatter unwraps the array across downstream inputs
    if (outArray && !inArray) {
        return {
            compatible: true,
            scatterNote: true,
            reason: `Array output (${outputType}) will scatter across ${inputType} inputs`,
        };
    }
    // Scalar → array: normally incompatible, but valid when source is scattered (gather)
    if (!outArray && inArray) {
        if (sourceIsScattered) {
            return {
                compatible: true,
                gatherNote: true,
                reason: 'Scatter outputs will be gathered into a single array input',
            };
        }
        return { compatible: false, reason: `Type mismatch: ${outputType} cannot satisfy ${inputType}` };
    }

    // Scatter inheritance note: scalar → scalar when source is scattered
    if (sourceIsScattered && !outArray && !inArray) {
        return { compatible: true, scatterNote: true, reason: 'Scatter will be inherited by this step' };
    }

    if (extWarning) return { compatible: true, ...extWarning };
    return { compatible: true };
};

/**
 * Get tool inputs/outputs, with fallback for undefined tools.
 * Includes file extension metadata for validation.
 *
 * For custom workflow nodes, collects IO from all internal non-dummy nodes
 * with namespaced identifiers (internalNodeId/ioName) and group metadata.
 */
export const getToolIO = (nodeData) => {
    const { label: toolLabel, isDummy, isCustomWorkflow, internalNodes } = nodeData;

    // Standard Template nodes: one File output named after the chosen template id
    if (isDummy && nodeData.isStandardTemplate) {
        const tpl = nodeData.template;
        const tplId = nodeData.templateId;
        if (!tplId || !tpl) {
            return {
                outputs: [{ name: 'template', type: 'File', label: 'template (not configured)', extensions: [] }],
                inputs: [],
                isGeneric: false,
                isStandardTemplate: true,
            };
        }
        return {
            outputs: [
                {
                    name: tplId,
                    type: 'File',
                    label: tpl.label || tplId,
                    description: tpl.citation || '',
                    extensions: ['.nii.gz', '.nii', '.gii', '.mgz', '.mgh'],
                },
            ],
            inputs: [],
            isGeneric: false,
            isStandardTemplate: true,
        };
    }

    // BIDS Input nodes: dynamic outputs from BIDS selections
    if (isDummy && nodeData.isBIDS) {
        const selections = nodeData.bidsSelections?.selections || {};
        const fileOutputs =
            Object.keys(selections).length > 0
                ? Object.entries(selections).map(([key]) => ({
                      name: key,
                      type: 'File[]',
                      label: key,
                      extensions: [],
                  }))
                : [{ name: 'data', type: 'File[]', label: 'data (no selections yet)', extensions: [] }];
        const outputs = [
            ...fileOutputs,
            {
                name: 'bids_directory',
                type: 'Directory',
                label: 'Entire BIDS Directory',
                description: 'Used when bids_dir is accepted as input',
                extensions: [],
            },
        ];
        return {
            outputs,
            inputs: [],
            isGeneric: false,
            isBIDS: true,
        };
    }

    // Dummy I/O nodes accept any data type
    if (isDummy) {
        return {
            outputs: [{ name: 'data', type: 'any', label: 'data', extensions: [] }],
            inputs: [{ name: 'data', type: 'any', label: 'data', acceptedExtensions: null }],
            isGeneric: true,
            isDummy: true,
        };
    }

    // Custom workflow nodes: aggregate IO from all internal non-dummy nodes
    if (isCustomWorkflow && internalNodes) {
        const { internalEdges } = nodeData;
        const nonDummyNodes = internalNodes.filter((n) => !n.isDummy);
        const outputs = [];
        const inputs = [];

        // Build set of intermediate outputs consumed by downstream internal nodes
        const consumedOutputs = new Set();
        if (internalEdges) {
            for (const edge of internalEdges) {
                const srcNode = internalNodes.find((n) => n.id === edge.source);
                const tgtNode = internalNodes.find((n) => n.id === edge.target);
                if (srcNode && tgtNode && !srcNode.isDummy && !tgtNode.isDummy) {
                    for (const m of edge.data?.mappings || []) {
                        consumedOutputs.add(`${edge.source}/${m.sourceOutput}`);
                    }
                }
            }
        }

        nonDummyNodes.forEach((node, index) => {
            const tool = getToolConfigSync(node.label);
            if (!tool) return;

            Object.entries(tool.outputs).forEach(([name, def]) => {
                const namespacedName = `${node.id}/${name}`;
                if (consumedOutputs.has(namespacedName)) return; // Skip intermediate outputs
                outputs.push({
                    name: namespacedName,
                    type: def.type,
                    label: def.label || name,
                    extensions: def.extensions || [],
                    enumSymbols: def.enumSymbols || null,
                    group: node.label,
                    groupIndex: index,
                });
            });

            // Required inputs
            Object.entries(tool.requiredInputs).forEach(([name, def]) => {
                inputs.push({
                    name: `${node.id}/${name}`,
                    type: def.type,
                    label: def.label || name,
                    acceptedExtensions: def.acceptedExtensions || null,
                    required: true,
                    enumSymbols: def.enumSymbols || def.options || null,
                    group: node.label,
                    groupIndex: index,
                });
            });

            // Optional inputs (exclude record types)
            Object.entries(tool.optionalInputs || {})
                .filter(([_, def]) => def.type !== 'record')
                .forEach(([name, def]) => {
                    inputs.push({
                        name: `${node.id}/${name}`,
                        type: def.type,
                        label: def.label || name,
                        acceptedExtensions: null,
                        required: false,
                        enumSymbols: def.enumSymbols || def.options || null,
                        group: node.label,
                        groupIndex: index,
                    });
                });
        });

        // Compute per-tool scatter/gather status for group header indicators
        const groupInfo = {};
        const scatteredIds = new Set();

        // Phase 1: explicit scatter (nodes with scatterInputs)
        nonDummyNodes.forEach((node) => {
            if (node.scatterInputs?.length > 0) {
                scatteredIds.add(node.id);
                groupInfo[node.label] = { scattered: true };
            }
        });

        // Phase 2: propagate scatter through internal edges
        if (internalEdges && scatteredIds.size > 0) {
            const queue = [...scatteredIds];
            const visited = new Set(queue);
            while (queue.length > 0) {
                const srcId = queue.shift();
                for (const edge of internalEdges) {
                    if (edge.source !== srcId || visited.has(edge.target)) continue;
                    const tgtNode = nonDummyNodes.find((n) => n.id === edge.target);
                    if (!tgtNode) continue;
                    const tgtTool = getToolConfigSync(tgtNode.label);
                    if (!tgtTool) continue;
                    const mappings = edge.data?.mappings || [];
                    if (mappings.length === 0) continue;
                    // Check if ALL mapped inputs are array types (gather) vs any scalar (scatter inherit)
                    const allArray = mappings.every((m) => {
                        const inputDef =
                            tgtTool.requiredInputs?.[m.targetInput] || tgtTool.optionalInputs?.[m.targetInput];
                        return inputDef?.type?.includes('[]');
                    });
                    if (allArray) {
                        groupInfo[tgtNode.label] = { ...(groupInfo[tgtNode.label] || {}), gathered: true };
                    } else {
                        scatteredIds.add(tgtNode.id);
                        visited.add(tgtNode.id);
                        groupInfo[tgtNode.label] = { ...(groupInfo[tgtNode.label] || {}), scattered: true };
                        queue.push(tgtNode.id);
                    }
                }
            }
        }

        return { outputs, inputs, isGeneric: false, isCustomWorkflow: true, groupInfo };
    }

    const tool = getToolConfigSync(toolLabel);
    if (tool) {
        return {
            outputs: Object.entries(tool.outputs).map(([name, def]) => ({
                name,
                type: def.type,
                label: def.label || name,
                extensions: def.extensions || [],
                enumSymbols: def.enumSymbols || null,
            })),
            inputs: [
                // Required inputs first
                ...Object.entries(tool.requiredInputs).map(([name, def]) => ({
                    name,
                    type: def.type,
                    label: def.label || name,
                    acceptedExtensions: def.acceptedExtensions || null,
                    required: true,
                    enumSymbols: def.enumSymbols || def.options || null,
                })),
                // Optional inputs second (exclude record types)
                ...Object.entries(tool.optionalInputs || {})
                    .filter(([_, def]) => def.type !== 'record')
                    .map(([name, def]) => ({
                        name,
                        type: def.type,
                        label: def.label || name,
                        acceptedExtensions: null,
                        required: false,
                        enumSymbols: def.enumSymbols || def.options || null,
                    })),
            ],
            isGeneric: false,
        };
    }
    // Fallback for undefined tools
    return {
        outputs: [{ name: 'output', type: 'File', label: 'Output', extensions: [] }],
        inputs: [{ name: 'input', type: 'File', label: 'Input', acceptedExtensions: null }],
        isGeneric: true,
    };
};
