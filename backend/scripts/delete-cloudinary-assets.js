/**
 * delete-cloudinary-assets.js
 *
 * Deletes Cloudinary assets by public_id list.
 * Refuses to run without --execute.
 *
 * Usage:
 *   node scripts/delete-cloudinary-assets.js --list=/backups/delete-public-ids.txt --dry-run
 *   node scripts/delete-cloudinary-assets.js --list=/backups/delete-public-ids.txt --execute
 */

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const cloudinary = require('../src/config/cloudinary');

// ─── CLI args ──────────────────────────────────────────────────────

const LIST_ARG = process.argv.find(arg => arg.startsWith('--list='));
const LIST_PATH = LIST_ARG ? LIST_ARG.split('=')[1] : null;

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!LIST_PATH) {
  console.error('Usage: node scripts/delete-cloudinary-assets.js --list=<file> --dry-run | --execute');
  process.exit(1);
}

if (!DRY_RUN && !EXECUTE) {
  console.error('Error: provide either --dry-run or --execute');
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const raw = fs.readFileSync(LIST_PATH, 'utf-8');
  const publicIds = raw.split('\n').map(l => l.trim()).filter(Boolean);

  console.log('Public IDs to delete:', publicIds.length);
  console.log('First 20:', publicIds.slice(0, 20).join(', '));

  if (DRY_RUN) {
    console.log('Dry run — no assets deleted.');
    process.exit(0);
  }

  const LOG_PATH = path.join(path.dirname(LIST_PATH), 'delete-log.jsonl');
  const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;

  for (let i = 0; i < publicIds.length; i += BATCH_SIZE) {
    const batch = publicIds.slice(i, i + BATCH_SIZE);
    try {
      const result = await cloudinary.api.delete_resources(batch);
      success += Object.keys(result.deleted || {}).length;
      for (const [pid, status] of Object.entries(result.deleted || {})) {
        logStream.write(JSON.stringify({ public_id: pid, status, error: null }) + '\n');
      }
      console.log(`Batch ${i + 1}-${Math.min(i + BATCH_SIZE, publicIds.length)}: deleted ${Object.keys(result.deleted || {}).length}`);
    } catch (err) {
      console.error('Batch failed:', err.message);
      failed += batch.length;
      for (const pid of batch) {
        logStream.write(JSON.stringify({ public_id: pid, status: 'failed', error: err.message }) + '\n');
      }
    }
  }

  logStream.end();
  console.log(`\nDone. Success: ${success}, Failed: ${failed}`);
  console.log('Log:', LOG_PATH);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
