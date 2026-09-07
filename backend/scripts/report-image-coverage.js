const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const SPARE_DIR = process.env.SPARE_DIR || '/home/geo/projects/Project-Roma/image-fallback/spare';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const totalProducts = await Product.countDocuments();
  const totalFiles = fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile()).length;
  const spareFiles = fs.readdirSync(SPARE_DIR).filter(f => fs.statSync(path.join(SPARE_DIR, f)).isFile()).length;

  // 1. Products with local image that has matching file in storage
  const withLocalImage = await Product.countDocuments({ 'images.url': { $regex: '^/api/images/' } });
  const localProds = await Product.find(
    { 'images.url': { $regex: '^/api/images/' } },
    { projection: { sku: 1, name: 1, 'images.url': 1, status: 1, available: 1 } }
  ).toArray();

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

  // 4. Storage files not referenced by any product
  const allFiles = new Set(fs.readdirSync(STORAGE_DIR).filter(f => fs.statSync(path.join(STORAGE_DIR, f)).isFile()));
  const referencedFiles = new Set();
  const allProds = await Product.find(
    { 'images.url': { $exists: true, $ne: [] } },
    { projection: { 'images.url': 1 } }
  ).toArray();
  for (const p of allProds) {
    for (const img of p.images || []) {
      const url = img.url || '';
      if (url.startsWith('/api/images/')) {
        referencedFiles.add(path.basename(url));
      }
    }
  }
  const unreferencedStorageFiles = [...allFiles].filter(f => !referencedFiles.has(f));

  console.log('=== Products ===');
  console.log(`Total products in DB: ${totalProducts}`);
  console.log(`Products with local /api/images/ URL: ${withLocalImage}`);
  console.log(`  - with matching file in storage: ${localMatched}`);
  console.log(`  - with missing file in storage: ${localMissing}`);
  console.log(`Products with Cloudinary URL: ${cloudinaryProds}`);
  console.log(`Products with no real image: ${noImageProds}`);
  console.log('');
  console.log('=== Files ===');
  console.log(`Files in storage: ${totalFiles}`);
  console.log(`Files referenced by products: ${referencedFiles.size}`);
  console.log(`Files in storage NOT referenced by products: ${unreferencedStorageFiles.length}`);
  console.log(`Files in spare: ${spareFiles}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
