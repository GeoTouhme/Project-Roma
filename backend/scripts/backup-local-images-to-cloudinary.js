/**
 * Backup all local product images to the temporary Cloudinary account
 * (jwjuwxgx). This stores them under balport-backup/<sku> for disaster
 * recovery, without changing the local DB or storefront URLs.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(PROJECT_ROOT, 'image-fallback', 'storage', 'images');
const REPORT_DIR = path.join(PROJECT_ROOT, 'uploads', 'Telegram', 'reports');

// Temporary Cloudinary account
const TMP_CLOUD_NAME = 'jwjuwxgx';
const TMP_API_KEY = '554389218839616';
const TMP_API_SECRET = 'LcYyDrWOGOntkiahr5J0FNpE0HY';

cloudinary.config({
  cloud_name: TMP_CLOUD_NAME,
  api_key: TMP_API_KEY,
  api_secret: TMP_API_SECRET,
  secure: true,
});

const SLEEP_MS = 300;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const Product = mongoose.connection.collection('products');

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const prods = await Product.find(
    { 'images.url': { $regex: '^/api/images/' } },
    { projection: { sku: 1, name: 1, 'images.url': 1 } }
  ).toArray();

  const uploaded = [];
  const uploadFailed = [];

  for (let i = 0; i < prods.length; i++) {
    const p = prods[i];
    const img = p.images && p.images[0];
    if (!img || !img.url) continue;

    const filename = img.url.replace('/api/images/', '');
    const localPath = path.join(STORAGE_DIR, filename);
    if (!fs.existsSync(localPath)) {
      uploadFailed.push({ sku: p.sku, reason: 'local file missing' });
      continue;
    }

    const publicId = `balport-backup/${p.sku}`;

    try {
      console.log(`[${i + 1}/${prods.length}] Uploading ${p.sku}...`);
      const result = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        overwrite: true,
      });
      uploaded.push({ sku: p.sku, name: p.name, publicId, cloudinaryUrl: result.secure_url, filename });
      await sleep(SLEEP_MS);
    } catch (err) {
      uploadFailed.push({ sku: p.sku, reason: err.message });
      console.error(`Upload failed ${p.sku}: ${err.message}`);
    }
  }

  const summary = {
    total: prods.length,
    uploaded: uploaded.length,
    uploadFailed: uploadFailed.length,
  };

  fs.writeFileSync(path.join(REPORT_DIR, 'cloudinary-backup-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'cloudinary-backup-uploaded.json'), JSON.stringify(uploaded, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'cloudinary-backup-failed.json'), JSON.stringify(uploadFailed, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
