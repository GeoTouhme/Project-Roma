const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const EXTRACT_DIR = path.resolve('/app/data/extracted-images/new-zip-2026-08-12');
const DATA_DIR = path.resolve('/app/data');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp']);

function cleanUPC(stem) {
  const digits = stem.replace(/\D/g, '');
  if (/^\d{8,}$/.test(digits)) {
    return digits;
  }
  return null;
}

function candidateSKUs(upc) {
  const set = new Set();
  const add = (v) => { if (v) set.add(v); };
  add(upc);
  add(upc.replace(/^0/, ''));
  add(upc.replace(/^0+/, ''));
  add(upc.slice(-12));
  add(upc.slice(-13));
  return Array.from(set);
}

function isPlaceholderImage(url) {
  if (!url || typeof url !== 'string') return true;
  return url.includes('placeholder');
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Product = mongoose.connection.collection('products');

  // Index sku for performance
  await Product.createIndex({ sku: 1 });

  // Walk extracted images
  const imageFiles = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTS.has(ext)) {
          const rel = path.relative(EXTRACT_DIR, full);
          imageFiles.push(rel);
        }
      }
    }
  }
  walk(EXTRACT_DIR);
  console.log(`Found ${imageFiles.length} image files`);

  // Clean and dedupe UPCs; keep first file per UPC
  const upcToFile = new Map();
  const nonUPC = [];
  for (const rel of imageFiles) {
    const stem = path.parse(rel).name;
    const upc = cleanUPC(stem);
    if (!upc) {
      nonUPC.push(rel);
      continue;
    }
    if (!upcToFile.has(upc)) {
      upcToFile.set(upc, rel);
    }
  }
  console.log(`Clean UPC-named images: ${upcToFile.size}`);
  console.log(`Non-UPC / invalid filenames: ${nonUPC.length}`);

  // Match against MongoDB
  const matched = [];
  const unmatched = [];
  let alreadyReal = 0;
  let toUpload = 0;

  for (const [upc, file] of upcToFile.entries()) {
    const candidates = candidateSKUs(upc);
    let found = null;
    let matchedSku = null;
    for (const sku of candidates) {
      found = await Product.findOne({ sku }, { projection: { _id: 1, sku: 1, name: 1, images: 1 } });
      if (found) {
        matchedSku = sku;
        break;
      }
    }
    if (!found) {
      unmatched.push({ upc, file });
      continue;
    }

    const firstImage = (found.images && found.images[0] && found.images[0].url) || '';
    const alreadyHasReal = !isPlaceholderImage(firstImage);
    if (alreadyHasReal) alreadyReal++;
    else toUpload++;

    matched.push({
      upc,
      file,
      matched_sku: matchedSku,
      product_id: found._id.toString(),
      product_name: found.name,
      already_has_real_image: alreadyHasReal,
    });
  }

  const summary = {
    total_images: imageFiles.length,
    clean_upc_images: upcToFile.size,
    non_upc_images: nonUPC.length,
    matched: matched.length,
    already_have_real_image: alreadyReal,
    to_upload: toUpload,
    unmatched: unmatched.length,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, 'match-results.json'), JSON.stringify({ matched }, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'unmatched-files.json'), JSON.stringify({ unmatched, non_upc: nonUPC }, null, 2));
  fs.writeFileSync(path.join(DATA_DIR, 'zip-audit-summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n========== AUDIT SUMMARY ==========');
  console.log(JSON.stringify(summary, null, 2));
  console.log('\nFiles written:');
  console.log('  ' + path.join(DATA_DIR, 'match-results.json'));
  console.log('  ' + path.join(DATA_DIR, 'unmatched-files.json'));
  console.log('  ' + path.join(DATA_DIR, 'zip-audit-summary.json'));

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
