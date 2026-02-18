import { TOOL_ANNOTATIONS } from './toolAnnotations.js';
import { getToolDefinitionSync } from './cwlParser.js';

/**
 * Tool Registry: merges CWL-parsed data with annotations to produce
 * tool config objects with the same shape consumers currently expect.
 *
 * This is the single API all components should use to get tool information.
 *
 * Shape returned by getToolConfigSync():
 * {
 *   id:              string,
 *   cwlPath:         string,
 *   dockerImage:     string,
 *   requiredInputs:  { [name]: { type, label, acceptedExtensions?, flag? } },
 *   optionalInputs:  { [name]: { type, label, flag?, bounds?, options?, isEnum?, enumSymbols? } },
 *   outputs:         { [name]: { type, label, glob, requires?, extensions? } },
 *   // UI fields:
 *   fullName?, function?, modality?, keyParameters?, keyPoints?, typicalUse?, docUrl?
 * }
 */

// ── Cache ────────────────────────────────────────────────────────────────

const mergedCache = new Map();

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Get a merged tool config by tool name. Returns null if tool is unknown.
 * After CWL preload, this returns the full merged config.
 * Before preload (or if CWL fetch failed), returns annotation-only fallback.
 */
export function getToolConfigSync(toolName) {
    if (mergedCache.has(toolName)) return mergedCache.get(toolName);

    const annotation = TOOL_ANNOTATIONS[toolName];
    if (!annotation) return null;

    const cwlPath = annotation.cwlPath;
    const parsed = cwlPath ? getToolDefinitionSync(cwlPath) : null;

    const merged = parsed
        ? mergeToolData(toolName, parsed, annotation)
        : annotationOnlyFallback(toolName, annotation);

    mergedCache.set(toolName, merged);
    return merged;
}

/**
 * Invalidate the merge cache. Call after CWL preload completes
 * so that subsequent getToolConfigSync() calls pick up the parsed data.
 */
export function invalidateMergeCache() {
    mergedCache.clear();
}

// ── Merge Logic ──────────────────────────────────────────────────────────

/**
 * Merge CWL-parsed inputs/outputs with annotation metadata.
 * Returns a normalized tool config object.
 */
function mergeToolData(toolName, parsed, annotation) {
    const requiredInputs = {};
    const optionalInputs = {};

    // Classify parsed CWL inputs as required vs optional
    for (const [inputName, inputDef] of Object.entries(parsed.inputs)) {
        const acceptedExt = annotation.inputExtensions?.[inputName] || null;
        const inputBounds = annotation.bounds?.[inputName] || null;
        const enumHint = annotation.enumHints?.[inputName] || null;

        // Map CWL types to the type strings consumers expect
        const type = mapBaseType(inputDef);

        const enriched = {
            type,
            label: inputDef.label,
            flag: inputDef.flag || null,
        };

        // Add acceptedExtensions if present in annotations
        if (acceptedExt && acceptedExt.length > 0) enriched.acceptedExtensions = acceptedExt;

        // Add bounds if present
        if (inputBounds) enriched.bounds = inputBounds;

        // Add enum options: prefer CWL-derived, fall back to annotation hints
        if (inputDef.isEnum && inputDef.enumSymbols.length > 0) {
            enriched.options = inputDef.enumSymbols;
        } else if (enumHint) {
            enriched.options = enumHint;
        }

        // Classify: nullable = optional, non-nullable = required
        if (inputDef.nullable) {
            optionalInputs[inputName] = enriched;
        } else {
            requiredInputs[inputName] = enriched;
        }
    }

    // Build outputs, overlaying `requires` from annotations
    const outputs = {};
    for (const [outputName, outputDef] of Object.entries(parsed.outputs)) {
        const type = mapOutputType(outputDef);
        outputs[outputName] = {
            type,
            label: outputDef.label,
            glob: outputDef.glob,
        };
        if (annotation.requires?.[outputName]) {
            outputs[outputName].requires = annotation.requires[outputName];
        }
        const outputExt = annotation.outputExtensions?.[outputName] || null;
        if (outputExt && outputExt.length > 0) {
            outputs[outputName].extensions = outputExt;
        }
    }

    return {
        id: toolName,
        cwlPath: annotation.cwlPath,
        dockerImage: parsed.dockerImage || null,
        requiredInputs,
        optionalInputs,
        outputs,
        // UI metadata
        fullName: annotation.fullName,
        function: annotation.function,
        modality: annotation.modality,
        keyParameters: annotation.keyParameters,
        keyPoints: annotation.keyPoints,
        typicalUse: annotation.typicalUse,
        docUrl: annotation.docUrl,
    };
}

/**
 * Fallback when CWL is not yet parsed — return minimal config from annotations only.
 */
function annotationOnlyFallback(toolName, annotation) {
    return {
        id: toolName,
        cwlPath: annotation.cwlPath,
        dockerImage: null,
        requiredInputs: {},
        optionalInputs: {},
        outputs: {},
        fullName: annotation.fullName,
        function: annotation.function,
        modality: annotation.modality,
        keyParameters: annotation.keyParameters,
        keyPoints: annotation.keyPoints,
        typicalUse: annotation.typicalUse,
        docUrl: annotation.docUrl,
    };
}

// ── Type Mapping ─────────────────────────────────────────────────────────

/**
 * Map a parsed CWL input type to the string format consumers expect.
 * Consumers expect: 'File', 'string', 'int', 'double', 'boolean', 'record', etc.
 */
function mapBaseType(inputDef) {
    if (inputDef.isRecord) return 'record';
    if (inputDef.isEnum) return 'string'; // Enums display as strings with options[]
    if (inputDef.isArray) return `${inputDef.arrayItemType || inputDef.baseType}[]`;
    return inputDef.baseType;
}

/**
 * Map a parsed CWL output type to the string format consumers expect.
 * Outputs use 'File?', 'File[]', etc.
 */
function mapOutputType(outputDef) {
    let type = outputDef.baseType;
    if (outputDef.isArray) type = `${outputDef.arrayItemType || type}[]`;
    if (outputDef.nullable) type = `${type}?`;
    return type;
}
