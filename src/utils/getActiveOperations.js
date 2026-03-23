import { FIXED_POSITION_PARAMS } from './toolAnnotations.js';

/**
 * Return the list of parameter objects that qualify as "active operations"
 * for an orderSensitive tool.
 *
 * @param {Array} allParams - combined required + optional param objects
 * @param {Object} paramValues - current parameter values keyed by name
 * @param {Map|null} wiredInputs - Map of param name -> wired source array
 * @param {Array} operationOrder - user-defined ordering array
 * @returns {Array} active param objects (unordered)
 */
export function getActiveOperations(allParams, paramValues, wiredInputs, operationOrder) {
    return allParams.filter((p) => {
        if (FIXED_POSITION_PARAMS.has(p.name)) return false;
        if (!p.flag) return false;
        const ws = wiredInputs?.get(p.name) || [];
        if (ws.length > 0) return true;
        if (/^(File|Directory)/.test(p.type) && operationOrder.includes(p.name)) return true;
        const val = paramValues[p.name];
        return val !== undefined && val !== null && val !== '' && val !== false;
    });
}
