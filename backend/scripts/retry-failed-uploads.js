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
const IMAGES_DIR = path.resolve(__dirname, '../../data/extracted-images/new-zip-2026-08-12');
const LOG_PATH = path.resolve('/tmp/retry-failed.log');
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dsb69timj';

function isPlaceholderImage(url) {
  if (!url || typeof url !== 'string') return true;
  return url.includes('placeholder');
}

async function main() {
  const raw = fs.readFileSync(RESULTS_PATH, 'utf8');
  const results = JSON.parse(raw);

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const Product = mongoose.connection.collection('products');

  // Re-check which matched products still have placeholder images
  const toUpload = [];
  for (const item of results.matched) {
    const product = await Product.findOne(
      { _id: new mongoose.Types.ObjectId(item.product_id) },
      { projection: { images: 1, name: 1 } }
    );
    const firstImage = (product && product.images && product.images[0] && product.images[0].url) || '';
    if (isPlaceholderImage(firstImage)) {
      toUpload.push(item);
    }
  }

  console.log(`Still need upload: ${toUpload.length}`);
  fs.writeFileSync(LOG_PATH, `Retry failed uploads: ${toUpload.length} items\n`);

  if (toUpload.length === 0) {
    console.log('Nothing left to upload.');
    await mongoose.disconnect();
    return;
  }

  let uploaded = 0;
  let failed = 0;
  const errors = [];
  const log = (msg) => {
    console.log(msg);
    fs.appendFileSync(LOG_PATH, msg + '\n');
  };

  for (const item of toUpload) {
    const imgPath = path.join(IMAGES_DIR, item.file);
    if (!fs.existsSync(imgPath)) {
      errors.push(`File not found: ${item.file}`);
      failed++;
      continue;
    }

    const publicId = `balport-products/${item.upc}`;

    try {
      const uploadResult = await cloudinary.uploader.upload(imgPath, {
        public_id: publicId,
        overwrite: true,
      });

      const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/v${uploadResult.version}/balport-products/${item.upc}.jpg`;

      await Product.updateOne(
        { _id: new mongoose.Types.ObjectId(item.product_id) },
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
      log(`[${uploaded}/${toUpload.length}] OK  ${item.upc} -> ${item.matched_sku}  ${item.product_name}`);
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      failed++;
      const msg = `FAIL ${item.upc} (${item.file}): ${err.message || err}`;
      errors.push(msg);
      log(msg);
    }
  }

  log(`\n========== DONE ==========\nUploaded & linked: ${uploaded}\nFailed: ${failed}`);
  if (errors.length) {
    log('\nErrors:');
    errors.forEach(e => log(`  ${e}`));
  }

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
