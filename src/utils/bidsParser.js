/**
 * bidsParser.js — Client-side BIDS directory parser.
 *
 * Accepts a browser FileList (from <input webkitdirectory>) and produces a
 * structured representation of the BIDS dataset.  Only filenames are used for
 * NIfTI discovery; file contents are read only for small metadata files
 * (dataset_description.json, participants.tsv, sidecar JSONs).
 */

// BIDS entity keys in specification order
const ENTITY_KEYS = [
  'sub', 'ses', 'task', 'acq', 'ce', 'rec', 'dir', 'run',
  'mod', 'echo', 'flip', 'inv', 'mt', 'part', 'proc',
  'space', 'split', 'recording', 'chunk',
];

const ENTITY_REGEX = new RegExp(
  `(?:^|_)(${ENTITY_KEYS.join('|')})-([a-zA-Z0-9]+)`, 'g'
);

const NIFTI_REGEX = /\.(nii\.gz|nii)$/;
const DATATYPE_NAMES = new Set([
  'anat', 'func', 'dwi', 'fmap', 'perf',
  'meg', 'eeg', 'ieeg', 'beh', 'pet', 'micr', 'nirs', 'emg', 'motion',
]);

/**
 * Parse BIDS entities and suffix from a filename (without directory prefix).
 *
 * @param {string} filename  e.g. "sub-01_ses-pre_T1w.nii.gz"
 * @returns {{ entities: Object, suffix: string, extension: string } | null}
 */
export function parseBIDSFilename(filename) {
  const niftiMatch = filename.match(NIFTI_REGEX);
  if (!niftiMatch) return null;

  const extension = '.' + niftiMatch[1]; // ".nii.gz" or ".nii"
  const stem = filename.slice(0, -niftiMatch[0].length); // remove extension

  const entities = {};
  let lastEntityEnd = 0;
  let match;
  ENTITY_REGEX.lastIndex = 0;
  while ((match = ENTITY_REGEX.exec(stem)) !== null) {
    entities[match[1]] = match[2];
    lastEntityEnd = match.index + match[0].length;
  }

  // Suffix is the part after the last underscore that isn't an entity
  const remaining = stem.slice(lastEntityEnd);
  const suffixMatch = remaining.match(/(?:^|_)([a-zA-Z0-9]+)$/);
  const suffix = suffixMatch ? suffixMatch[1] : null;

  if (!suffix) return null;
  return { entities, suffix, extension };
}

/**
 * Parse participants.tsv content into a Map of subject ID → demographics.
 *
 * @param {string} tsvContent  Raw TSV text
 * @returns {Map<string, Object>}
 */
export function parseParticipantsTSV(tsvContent) {
  const participants = new Map();
  const lines = tsvContent.trim().split(/\r?\n/);
  if (lines.length < 2) return participants;

  const headers = lines[0].split('\t').map(h => h.trim());
  const idCol = headers.indexOf('participant_id');
  if (idCol === -1) return participants;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split('\t').map(c => c.trim());
    const subjectId = cols[idCol];
    if (!subjectId) continue;

    const row = {};
    for (let j = 0; j < headers.length; j++) {
      if (j !== idCol && cols[j] !== undefined && cols[j] !== 'n/a') {
        row[headers[j]] = cols[j];
      }
    }
    participants.set(subjectId, row);
  }
  return participants;
}

/**
 * Extract the BIDS root prefix from the FileList.
 * webkitRelativePath is "rootDir/sub-01/anat/..." — the first segment is the
 * selected directory name, which we strip to get relative-to-root paths.
 *
 * @param {FileList} fileList
 * @returns {string}  The common root prefix (including trailing /)
 */
function detectRootPrefix(fileList) {
  if (fileList.length === 0) return '';
  const first = fileList[0].webkitRelativePath;
  const slash = first.indexOf('/');
  return slash === -1 ? '' : first.slice(0, slash + 1);
}

/**
 * Validate a parsed BIDS structure and return tiered feedback.
 *
 * @param {Object} structure  Parsed bidsStructure object
 * @param {boolean} hasDatasetDescription  Whether dataset_description.json was found
 * @returns {{ errors: string[], warnings: string[], info: string[] }}
 */
