const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(PROJECT_ROOT, 'image-fallback', 'storage', 'images');
const SPARE_DIR = path.join(PROJECT_ROOT, 'image-fallback', 'spare');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  if (!fs.existsSync(STORAGE_DIR)) {
    console.error('Storage dir not found:', STORAGE_DIR);
    process.exit(1);
  }

  fs.mkdirSync(SPARE_DIR, { recursive: true });

  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const files = fs.readdirSync(STORAGE_DIR).filter(f => {
    const p = path.join(STORAGE_DIR, f);
    return fs.statSync(p).isFile();
  });

  console.log(`Files in storage: ${files.length}`);

  // Build regex per filename to match /api/images/<filename> exactly
  const cursor = Product.find({ 'images.url': { $regex: '^/api/images/' } }, { projection: { sku: 1, 'images.url': 1 } });
  const referenced = new Set();

  for await (const p of cursor) {
    for (const img of p.images || []) {
      const url = img.url || '';
      if (url.startsWith('/api/images/')) {
        referenced.add(path.basename(url));
      }
    }
  }

  console.log(`Referenced filenames in DB: ${referenced.size}`);

  let copied = 0;
  let skipped = 0;
  let errors = 0;
  const logPath = path.join(SPARE_DIR, `spare-manifest-${Date.now()}.jsonl`);
  const logLines = [];

  for (const filename of files) {
    if (referenced.has(filename)) {
      skipped++;
      continue;
    }

    const src = path.join(STORAGE_DIR, filename);
    const dest = path.join(SPARE_DIR, filename);

    try {
      // Preserve unique filenames; if collision, add counter.
      let finalDest = dest;
      let counter = 1;
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      while (fs.existsSync(finalDest)) {
        finalDest = path.join(SPARE_DIR, `${base}_${counter}${ext}`);
        counter++;
      }

      fs.copyFileSync(src, finalDest);
      copied++;
      logLines.push(JSON.stringify({ action: 'copied', source: src, dest: finalDest, size: fs.statSync(finalDest).size }));
    } catch (err) {
      errors++;
      logLines.push(JSON.stringify({ action: 'error', source: src, error: err.message }));
      console.error('Failed to copy', filename, err.message);
    }
  }

  fs.writeFileSync(logPath, logLines.join('\n'));
  await mongoose.disconnect();

  console.log(`Copied to spare: ${copied}`);
  console.log(`Referenced (kept in storage): ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Manifest: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
