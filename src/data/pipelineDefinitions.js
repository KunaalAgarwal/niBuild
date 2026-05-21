/**
 * Registry of expandable pipeline definitions.
 *
 * A pipeline definition is a pre-baked constituent graph (CLI-backed nodes
 * with edges describing data flow + optional conditional gating) that can
 * be splattered onto the canvas when a user expands a PipelineNode.
 *
 * Each entry conforms to the shape:
 *   {
 *     id, name, version, description, docUrl, citation,
 *     options: { [optionKey]: { type, default, label, description, symbols? } },
 *     nodes:   [ { id, label, stage?, parameters?, scatterInputs?, ..., conditional?, _gap?, position } ],
 *     edges:   [ { id, source, target, data: { mappings: [{ sourceOutput, targetInput }] } } ],
 *     boundaryNodes: { firstNonDummy, lastNonDummy },
 *   }
 *
 * The node shape matches the flat serialized form used by
 * `workflowDiff.js::serializeNodes` so the existing `deserializeNode` and
 * `expandSavedWorkflow` machinery can be reused.
 */

import { FMRIPREP_PIPELINE } from './pipelines/fmriprep.js';

export const PIPELINE_DEFINITIONS = {
    fmriprep: FMRIPREP_PIPELINE,
};

/** Lookup a pipeline definition by id. Returns null if not registered. */
export function getPipelineDefinition(id) {
    return PIPELINE_DEFINITIONS[id] || null;
}

/** Check whether a tool name (as registered in toolAnnotations) has a pipeline definition. */
export function hasPipelineDefinition(toolName) {
    return Object.prototype.hasOwnProperty.call(PIPELINE_DEFINITIONS, toolName);
}

/**
 * Evaluate a node's `conditional` clause against a set of user options.
 * Returns true if the node should be included (or no conditional at all).
 *
 * Supported shapes:
 *   { option: 'freesurfer', equals: true }
 *   { option: 'cifti_output', notEquals: null }
 *   { option: 'sdc_method', in: ['pepolar', 'phasediff'] }
 */
export function nodeMatchesConditional(node, options) {
    const c = node.conditional;
    if (!c) return true;
    const value = options?.[c.option];
    if ('equals' in c) return value === c.equals;
    if ('notEquals' in c) return value !== c.notEquals;
    if (Array.isArray(c.in)) return c.in.includes(value);
    return true;
}

/**
 * Filter a pipeline's nodes + edges by the supplied options.
 * Returns { nodes, edges } with conditional nodes and orphaned edges removed.
 */
export function filterPipelineByOptions(definition, options) {
    const keptNodeIds = new Set();
    const nodes = definition.nodes.filter((n) => {
        if (nodeMatchesConditional(n, options)) {
            keptNodeIds.add(n.id);
            return true;
        }
        return false;
    });
    const edges = definition.edges.filter((e) => keptNodeIds.has(e.source) && keptNodeIds.has(e.target));
    return { nodes, edges };
}

/** Default options for a pipeline, derived from its `options` schema. */
export function getDefaultPipelineOptions(definition) {
    const result = {};
    for (const [key, spec] of Object.entries(definition.options || {})) {
        result[key] = spec.default;
    }
    return result;
}
