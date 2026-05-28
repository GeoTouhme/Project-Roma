/**
 * backup-cloudinary-images.js
 *
 * Downloads every product image currently referenced in MongoDB.
 *
 * Usage:
 *   node scripts/backup-cloudinary-images.js --out=/backups/cloudinary-YYYY-MM-DD/images
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const axios = require('axios');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');

// ─── CLI args ──────────────────────────────────────────────────────

const OUT_ARG = process.argv.find(arg => arg.startsWith('--out='));
const OUT_DIR = OUT_ARG ? OUT_ARG.split('=')[1] : null;

if (!OUT_DIR) {
  console.error('Usage: node scripts/backup-cloudinary-images.js --out=<dir>');
  process.exit(1);
}

// ─── Config ────────────────────────────────────────────────────────

const CONCURRENCY = 5;
const MAX_RETRIES = 3;
const LOG_PATH = path.join(OUT_DIR, '..', 'backup-log.jsonl');

// ─── Helpers ───────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadImage(url, dest, retries = 0) {
  try {
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5,
    });

    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    return { success: true };
  } catch (err) {
    if (retries < MAX_RETRIES) {
      await sleep(1000 * (retries + 1));
      return downloadImage(url, dest, retries + 1);
    }
    return { success: false, error: err.message };
  }
}

async function runBatch(tasks) {
  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);
  }
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const products = await Product.find({}).lean();
  const tasks = [];
  const urlMap = new Map();

  for (const p of products) {
    for (const img of p.images || []) {
      if (!img.url || !img._id) continue;
      if (urlMap.has(img._id)) continue;
      urlMap.set(img._id, img.url);

      const ext = path.extname(new URL(img.url).pathname) || '.jpg';
      const dest = path.join(OUT_DIR, `${img._id}${ext}`);

      tasks.push(() => downloadImage(img.url, dest).then(result => ({
        public_id: img._id,
        url: img.url,
        dest,
        ...result,
      })));
    }
  }

  console.log('Images to download:', tasks.length);
  console.log('Concurrency:', CONCURRENCY);
  console.log('Output dir:', OUT_DIR);

  const results = [];
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map(t => t()));
    results.push(...batchResults);

    const done = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    process.stdout.write(`\rProgress: ${results.length}/${tasks.length}  done=${done}  failed=${failed}`);
  }
  process.stdout.write('\n');

  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.log('Failed downloads:', failed.length);
    for (const f of failed) {
      console.log('  ', f.public_id, f.error);
    }
  }

  fs.writeFileSync(LOG_PATH, results.map(r => JSON.stringify(r)).join('\n') + '\n');
  console.log('Log written:', LOG_PATH);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
