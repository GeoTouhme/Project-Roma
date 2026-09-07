const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || '/home/geo/projects/Project-Roma/image-fallback/download-review';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const files = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile());

  const referenced = new Set();
  const allProds = await Product.find(
    { 'images.url': { $exists: true, $ne: [] } },
    { projection: { sku: 1, name: 1, 'images.url': 1 } }
  ).toArray();

  for (const p of allProds) {
    for (const img of p.images || []) {
      const url = img.url || '';
      if (url.startsWith('/api/images/')) {
        referenced.add(path.basename(url));
      }
    }
  }

  const unreferenced = files.filter(f => !referenced.has(f));
  console.log(`Unreferenced files to copy: ${unreferenced.length}`);

  let copied = 0;
  let errors = 0;
  const logLines = [];

  for (const filename of unreferenced) {
    const src = path.join(STORAGE_DIR, filename);
    const dest = path.join(DOWNLOAD_DIR, filename);

    try {
      fs.copyFileSync(src, dest);
      copied++;
      logLines.push(JSON.stringify({
        action: 'copied',
        filename,
        source: src,
        dest,
        size: fs.statSync(dest).size,
      }));
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
