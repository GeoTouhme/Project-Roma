const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const SPARE_DIR = process.env.SPARE_DIR || '/home/geo/projects/Project-Roma/image-fallback/spare';

function getBaseSkuFromFilename(filename) {
  // Match patterns like:
  //   025900202613_0.jpg          -> base SKU 025900202613
  //   025900202613_0_white.jpg    -> base SKU 025900202613
  //   025900202613_0_suffix.jpg   -> base SKU 025900202613
  const m = filename.match(/^(\d+)_0(?:_[^_]+)?(\.[a-zA-Z0-9]+)$/i);
  if (m) return m[1];
  return null;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const totalFiles = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile()).length;
  const spareFiles = fs.readdirSync(SPARE_DIR).filter(f => fs.statSync(path.join(SPARE_DIR, f)).isFile()).length;

  const totalProducts = await Product.countDocuments();

  // 1. Products with local image that has matching file in storage
  const localProds = await Product.find(
    { 'images.url': { $regex: '^/api/images/' } },
    { projection: { sku: 1, name: 1, 'images.url': 1, status: 1, available: 1 } }
  ).toArray();

  const referencedSkus = new Set();
  for (const p of localProds) {
    const url = p.images?.[0]?.url || '';
    const filename = url.replace('/api/images/', '');
    const baseSku = getBaseSkuFromFilename(filename);
    if (baseSku) referencedSkus.add(baseSku);
  }

  let localMatched = 0;
  let localMissing = 0;
  for (const p of localProds) {
    const url = p.images?.[0]?.url || '';
    const filename = url.replace('/api/images/', '');
    const exists = fs.existsSync(path.join(STORAGE_DIR, filename));
    if (exists) localMatched++;
    else localMissing++;
  }

  // 2. Products with Cloudinary image
  const cloudinaryProds = await Product.countDocuments({ 'images.url': { $regex: 'cloudinary\.com' } });

  // 3. Products with no real image (placeholder/empty)
  const noImageProds = await Product.countDocuments({
    $or: [
      { images: { $exists: false } },
      { images: [] },
      { 'images.url': { $not: { $regex: '^/api/images/' } } },
    ],
  });

  // 4. Storage files: referenced, original-of-referenced, truly unreferenced
  const allFiles = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile());

  let referencedExact = 0;
  let originalOfReferenced = 0;
  let trulyUnreferenced = 0;
  const unreferencedNames = [];

  for (const filename of allFiles) {
    const baseSku = getBaseSkuFromFilename(filename);
    const isWhiteOrReferenced = localProds.some(p => p.images.some(img => (img.url || '').endsWith('/' + filename)));

    if (isWhiteOrReferenced) {
      referencedExact++;
    } else if (baseSku && referencedSkus.has(baseSku)) {
      originalOfReferenced++;
    } else {
      trulyUnreferenced++;
      unreferencedNames.push(filename);
    }
  }

  console.log('=== Products ===');
  console.log(`Total products in DB: ${totalProducts}`);
  console.log(`Products with local /api/images/ URL: ${localProds.length}`);
  console.log(`  - with matching file in storage: ${localMatched}`);
  console.log(`  - with missing file in storage: ${localMissing}`);
  console.log(`Products with Cloudinary URL: ${cloudinaryProds}`);
  console.log(`Products with no real image: ${noImageProds}`);
  console.log('');
  console.log('=== Files ===');
  console.log(`Files in storage: ${totalFiles}`);
  console.log(`  Exact filename referenced by products: ${referencedExact}`);
  console.log(`  Original _0.jpg of a referenced _white product: ${originalOfReferenced}`);
  console.log(`  Truly unreferenced (no matching product): ${trulyUnreferenced}`);
  console.log(`Files in spare: ${spareFiles}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
