/**
 * Import product images from Telegram zip files into local fallback storage.
 *
 * - Extracts all .zip files from uploads/Telegram/ to a temp directory
 * - Matches each image filename (by digits) to products by sku
 * - Copies matched images into image-fallback/storage/images/
 * - Updates product images.url to /api/images/<filename>
 *
 * Run from project root with:
 *   docker compose --env-file .env.local exec backend node /app/scripts/import-telegram-zips-local.js
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

require('dotenv').config();

// Use Node's built-in zlib for zip extraction since `unzip` CLI is not installed
const zlib = require('zlib');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const SOURCE_DIR = process.env.IMAGE_SOURCE_DIR || path.join(PROJECT_ROOT, 'uploads', 'Telegram');
const EXTRACT_DIR = path.join(SOURCE_DIR, 'extracted');
const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(PROJECT_ROOT, 'image-fallback', 'storage', 'images');
const REPORT_DIR = path.join(SOURCE_DIR, 'reports');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function normalizeFilename(name) {
  // remove any parent path
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
}

function cleanUPC(stem) {
  const digits = stem.replace(/\D/g, '');
  if (/^\d{8,}$/.test(digits)) return digits;
  return null;
}

function candidateSKUs(upc) {
  const set = new Set();
  const add = (v) => { if (v) set.add(v); };
  add(upc);
  add(upc.replace(/^0/, ''));
  add(upc.replace(/^0+/, '') || '0');
  add(upc.slice(-12));
  add(upc.slice(-13));
  return Array.from(set);
}

function isPlaceholderImage(url) {
  if (!url || typeof url !== 'string') return true;
  return url.includes('placeholder');
}

async function extractZips() {
  const existingExtracted = fs.existsSync(EXTRACT_DIR) && fs.readdirSync(EXTRACT_DIR).length > 0;
  if (existingExtracted) {
    console.log(`Using pre-extracted contents in ${EXTRACT_DIR}`);
    return;
  }
  fs.mkdirSync(EXTRACT_DIR, { recursive: true });
  const zips = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.zip'));
  console.log(`Found ${zips.length} zip files`);
  for (const zipFile of zips) {
    const zipPath = path.join(SOURCE_DIR, zipFile);
    const outDir = path.join(EXTRACT_DIR, normalizeFilename(zipFile).replace(/\.zip$/i, ''));
    fs.mkdirSync(outDir, { recursive: true });
    console.log(`Extracting ${zipFile}...`);
    const result = require('child_process').spawnSync('python3', ['-m', 'zipfile', '-e', zipPath, outDir], { stdio: 'inherit' });
    if (result.error || result.status !== 0) {
      throw new Error(`Failed to extract ${zipFile}: ${result.error || `exit ${result.status}`}`);
    }
  }
}

function collectExtractedImages() {
  const images = [];
  const seenKeys = new Set();

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (!IMAGE_EXTS.has(ext)) continue;

        const rel = path.relative(EXTRACT_DIR, full);
        const stem = path.parse(entry.name).name;
        const upc = cleanUPC(stem);
        if (!upc) {
          images.push({ rel, full, stem, ext, upc: null, zipDir: path.dirname(rel) });
          continue;
        }

        // dedupe by UPC within the same zip directory, keep first file
        const dupKey = `${path.dirname(rel)}/${upc}`;
        if (seenKeys.has(dupKey)) continue;
        seenKeys.add(dupKey);

        images.push({ rel, full, stem, ext, upc, zipDir: path.dirname(rel) });
      }
    }
  }

  walk(EXTRACT_DIR);
  return images;
}

function buildDestFilename(upc, ext, existingFiles) {
  // prefer <upc>_0.jpg; if collision, add short hash
  let filename = `${upc}_0${ext}`;
  if (!existingFiles.has(filename)) return filename;

  const hash = crypto.randomBytes(2).toString('hex');
  filename = `${upc}_${hash}${ext}`;
  return filename;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const Product = mongoose.connection.collection('products');

  // Ensure sku index
  await Product.createIndex({ sku: 1 });

  // Extract
  await extractZips();

  // Collect
  const images = collectExtractedImages();
  console.log(`Collected ${images.length} unique UPC-named images`);

  const existingFiles = new Set(fs.readdirSync(STORAGE_DIR));

  const matched = [];
  const unmatched = [];
  const nonUpc = [];
  const skippedReal = [];
  const copied = [];

  for (const img of images) {
    if (!img.upc) {
      nonUpc.push({ rel: img.rel, stem: img.stem });
      continue;
    }

    const candidates = candidateSKUs(img.upc);
    let product = null;
    let matchedSku = null;
    for (const sku of candidates) {
      product = await Product.findOne({ sku }, { projection: { _id: 1, sku: 1, name: 1, images: 1 } });
      if (product) {
        matchedSku = sku;
        break;
      }
    }

    if (!product) {
      unmatched.push({ upc: img.upc, file: img.rel });
      continue;
    }

    const firstImage = (product.images && product.images[0] && product.images[0].url) || '';
    if (!isPlaceholderImage(firstImage)) {
      skippedReal.push({ upc: img.upc, sku: matchedSku, file: img.rel, existingUrl: firstImage });
      continue;
    }

    const destFilename = buildDestFilename(matchedSku, img.ext, existingFiles);
    const destPath = path.join(STORAGE_DIR, destFilename);
    const localUrl = `/api/images/${destFilename}`;

    fs.copyFileSync(img.full, destPath);
    existingFiles.add(destFilename);
    copied.push({ upc: img.upc, sku: matchedSku, file: img.rel, destFilename });

    // preserve old url as fallbackUrl if it exists and isn't already local
    const oldImage = product.images && product.images[0] ? product.images[0] : null;
    const fallbackUrl = oldImage && oldImage.url && !oldImage.url.startsWith('/api/images/')
      ? oldImage.url
      : null;

    const newImage = {
      url: localUrl,
      _id: matchedSku,
      blurDataURL: '',
    };
    if (fallbackUrl) newImage.fallbackUrl = fallbackUrl;

    await Product.updateOne(
      { _id: product._id },
      { $set: { images: [newImage] } }
    );

    matched.push({
      upc: img.upc,
      sku: matchedSku,
      productId: product._id.toString(),
      name: product.name,
      file: img.rel,
      destFilename,
      localUrl,
    });
  }

  // Reports
  const summary = {
    totalImages: images.length,
    matched: matched.length,
    skippedReal: skippedReal.length,
    unmatched: unmatched.length,
    nonUpc: nonUpc.length,
    copied: copied.length,
  };

  fs.writeFileSync(path.join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'matched.json'), JSON.stringify(matched, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'unmatched.json'), JSON.stringify(unmatched, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'skipped-real.json'), JSON.stringify(skippedReal, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'non-upc.json'), JSON.stringify(nonUpc, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'copied.json'), JSON.stringify(copied, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nReports written to ${REPORT_DIR}`);

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
