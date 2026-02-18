import YAML from 'js-yaml';

/**
 * CWL Parser: Fetches, parses, and caches CWL tool definitions.
 *
 * This is the runtime bridge that makes CWL files the single source of truth
 * for tool parameters. It normalizes the CWL type system into a consistent
 * shape that the rest of the app can consume.
 *
 * Supported CWL type variants:
 *   - Simple:   'File', 'string', 'int', 'double', 'boolean', 'Directory', 'long', 'float'
 *   - Nullable: ['null', 'string']  or  string?
 *   - Enum:     { type: 'enum', symbols: [...] }
 *   - Array:    'File[]'  or  { type: 'array', items: 'File' }
 *   - Record:   { type: 'record', fields: {...} }
 *   - Union-of-records: ['null', {type: record, ...}, {type: record, ...}]
 */

// ── Cache ────────────────────────────────────────────────────────────────

const resolvedCache = new Map();   // cwlPath → ParsedTool (resolved)
const pendingCache = new Map();    // cwlPath → Promise<ParsedTool>

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Synchronous accessor — returns parsed tool or null if not yet loaded.
 * After preloadAllCWL() completes, this always returns a value for valid paths.
 */
export function getToolDefinitionSync(cwlPath) {
    return resolvedCache.get(cwlPath) || null;
}

/**
 * Async accessor — fetches and parses if not cached.
 */
export async function getToolDefinition(cwlPath) {
    if (resolvedCache.has(cwlPath)) return resolvedCache.get(cwlPath);
    if (pendingCache.has(cwlPath)) return pendingCache.get(cwlPath);

    const promise = fetchAndParse(cwlPath);
    pendingCache.set(cwlPath, promise);
    const result = await promise;
    resolvedCache.set(cwlPath, result);
    pendingCache.delete(cwlPath);
    return result;
}

/**
 * Preload all CWL files in parallel. Call once on app mount.
 * After this resolves, getToolDefinitionSync() works for all paths.
 */
export async function preloadAllCWL(cwlPaths) {
    const results = await Promise.allSettled(
        cwlPaths.map(async (p) => {
            try {
                const parsed = await fetchAndParse(p);
                resolvedCache.set(p, parsed);
                return parsed;
            } catch (err) {
                console.warn(`[cwlParser] Failed to load ${p}:`, err.message);
                return null;
            }
        })
    );
    return results;
}

/**
 * Returns true once at least one CWL file has been cached.
 */
export function isPreloaded() {
    return resolvedCache.size > 0;
}

/**
 * Returns the number of cached tool definitions.
 */
export function getCacheSize() {
    return resolvedCache.size;
}

// ── Fetch & Parse ────────────────────────────────────────────────────────

