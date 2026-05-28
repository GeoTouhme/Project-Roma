/**
 * migrate-to-new-cloudinary.js
 *
 * Uploads backed-up images to a NEW Cloudinary account, preserving public_id.
 *
 * Usage:
 *   node scripts/migrate-to-new-cloudinary.js \
 *     --source=/backups/cloudinary-YYYY-MM-DD/images \
 *     --keep-list=/backups/keep-public-ids.txt \
 *     --target=new \
 *     --dry-run
 *
 *   node scripts/migrate-to-new-cloudinary.js \
 *     --source=/backups/cloudinary-YYYY-MM-DD/images \
 *     --keep-list=/backups/keep-public-ids.txt \
 *     --target=new \
 *     --execute
 *
 * Env required for NEW account:
 *   CLOUDINARY_NEW_CLOUD_NAME
 *   CLOUDINARY_NEW_PUBLISHABLE_KEY
 *   CLOUDINARY_NEW_SECRET_KEY
 */

const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// ─── CLI args ──────────────────────────────────────────────────────

const SOURCE_ARG = process.argv.find(arg => arg.startsWith('--source='));
const SOURCE_DIR = SOURCE_ARG ? SOURCE_ARG.split('=')[1] : null;

const KEEP_ARG = process.argv.find(arg => arg.startsWith('--keep-list='));
const KEEP_PATH = KEEP_ARG ? KEEP_ARG.split('=')[1] : null;

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!SOURCE_DIR || !KEEP_PATH) {
  console.error('Usage: node scripts/migrate-to-new-cloudinary.js --source=<dir> --keep-list=<file> --dry-run | --execute');
  process.exit(1);
}

if (!DRY_RUN && !EXECUTE) {
  console.error('Error: provide either --dry-run or --execute');
  process.exit(1);
}

// ─── New Cloudinary config ─────────────────────────────────────────

const NEW_CLOUD_NAME = process.env.CLOUDINARY_NEW_CLOUD_NAME;
const NEW_API_KEY = process.env.CLOUDINARY_NEW_PUBLISHABLE_KEY;
const NEW_API_SECRET = process.env.CLOUDINARY_NEW_SECRET_KEY;

if (!NEW_CLOUD_NAME || !NEW_API_KEY || !NEW_API_SECRET) {
  console.error('Missing NEW Cloudinary env vars: CLOUDINARY_NEW_CLOUD_NAME, CLOUDINARY_NEW_PUBLISHABLE_KEY, CLOUDINARY_NEW_SECRET_KEY');
  process.exit(1);
}

const newCloudinary = require('cloudinary').v2;
newCloudinary.config({
  cloud_name: NEW_CLOUD_NAME,
  api_key: NEW_API_KEY,
  api_secret: NEW_API_SECRET,
  secure: true,
});

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const raw = fs.readFileSync(KEEP_PATH, 'utf-8');
  const keepIds = raw.split('\n').map(l => l.trim()).filter(Boolean);

  console.log('Images to migrate:', keepIds.length);
  console.log('Source dir:', SOURCE_DIR);
  console.log('Target cloud:', NEW_CLOUD_NAME);

  if (DRY_RUN) {
    console.log('Dry run — no uploads.');
    process.exit(0);
  }

  const MAP_PATH = path.join(path.dirname(KEEP_PATH), 'migration-url-map.jsonl');
  const logStream = fs.createWriteStream(MAP_PATH);

  let success = 0;
  let failed = 0;

  function findFileByPublicId(dir, publicId) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = findFileByPublicId(fullPath, publicId);
        if (found) return found;
      } else if (entry.name.startsWith(publicId + '.')) {
        return fullPath;
      }
    }
    return null;
  }

  for (let i = 0; i < keepIds.length; i++) {
    const publicId = keepIds[i];
    // The public_id may contain slashes; the backup preserves folder structure
    const basePath = path.join(SOURCE_DIR, publicId);
    let matchedFile = null;
    if (fs.existsSync(basePath + '.jpg')) matchedFile = basePath + '.jpg';
    else if (fs.existsSync(basePath + '.png')) matchedFile = basePath + '.png';
    else if (fs.existsSync(basePath + '.webp')) matchedFile = basePath + '.webp';
    else if (fs.existsSync(basePath + '.avif')) matchedFile = basePath + '.avif';
    else {
      // Fallback: search recursively for any file starting with publicId
      const parts = publicId.split('/');
      const fileName = parts.pop();
      const subDir = parts.length > 0 ? path.join(SOURCE_DIR, ...parts) : SOURCE_DIR;
      if (fs.existsSync(subDir)) {
        const files = fs.readdirSync(subDir).filter(f => f.startsWith(fileName + '.'));
        if (files.length > 0) matchedFile = path.join(subDir, files[0]);
      }
    }

    if (!matchedFile) {
      console.log(`[${i + 1}/${keepIds.length}] MISSING in backup: ${publicId}`);
      failed++;
      continue;
    }

    const filePath = matchedFile;
    const ext = path.extname(filePath).slice(1);

    try {
      const result = await newCloudinary.uploader.upload(filePath, {
        public_id: publicId,
        overwrite: false,
        resource_type: 'image',
      });

      const oldUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${publicId}.${ext}`;
      const newUrl = result.secure_url;

      logStream.write(JSON.stringify({ public_id: publicId, old_url: oldUrl, new_url: newUrl }) + '\n');
      success++;
      process.stdout.write(`\r[${i + 1}/${keepIds.length}] uploaded ${publicId}`);
    } catch (err) {
      console.error(`\n[${i + 1}/${keepIds.length}] FAILED ${publicId}:`, err.message);
      failed++;
    }
  }

  logStream.end();
  console.log(`\n\nDone. Success: ${success}, Failed: ${failed}`);
  console.log('Map written:', MAP_PATH);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