export function validateBIDSStructure(structure, hasDatasetDescription) {
  const errors = [];
  const warnings = [];
  const info = [];

  if (!hasDatasetDescription) {
    errors.push('This does not appear to be a BIDS-formatted directory (missing dataset_description.json).');
  }

  const subjectIds = Object.keys(structure.subjects);
  if (subjectIds.length === 0) {
    errors.push('No sub-* directories found in the selected directory.');
  }

  if (errors.length > 0) return { errors, warnings, info };

  // Count data types per subject for consistency check
  const datatypeCounts = new Map(); // datatype → count of subjects with it
  for (const subId of subjectIds) {
    const sessions = structure.subjects[subId].sessions;
    const datatypesSeen = new Set();
    for (const sesKey of Object.keys(sessions)) {
      for (const dt of Object.keys(sessions[sesKey])) {
        datatypesSeen.add(dt);
      }
    }
    for (const dt of datatypesSeen) {
      datatypeCounts.set(dt, (datatypeCounts.get(dt) || 0) + 1);
    }
  }

  for (const [dt, count] of datatypeCounts) {
    if (count < subjectIds.length) {
      warnings.push(
        `${dt} data found in only ${count} of ${subjectIds.length} subjects.`
      );
    }
  }

  // Check for missing sidecars
  let missingSidecarCount = 0;
  for (const subId of subjectIds) {
    const sessions = structure.subjects[subId].sessions;
    for (const sesKey of Object.keys(sessions)) {
      for (const dtFiles of Object.values(sessions[sesKey])) {
        for (const f of dtFiles) {
          if (!f.sidecar || Object.keys(f.sidecar).length === 0) {
            missingSidecarCount++;
          }
        }
      }
    }
  }
  if (missingSidecarCount > 0) {
    warnings.push(`${missingSidecarCount} imaging file(s) missing JSON sidecar metadata.`);
  }

  // Summary info
  const sessionSets = new Set();
  for (const subId of subjectIds) {
    for (const sesKey of Object.keys(structure.subjects[subId].sessions)) {
      if (sesKey !== '_nosession') sessionSets.add(sesKey);
    }
  }
  const dtList = [...datatypeCounts.keys()].sort();
  const sesCount = sessionSets.size;
  info.push(
    `Found ${subjectIds.length} subject${subjectIds.length !== 1 ? 's' : ''}` +
    (sesCount > 0 ? `, ${sesCount} session${sesCount !== 1 ? 's' : ''}` : '') +
    `, ${dtList.length} data type${dtList.length !== 1 ? 's' : ''} (${dtList.join(', ')}).`
  );

  return { errors, warnings, info };
}

/**
 * Parse a browser FileList from a BIDS directory picker into a structured object.
 *
 * @param {FileList} fileList  From <input type="file" webkitdirectory>
 * @returns {Promise<{ bidsStructure: Object|null, errors: string[], warnings: string[], info: string[] }>}
 */
