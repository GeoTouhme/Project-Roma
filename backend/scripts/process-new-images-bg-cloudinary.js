/**
 * Process newly added local images through temporary Cloudinary account for
 * background removal, then download them back to local fallback storage and
 * update the DB. Finally delete the temporary Cloudinary uploads.
 *
 * Uses the copied.json report from import-telegram-zips-local.js to know
 * which 426 images are new.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

require('dotenv').config();

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(PROJECT_ROOT, 'image-fallback', 'storage', 'images');
const COPIED_REPORT = path.join(PROJECT_ROOT, 'uploads', 'Telegram', 'reports', 'copied.json');
const REPORT_DIR = path.join(PROJECT_ROOT, 'uploads', 'Telegram', 'reports');

// Temporary Cloudinary account credentials must be provided via env vars:
// TMP_CLOUDINARY_CLOUD_NAME, TMP_CLOUDINARY_API_KEY, TMP_CLOUDINARY_API_SECRET
const TMP_CLOUD_NAME = process.env.TMP_CLOUDINARY_CLOUD_NAME || '';
const TMP_API_KEY = process.env.TMP_CLOUDINARY_API_KEY || '';
const TMP_API_SECRET = process.env.TMP_CLOUDINARY_API_SECRET || '';

cloudinary.config({
  cloud_name: TMP_CLOUD_NAME,
  api_key: TMP_API_KEY,
  api_secret: TMP_API_SECRET,
  secure: true,
});

const SLEEP_MS = 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', reject);
  });
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  if (!fs.existsSync(COPIED_REPORT)) {
    console.error('copied.json report not found at', COPIED_REPORT);
    process.exit(1);
  }

  const copied = JSON.parse(fs.readFileSync(COPIED_REPORT, 'utf8'));
  console.log(`Processing ${copied.length} new images`);

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');
  const Product = mongoose.connection.collection('products');

  ensureDir(REPORT_DIR);

  const uploaded = [];
  const uploadFailed = [];
  const downloaded = [];
  const downloadFailed = [];
  const dbUpdated = [];
  const dbFailed = [];
  const cloudinaryDeleted = [];
  const cloudinaryDeleteFailed = [];

  // Step 1: upload each image to temp Cloudinary with background removal
  for (let i = 0; i < copied.length; i++) {
    const item = copied[i];
    const localPath = path.join(STORAGE_DIR, item.destFilename);
    if (!fs.existsSync(localPath)) {
      uploadFailed.push({ ...item, reason: 'local file missing' });
      continue;
    }

    const publicId = `balport-temp/${item.sku}`;

    try {
      console.log(`[${i + 1}/${copied.length}] Uploading ${item.sku}...`);
      const result = await cloudinary.uploader.upload(localPath, {
        public_id: publicId,
        overwrite: true,
        // Background removal transformation on upload
        eager: [{ effect: 'background_removal:prompt_product' }],
      });

      // Build white-bg URL using Cloudinary transformation
      const whiteBgUrl = result.secure_url.replace('/image/upload/', '/image/upload/e_background_removal,b_white/');

      uploaded.push({ ...item, publicId, whiteBgUrl, cloudinaryUrl: result.secure_url });
      await sleep(SLEEP_MS);
    } catch (err) {
      uploadFailed.push({ ...item, reason: err.message });
      console.error(`Upload failed ${item.sku}: ${err.message}`);
    }
  }

  console.log(`\nUploaded: ${uploaded.length}, failed: ${uploadFailed.length}`);

  // Step 2: download white-bg versions back to local storage
  for (let i = 0; i < uploaded.length; i++) {
    const item = uploaded[i];
    const whiteFilename = item.destFilename.replace(/\.([a-z]+)$/i, '_white.$1');
    const whitePath = path.join(STORAGE_DIR, whiteFilename);

    try {
      console.log(`[${i + 1}/${uploaded.length}] Downloading white-bg ${item.sku}...`);
      await downloadUrl(item.whiteBgUrl, whitePath);
      downloaded.push({ ...item, whiteFilename, whitePath });
      await sleep(200);
    } catch (err) {
      downloadFailed.push({ ...item, reason: err.message });
      console.error(`Download failed ${item.sku}: ${err.message}`);
    }
  }

  console.log(`\nDownloaded: ${downloaded.length}, failed: ${downloadFailed.length}`);

  // Step 3: update MongoDB to point to white-bg local file
  for (let i = 0; i < downloaded.length; i++) {
    const item = downloaded[i];
    const localUrl = `/api/images/${item.whiteFilename}`;

    try {
      const product = await Product.findOne({ sku: item.sku }, { projection: { _id: 1, images: 1 } });
      if (!product) {
        dbFailed.push({ ...item, reason: 'product not found' });
        continue;
      }

      const oldImage = product.images && product.images[0] ? product.images[0] : null;
      const fallbackUrl = oldImage && oldImage.url && !oldImage.url.startsWith('/api/images/')
        ? oldImage.url
        : null;

      const newImage = {
        url: localUrl,
        _id: item.sku,
        blurDataURL: '',
      };
      if (fallbackUrl) newImage.fallbackUrl = fallbackUrl;

      await Product.updateOne(
        { _id: product._id },
        { $set: { images: [newImage] } }
      );

      dbUpdated.push({ ...item, localUrl });
    } catch (err) {
      dbFailed.push({ ...item, reason: err.message });
      console.error(`DB update failed ${item.sku}: ${err.message}`);
    }
  }

  console.log(`\nDB updated: ${dbUpdated.length}, failed: ${dbFailed.length}`);

  // Step 4: delete temporary Cloudinary uploads
  for (let i = 0; i < uploaded.length; i++) {
    const item = uploaded[i];
    try {
      await cloudinary.uploader.destroy(item.publicId);
      cloudinaryDeleted.push(item.publicId);
    } catch (err) {
      cloudinaryDeleteFailed.push({ publicId: item.publicId, reason: err.message });
      console.error(`Cloudinary delete failed ${item.publicId}: ${err.message}`);
    }
  }

  console.log(`\nCloudinary deleted: ${cloudinaryDeleted.length}, failed: ${cloudinaryDeleteFailed.length}`);

  // Reports
  const summary = {
    total: copied.length,
    uploaded: uploaded.length,
    uploadFailed: uploadFailed.length,
    downloaded: downloaded.length,
    downloadFailed: downloadFailed.length,
    dbUpdated: dbUpdated.length,
    dbFailed: dbFailed.length,
    cloudinaryDeleted: cloudinaryDeleted.length,
    cloudinaryDeleteFailed: cloudinaryDeleteFailed.length,
  };

  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-uploaded.json'), JSON.stringify(uploaded, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-upload-failed.json'), JSON.stringify(uploadFailed, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-downloaded.json'), JSON.stringify(downloaded, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-download-failed.json'), JSON.stringify(downloadFailed, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-db-updated.json'), JSON.stringify(dbUpdated, null, 2));
  fs.writeFileSync(path.join(REPORT_DIR, 'bg-removal-db-failed.json'), JSON.stringify(dbFailed, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(JSON.stringify(summary, null, 2));

  await mongoose.disconnect();
  console.log('Done');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
