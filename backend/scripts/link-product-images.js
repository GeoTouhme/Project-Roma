/**
 * Link product images from extracted zip archives to MongoDB products.
 *
 * 1. Reads match-results.json (produced by the extraction/matching step)
 * 2. Filters to products that currently have placeholder images
 * 3. Uploads each image to Cloudinary under balport-products/<UPC>
 * 4. Updates the product's images array in MongoDB
 *
 * Run from backend/ with:
 *   node scripts/link-product-images.js
 *
 * Requires CLOUDINARY_* and MONGODB_URI in env.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_PUBLISHABLE_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY || process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const RESULTS_PATH = path.resolve(__dirname, '../../data/match-results.json');
const IMAGES_DIR = path.resolve(__dirname, '../../data/extracted-images');

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dsb69timj';

async function main() {
  // Load match results
  const raw = fs.readFileSync(RESULTS_PATH, 'utf8');
  const results = JSON.parse(raw);

  // Only upload for matched products that DON'T already have a real image
  const toUpload = results.matched.filter(m => !m.already_has_real_image);
  console.log(`Total matched: ${results.matched.length}`);
  console.log(`Already have real image (skip): ${results.matched.length - toUpload.length}`);
  console.log(`To upload and link: ${toUpload.length}`);

  if (toUpload.length === 0) {
    console.log('Nothing to upload. Exiting.');
    return;
  }

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Product = mongoose.connection.collection('products');

  let uploaded = 0;
  let failed = 0;
  const errors = [];

  for (const item of toUpload) {
    const imgPath = path.join(IMAGES_DIR, item.file);
    if (!fs.existsSync(imgPath)) {
      errors.push(`File not found: ${item.file}`);
      failed++;
      continue;
    }

    const publicId = `balport-products/${item.upc}`;

    try {
      // Upload to Cloudinary
      const uploadResult = await cloudinary.uploader.upload(imgPath, {
        public_id: publicId,
        overwrite: true,
      });

      // Build URL — NO background removal transformation (free-tier limit)
      const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${uploadResult.version}/balport-products/${item.upc}.jpg`;

      // Update MongoDB product
      const objectId = new mongoose.Types.ObjectId(item.product_id);
      await Product.updateOne(
        { _id: objectId },
        {
          $set: {
            images: [{
              url: imageUrl,
              _id: publicId,
              blurDataURL: '',
            }],
          },
        }
      );

      uploaded++;
      console.log(`[${uploaded}/${toUpload.length}] OK  ${item.upc} -> ${item.matched_sku}  ${item.product_name}`);

      // Small delay to avoid hitting Cloudinary rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      failed++;
      const msg = `FAIL ${item.upc} (${item.file}): ${err.message}`;
      errors.push(msg);
      console.error(msg);
    }
  }

  console.log('\n========== DONE ==========');
  console.log(`Uploaded & linked: ${uploaded}`);
  console.log(`Failed: ${failed}`);
  if (errors.length) {
    console.log('\nErrors:');
    errors.forEach(e => console.log(`  ${e}`));
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});