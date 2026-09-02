const fs = require('fs');
const path = require('path');
const mongoose = require('/app/node_modules/mongoose');
const Product = require('/app/src/models/Product');

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/usr/src/app/image-fallback/storage/images';
const LOCAL_BASE = '/api/images';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');
  const files = new Set(fs.readdirSync(STORAGE_DIR));
  const products = await Product.find({ 'images.url': /cloudinary\.com/ }).select('sku images');
  let updated = 0;
  for (const p of products) {
    const first = p.images[0];
    if (!first?.url) continue;
    let ext = path.extname(new URL(first.url).pathname).toLowerCase() || '.jpg';
    if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) ext = '.jpg';
    const filename = `${p.sku}_0${ext}`;
    if (!files.has(filename)) {
      console.log(`Skipping ${p.sku}: local file ${filename} not found`);
      continue;
    }
    first.fallbackUrl = first.url;
    first.url = `${LOCAL_BASE}/${filename}`;
    await p.save();
    updated++;
  }
  console.log(`Updated ${updated} products to local image URLs`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
