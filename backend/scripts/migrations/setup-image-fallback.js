require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Product = require('../../src/models/Product');
const Category = require('../../src/models/Category');
const SubCategory = require('../../src/models/SubCategory');
const Brand = require('../../src/models/Brand');

const FALLBACK_BASE = process.env.IMAGE_FALLBACK_URL || 'https://images.balportliquors.com/images';

const WEEK_DIR = '/home/geo/projects/Project-Roma/backups/last-week-images-bg-removed';
const UNMATCHED_DIR = '/home/geo/projects/Project-Roma/backups/unmatched-images-bg-removed';
const STORAGE_DIR = '/home/geo/projects/Project-Roma/image-fallback/storage/images';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop');
  console.log('Connected to MongoDB');

  fs.mkdirSync(STORAGE_DIR, { recursive: true });

  // 1. Copy downloaded week images into storage, keyed by SKU, and patch products.
  const weekFiles = fs.readdirSync(WEEK_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  let patchedProducts = 0;
  for (const file of weekFiles) {
    const sku = file.replace(/_0\.(jpg|jpeg|png|webp|gif)$/i, '');
    const dest = path.join(STORAGE_DIR, file);
    fs.copyFileSync(path.join(WEEK_DIR, file), dest);
    const fallbackUrl = `${FALLBACK_BASE}/${file}`;
    const res = await Product.updateMany(
      { sku },
      { $set: { 'images.$[img].fallbackUrl': fallbackUrl } },
      { arrayFilters: [{ 'img.url': { $exists: true, $ne: '' } }] }
    );
    if (res.modifiedCount > 0) patchedProducts += res.modifiedCount;
  }
  console.log(`Patched ${patchedProducts} product image entries with fallback URLs`);

  // 2. Copy unmatched images into storage and patch categories/subcategories/brands by URL match.
  const unmatchedFiles = fs.readdirSync(UNMATCHED_DIR).filter(f => /\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  let patchedCategories = 0;
  let patchedSubCategories = 0;
  let patchedBrands = 0;

  // Read urls.txt to map filename -> original URL
  const urlMap = {};
  if (fs.existsSync(path.join(UNMATCHED_DIR, 'urls.txt'))) {
    const lines = fs.readFileSync(path.join(UNMATCHED_DIR, 'urls.txt'), 'utf8').split('\n').filter(Boolean);
    for (const line of lines) {
      const basename = path.basename(line);
      urlMap[basename] = line;
    }
  }

  for (const file of unmatchedFiles) {
    const dest = path.join(STORAGE_DIR, file);
    fs.copyFileSync(path.join(UNMATCHED_DIR, file), dest);
    const fallbackUrl = `${FALLBACK_BASE}/${file}`;
    const originalUrl = urlMap[file];
    if (!originalUrl) continue;

    const catRes = await Category.updateMany(
      { 'cover.url': originalUrl },
      { $set: { 'cover.fallbackUrl': fallbackUrl } }
    );
    patchedCategories += catRes.modifiedCount;

    const subRes = await SubCategory.updateMany(
      { 'cover.url': originalUrl },
      { $set: { 'cover.fallbackUrl': fallbackUrl } }
    );
    patchedSubCategories += subRes.modifiedCount;

    const brandRes = await Brand.updateMany(
      { 'logo.url': originalUrl },
      { $set: { 'logo.fallbackUrl': fallbackUrl } }
    );
    patchedBrands += brandRes.modifiedCount;
  }

  console.log(`Patched ${patchedCategories} categories, ${patchedSubCategories} subcategories, ${patchedBrands} brands`);

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