export async function parseBIDSDirectory(fileList) {
  const rootPrefix = detectRootPrefix(fileList);

  // Categorize files in a single pass
  const niftiFiles = [];           // { relativePath, filename, datatype, dirSegments }
  const sidecarFiles = new Map();  // relativePath (without .json) → File object
  let datasetDescriptionFile = null;
  let participantsTSVFile = null;

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const rawPath = file.webkitRelativePath;
    const relativePath = rootPrefix ? rawPath.slice(rootPrefix.length) : rawPath;

    // dataset_description.json at root level
    if (relativePath === 'dataset_description.json') {
      datasetDescriptionFile = file;
      continue;
    }

    // participants.tsv at root level
    if (relativePath === 'participants.tsv') {
      participantsTSVFile = file;
      continue;
    }

    // Parse path segments: sub-XX / [ses-XX /] datatype / filename
    const segments = relativePath.split('/');
    if (segments.length < 3) continue; // need at least sub/datatype/file

    const subDir = segments[0];
    if (!subDir.startsWith('sub-')) continue;

    // Determine datatype directory (could be segments[1] or segments[2] depending on session)
    let sesDir = null;
    let datatypeDir;
    let filenameIdx;

    if (segments[1].startsWith('ses-')) {
      sesDir = segments[1];
      datatypeDir = segments[2];
      filenameIdx = 3;
    } else {
      datatypeDir = segments[1];
      filenameIdx = 2;
    }

    if (!DATATYPE_NAMES.has(datatypeDir)) continue;

    const filename = segments[filenameIdx];
    if (!filename) continue;

    // JSON sidecar files
    if (filename.endsWith('.json')) {
      const niftiKey = relativePath.replace(/\.json$/, '');
      sidecarFiles.set(niftiKey, file);
      continue;
    }

    // Events TSV files
    if (filename.endsWith('_events.tsv')) {
      // Store path for later pairing; we'll attach to matched BOLD files
      continue;
    }

    // NIfTI files
    if (NIFTI_REGEX.test(filename)) {
      niftiFiles.push({
        relativePath,
        filename,
        subDir,
        sesDir,
        datatype: datatypeDir,
      });
    }
  }

  // Read metadata files
  let datasetName = '';
  let bidsVersion = '';
  const hasDatasetDescription = datasetDescriptionFile != null;

  if (datasetDescriptionFile) {
    try {
      const desc = JSON.parse(await datasetDescriptionFile.text());
      datasetName = desc.Name || '';
      bidsVersion = desc.BIDSVersion || '';
    } catch { /* ignore parse errors */ }
  }

  let participants = new Map();
  if (participantsTSVFile) {
    try {
      participants = parseParticipantsTSV(await participantsTSVFile.text());
    } catch { /* ignore parse errors */ }
  }

  // Build structure from NIfTI files
  const subjects = {};

  for (const nf of niftiFiles) {
    const parsed = parseBIDSFilename(nf.filename);
    if (!parsed) continue;

    const subId = nf.subDir;
    const sesKey = nf.sesDir || '_nosession';

    if (!subjects[subId]) subjects[subId] = { sessions: {} };
    if (!subjects[subId].sessions[sesKey]) subjects[subId].sessions[sesKey] = {};
    if (!subjects[subId].sessions[sesKey][nf.datatype]) {
      subjects[subId].sessions[sesKey][nf.datatype] = [];
    }

    // Look for matching sidecar
    const sidecarKey = nf.relativePath.replace(NIFTI_REGEX, '');
    const sidecarFile = sidecarFiles.get(sidecarKey);
    let sidecar = {};
    if (sidecarFile) {
      try {
        sidecar = JSON.parse(await sidecarFile.text());
      } catch { /* ignore */ }
    }

    // Look for paired events TSV (func data)
    let eventsPath = null;
    if (nf.datatype === 'func' && parsed.suffix === 'bold') {
      const eventsRelative = nf.relativePath
        .replace(/_bold\.(nii\.gz|nii)$/, '_events.tsv');
      // Check if events file exists in the FileList
      for (let i = 0; i < fileList.length; i++) {
        const fp = rootPrefix
          ? fileList[i].webkitRelativePath.slice(rootPrefix.length)
          : fileList[i].webkitRelativePath;
        if (fp === eventsRelative) {
          eventsPath = eventsRelative;
          break;
        }
      }
    }

    const fileEntry = {
      suffix: parsed.suffix,
      entities: parsed.entities,
      extension: parsed.extension,
      relativePath: nf.relativePath,
      sidecar,
    };
    if (eventsPath) fileEntry.eventsPath = eventsPath;

    subjects[subId].sessions[sesKey][nf.datatype].push(fileEntry);
  }

  const bidsStructure = {
    datasetName,
    bidsVersion,
    participants: Object.fromEntries(participants),
    subjects,
  };

  const { errors, warnings, info } = validateBIDSStructure(
    bidsStructure, hasDatasetDescription
  );

  return {
    bidsStructure: errors.length > 0 ? null : bidsStructure,
    errors,
    warnings,
    info,
  };
}
