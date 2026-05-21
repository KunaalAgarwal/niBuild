/**
 * Download standard reference templates referenced in src/data/standardTemplates.js
 * into public/templates/ so the app can serve them from the same origin.
 *
 * TemplateFlow's S3 bucket sets no Access-Control-Allow-Origin header, so the
 * browser cannot fetch directly. Node's `fetch` is exempt from CORS, so we
 * pull server-side at build time and ship the files inside the Vite bundle.
 *
 * Usage: node scripts/downloadStandardTemplates.mjs
 *
 * Re-running skips files already present. To force a refresh, delete the
 * file under public/templates/ first. Exits non-zero if any download fails
 * so `npm run prebuild` blocks a broken build from deploying.
 */

import { mkdir, stat, rename, unlink, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { STANDARD_TEMPLATES } from '../src/data/standardTemplates.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const outDir = join(projectRoot, 'public', 'templates');

await mkdir(outDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;

for (const tpl of STANDARD_TEMPLATES) {
    const dest = join(outDir, tpl.filename);
    const url = tpl.source?.url;
    if (!url) {
        console.warn(`[skip] ${tpl.id}: no source.url`);
        skipped++;
        continue;
    }

    const existing = await stat(dest).catch(() => null);
    if (existing && existing.isFile() && existing.size > 0) {
        console.log(`[skip] ${tpl.id}: cached (${existing.size} bytes)`);
        skipped++;
        continue;
    }

    process.stdout.write(`[fetch] ${tpl.id}: ${url} -> ${tpl.filename} ... `);
    const tmp = `${dest}.tmp`;
    try {
        const res = await fetch(url, { redirect: 'follow' });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const buf = Buffer.from(await res.arrayBuffer());
        await writeFile(tmp, buf);
        await rename(tmp, dest);
        console.log(`ok (${buf.length} bytes)`);
        downloaded++;
    } catch (err) {
        await unlink(tmp).catch(() => {});
        console.log(`FAIL: ${err.message}`);
        failed++;
    }
}

console.log(`\nSummary: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