async function fetchAndParse(cwlPath) {
    const base = import.meta.env.BASE_URL;
    const url = `${base}${cwlPath}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
    const text = await res.text();
    let doc;
    try {
        doc = YAML.load(text);
    } catch (err) {
        throw new Error(`YAML parse error in ${cwlPath}: ${err.message}`);
    }
    return parseCWLDocument(doc, cwlPath);
}

/**
 * Parse a CWL document object into a normalized tool definition.
 *
 * Returns:
 * {
 *   inputs:  { [name]: InputDef },
 *   outputs: { [name]: OutputDef },
 *   dockerImage: string | null,
 *   baseCommand: string | string[] | null,
 * }
 */
function parseCWLDocument(doc, cwlPath) {
    const inputs = {};
    const outputs = {};

    // ── Parse inputs ──
    if (doc.inputs) {
        const inputEntries = Array.isArray(doc.inputs)
            ? doc.inputs.map(inp => [inp.id, inp])
            : Object.entries(doc.inputs);

        for (const [name, def] of inputEntries) {
            inputs[name] = parseInput(name, def);
        }
    }

    // ── Parse outputs ──
    if (doc.outputs) {
        const outputEntries = Array.isArray(doc.outputs)
            ? doc.outputs.map(out => [out.id, out])
            : Object.entries(doc.outputs);

        for (const [name, def] of outputEntries) {
            outputs[name] = parseOutput(name, def);
        }
    }

    // ── Docker image ──
    const dockerImage = extractDockerImage(doc);

    return {
        inputs,
        outputs,
        dockerImage,
        baseCommand: doc.baseCommand || null,
    };
}

// ── Input Parsing ────────────────────────────────────────────────────────

function parseInput(name, def) {
    const typeInfo = normalizeType(def.type);
    const flag = extractFlag(def);
    const label = def.label || name;
    const hasDefault = def.default !== undefined;

    return {
        name,
        label,
        flag,
        hasDefault,
        defaultValue: hasDefault ? def.default : undefined,
        ...typeInfo,
        // Convenience booleans for the modal
        isScalarEditable: isScalarType(typeInfo),
    };
}

function parseOutput(name, def) {
    const typeInfo = normalizeType(def.type);
    const glob = extractGlob(def);
    const label = def.label || name;

    return {
        name,
        label,
        glob,
        ...typeInfo,
    };
}

// ── Type Normalization ───────────────────────────────────────────────────

/**
 * Normalize any CWL type representation into a consistent shape:
 * {
 *   baseType:    'string' | 'int' | 'double' | 'boolean' | 'float' | 'long'
 *                | 'File' | 'Directory' | 'enum' | 'record' | 'Any' | 'unknown'
 *   nullable:    boolean   — true if type includes 'null'
 *   isArray:     boolean   — true for array types (File[], string[], etc.)
 *   isEnum:      boolean   — true for enum types
 *   enumSymbols: string[]  — enum values (if isEnum)
 *   isRecord:    boolean   — true for record / union-of-records
 *   recordVariants: object[] — record definitions (if isRecord)
 *   arrayItemType: string  — base type of array items (if isArray)
 * }
 */
export function normalizeType(cwlType) {
    // Default shape
    const result = {
        baseType: 'unknown',
        nullable: false,
        isArray: false,
        isEnum: false,
        enumSymbols: [],
        isRecord: false,
        recordVariants: [],
        arrayItemType: null,
    };

    if (cwlType == null) {
        result.baseType = 'Any';
        result.nullable = true;
        return result;
    }

    // Case 1: Simple string type — 'File', 'string', 'int', etc.
    if (typeof cwlType === 'string') {
        return parseStringType(cwlType, result);
    }

    // Case 2: Array notation — ['null', 'string'], ['null', {type: enum, ...}], etc.
    if (Array.isArray(cwlType)) {
        return parseArrayNotation(cwlType, result);
    }

    // Case 3: Object notation — {type: 'enum', symbols: [...]}, {type: 'array', items: ...}, {type: 'record', ...}
    if (typeof cwlType === 'object') {
        return parseObjectType(cwlType, result);
    }

    return result;
}

/**
 * Parse a simple string type like 'File', 'string?', 'int[]', etc.
 */
function parseStringType(typeStr, result) {
    // Nullable shorthand: 'string?'
    if (typeStr.endsWith('?')) {
        const inner = typeStr.slice(0, -1);
        result.nullable = true;
        // Could be 'File[]?' etc.
        if (inner.endsWith('[]')) {
            result.isArray = true;
            result.arrayItemType = inner.slice(0, -2);
            result.baseType = result.arrayItemType;
        } else {
            result.baseType = inner;
        }
        return result;
    }

    // Array shorthand: 'File[]'
    if (typeStr.endsWith('[]')) {
        result.isArray = true;
        result.arrayItemType = typeStr.slice(0, -2);
        result.baseType = result.arrayItemType;
        return result;
    }

    // Null type
    if (typeStr === 'null') {
        result.baseType = 'null';
        result.nullable = true;
        return result;
    }

    // Plain type
    result.baseType = typeStr;
    return result;
}

/**
 * Parse array notation like ['null', 'string'] or ['null', {type: 'enum', ...}]
 */
function parseArrayNotation(typeArr, result) {
    const hasNull = typeArr.includes('null');
    result.nullable = hasNull;

    const nonNull = typeArr.filter(t => t !== 'null');

    if (nonNull.length === 0) {
        result.baseType = 'null';
        result.nullable = true;
        return result;
    }

    // Check for union-of-records (mutually exclusive params)
    const records = nonNull.filter(t => typeof t === 'object' && t !== null && t.type === 'record');
    if (records.length > 0) {
        result.baseType = 'record';
        result.isRecord = true;
        result.recordVariants = records;
        return result;
    }

    // Single non-null type
    if (nonNull.length === 1) {
        const inner = nonNull[0];

        // Inner is a string: ['null', 'string']
        if (typeof inner === 'string') {
            const innerResult = parseStringType(inner, result);
            innerResult.nullable = hasNull;
            return innerResult;
        }

        // Inner is an object: ['null', {type: 'enum', ...}] or ['null', {type: 'array', ...}]
        if (typeof inner === 'object') {
            const innerResult = parseObjectType(inner, result);
            innerResult.nullable = hasNull;
            return innerResult;
        }
    }

    // Multiple non-null types (rare union) — treat as Any
    result.baseType = 'Any';
    return result;
}

/**
 * Parse object type notation: {type: 'enum', symbols: [...]}, {type: 'array', items: ...}, etc.
 */
function parseObjectType(typeObj, result) {
    if (!typeObj || typeof typeObj !== 'object') return result;

    if (typeObj.type === 'enum') {
        result.baseType = 'enum';
        result.isEnum = true;
        result.enumSymbols = typeObj.symbols || [];
        return result;
    }

    if (typeObj.type === 'array') {
        result.isArray = true;
        const items = typeObj.items;
        if (typeof items === 'string') {
            result.baseType = items;
            result.arrayItemType = items;
        } else {
            result.baseType = 'Any';
            result.arrayItemType = 'Any';
        }
        return result;
    }

    if (typeObj.type === 'record') {
        result.baseType = 'record';
        result.isRecord = true;
        result.recordVariants = [typeObj];
        return result;
    }

    // Unknown object type
    result.baseType = 'Any';
    return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Determine if a normalized type is a simple scalar editable in the modal.
 * Scalars: string, int, double, float, long, boolean, enum
 * NOT scalars: File, Directory, arrays, records
 */
function isScalarType(typeInfo) {
    if (typeInfo.isArray || typeInfo.isRecord) return false;
    const scalars = ['string', 'int', 'double', 'float', 'long', 'boolean', 'enum'];
    return scalars.includes(typeInfo.baseType);
}

/**
 * Extract the CLI flag (prefix) from an input's inputBinding.
 */
function extractFlag(def) {
    if (!def.inputBinding) return null;
    return def.inputBinding.prefix || null;
}

/**
 * Extract glob patterns from an output's outputBinding.
 */
function extractGlob(def) {
    if (!def.outputBinding || !def.outputBinding.glob) return [];
    const g = def.outputBinding.glob;
    return Array.isArray(g) ? g : [g];
}

/**
 * Extract Docker image from hints or requirements.
 */
function extractDockerImage(doc) {
    const hints = doc.hints || {};
    const reqs = doc.requirements || {};

    // CWL spec: requirements override hints
    const dockerReq = reqs.DockerRequirement || hints.DockerRequirement;
    if (dockerReq) return dockerReq.dockerPull || null;

    // Array form: check requirements first, then hints
    if (Array.isArray(doc.requirements)) {
        const r = doc.requirements.find(r => r.class === 'DockerRequirement');
        if (r) return r.dockerPull || null;
    }
    if (Array.isArray(doc.hints)) {
        const h = doc.hints.find(h => h.class === 'DockerRequirement');
        if (h) return h.dockerPull || null;
    }

    return null;
}
