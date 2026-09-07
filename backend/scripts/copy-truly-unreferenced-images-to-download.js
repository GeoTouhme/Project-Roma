const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/home/geo/projects/Project-Roma/image-fallback/download-review-v2';

function getBaseSkuFromFilename(filename) {
  const m = filename.match(/^(\d+)_0(?:_[^_]+)?(\.[a-zA-Z0-9]+)$/i);
  return m ? m[1] : null;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const files = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile());

  const localProds = await Product.find(
    { 'images.url': { $regex: '^/api/images/' } },
    { projection: { sku: 1, name: 1, 'images.url': 1 } }
  ).toArray();

  const referencedSkus = new Set();
  for (const p of localProds) {
    for (const img of p.images || []) {
      const url = img.url || '';
      const filename = path.basename(url);
      const baseSku = getBaseSkuFromFilename(filename);
      if (baseSku) referencedSkus.add(baseSku);
    }
  }

  const unreferenced = files.filter(filename => {
    const baseSku = getBaseSkuFromFilename(filename);
    const isExactReferenced = localProds.some(p => p.images.some(img => (img.url || '').endsWith('/' + filename)));
    if (isExactReferenced) return false;
    if (baseSku && referencedSkus.has(baseSku)) return false;
    return true;
  });

  console.log(`Truly unreferenced files to copy: ${unreferenced.length}`);

  let copied = 0;
  let errors = 0;
  const logLines = [];

  for (const filename of unreferenced) {
    const src = path.join(STORAGE_DIR, filename);
    const dest = path.join(DOWNLOAD_DIR, filename);

    try {
      fs.copyFileSync(src, dest);
      copied++;
      logLines.push(JSON.stringify({ action: 'copied', filename, source: src, dest, size: fs.statSync(dest).size }));
    } catch (err) {
      errors++;
      logLines.push(JSON.stringify({ action: 'error', filename, error: err.message }));
      console.error('Failed to copy', filename, err.message);
    }
  }

  const logPath = path.join(DOWNLOAD_DIR, `download-manifest-${Date.now()}.jsonl`);
  fs.writeFileSync(logPath, logLines.join('\n'));

  await mongoose.disconnect();

  console.log(`Copied: ${copied}`);
  console.log(`Errors: ${errors}`);
  console.log(`Download folder: ${DOWNLOAD_DIR}`);
  console.log(`Manifest: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
