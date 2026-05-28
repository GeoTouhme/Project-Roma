/**
 * swap-image-urls.js
 *
 * Updates Product.images[].url (and _id) from old Cloudinary URLs to new ones.
 *
 * Usage:
 *   node scripts/swap-image-urls.js --map=/backups/migration-url-map.jsonl --dry-run
 *   node scripts/swap-image-urls.js --map=/backups/migration-url-map.jsonl --execute
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');

// ─── CLI args ──────────────────────────────────────────────────────

const MAP_ARG = process.argv.find(arg => arg.startsWith('--map='));
const MAP_PATH = MAP_ARG ? MAP_ARG.split('=')[1] : null;

const DRY_RUN = process.argv.includes('--dry-run');
const EXECUTE = process.argv.includes('--execute');

if (!MAP_PATH) {
  console.error('Usage: node scripts/swap-image-urls.js --map=<file> --dry-run | --execute');
  process.exit(1);
}

if (!DRY_RUN && !EXECUTE) {
  console.error('Error: provide either --dry-run or --execute');
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const raw = fs.readFileSync(MAP_PATH, 'utf-8');
  const lines = raw.split('\n').filter(Boolean);
  const urlMap = new Map();

  for (const line of lines) {
    const entry = JSON.parse(line);
    urlMap.set(entry.old_url, entry.new_url);
    urlMap.set(entry.public_id, entry.new_url);
  }

  console.log('URL mappings loaded:', urlMap.size / 2, 'unique assets');

  const products = await Product.find({}).lean();
  let matched = 0;
  let updated = 0;
  const bulkOps = [];

  for (const p of products) {
    let changed = false;
    const newImages = [];

    for (const img of p.images || []) {
      const newUrl = urlMap.get(img.url) || urlMap.get(img._id);
      if (newUrl && newUrl !== img.url) {
        newImages.push({ ...img, url: newUrl });
        matched++;
        changed = true;
      } else {
        newImages.push(img);
      }
    }

    if (changed) {
      updated++;
      if (EXECUTE) {
        bulkOps.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { images: newImages } },
          },
        });
      }
    }
  }

  console.log('Products with matching images:', updated);
  console.log('Image URLs that would change:', matched);

  if (DRY_RUN) {
    console.log('Dry run — no DB changes.');
    process.exit(0);
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
    const batch = bulkOps.slice(i, i + BATCH_SIZE);
    await Product.bulkWrite(batch);
    console.log(`BulkWrite batch ${i + 1}-${Math.min(i + BATCH_SIZE, bulkOps.length)} done`);
  }

  console.log('Done. Products updated:', updated);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
