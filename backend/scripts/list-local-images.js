const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(PROJECT_ROOT, 'image-fallback', 'storage', 'images');
const OUTPUT = '/tmp/local-images-backup-list.jsonl';

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');
  const prods = await Product.find(
    { 'images.url': { $regex: '^/api/images/' } },
    { projection: { sku: 1, name: 1, 'images.url': 1 } }
  ).toArray();

  const lines = [];
  let missing = 0;
  for (const p of prods) {
    const img = p.images && p.images[0];
    if (!img || !img.url) continue;
    const filename = img.url.replace('/api/images/', '');
    const localPath = path.join(STORAGE_DIR, filename);
    if (fs.existsSync(localPath)) {
      lines.push(JSON.stringify({ sku: p.sku, name: p.name, localUrl: img.url, localPath, filename, size: fs.statSync(localPath).size }));
    } else {
      missing++;
    }
  }

  fs.writeFileSync(OUTPUT, lines.join('\n'));
  console.log('products with local images:', prods.length);
  console.log('files found on disk:', lines.length);
  console.log('missing files:', missing);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
