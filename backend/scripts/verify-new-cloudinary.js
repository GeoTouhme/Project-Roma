/**
 * verify-new-cloudinary.js
 *
 * HEAD-checks every new Cloudinary URL to confirm the asset exists.
 *
 * Usage:
 *   node scripts/verify-new-cloudinary.js --map=/backups/migration-url-map.jsonl
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ─── CLI args ──────────────────────────────────────────────────────

const MAP_ARG = process.argv.find(arg => arg.startsWith('--map='));
const MAP_PATH = MAP_ARG ? MAP_ARG.split('=')[1] : null;

if (!MAP_PATH) {
  console.error('Usage: node scripts/verify-new-cloudinary.js --map=<file>');
  process.exit(1);
}

// ─── Config ────────────────────────────────────────────────────────

const CONCURRENCY = 10;

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const raw = fs.readFileSync(MAP_PATH, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  const entries = lines.map(l => JSON.parse(l));

  console.log('URLs to verify:', entries.length);

  const FAILURES_PATH = path.join(path.dirname(MAP_PATH), 'verify-failures.jsonl');
  const failures = [];

  for (let i = 0; i < entries.length; i += CONCURRENCY) {
    const batch = entries.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async entry => {
        try {
          await axios.head(entry.new_url, { timeout: 15000, maxRedirects: 5 });
          return { ok: true, public_id: entry.public_id };
        } catch (err) {
          return { ok: false, public_id: entry.public_id, url: entry.new_url, error: err.message };
        }
      })
    );

    for (const r of results) {
      if (!r.ok) failures.push(r);
    }

    const done = Math.min(i + CONCURRENCY, entries.length);
    const okCount = done - failures.length;
    process.stdout.write(`\rVerified: ${done}/${entries.length}  OK=${okCount}  FAIL=${failures.length}`);
  }
  process.stdout.write('\n');

  if (failures.length > 0) {
    fs.writeFileSync(FAILURES_PATH, failures.map(f => JSON.stringify(f)).join('\n') + '\n');
    console.log('Failures written:', FAILURES_PATH);
  }

  console.log('Done. Total:', entries.length, 'OK:', entries.length - failures.length, 'Fail:', failures.length);
  process.exit(failures.length > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
