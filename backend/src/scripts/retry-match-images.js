require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cloudinary = require('./src/config/cloudinary');
const Product = require('./src/models/Product');

const LOCAL_IMAGE_DIRS = process.env.LOCAL_IMAGE_DIRS
  ? process.env.LOCAL_IMAGE_DIRS.split(',')
  : ['/tmp/new-zip-extracted', '/tmp/pinot-noir-extracted', '/tmp/nextcloud-extracted'];

const SLEEP_MS = parseInt(process.env.SLEEP_MS, 10) || 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeUpc(upc) {
  return {
    raw: upc,
    noLeading: upc.replace(/^0+/, '') || '0',
    oneLessLeading: upc.replace(/^0/, ''),
    pad12: upc.padStart(12, '0'),
    pad13: upc.padStart(13, '0'),
    pad14: upc.padStart(14, '0'),
    last12: upc.slice(-12),
    last13: upc.slice(-13),
  };
}

async function findProductByUpc(upc) {
  const n = normalizeUpc(upc);
  const candidates = [
    n.raw,
    n.noLeading,
    n.oneLessLeading,
    n.pad12,
    n.pad13,
    n.pad14,
    n.last12,
    n.last13,
    `BP-${n.raw}`,
    `BP-${n.noLeading}`,
    `BP-${n.oneLessLeading}`,
    `BP-${n.pad12}`,
    `BP-${n.pad13}`,
    `BP-${n.last12}`,
    `BP-${n.last13}`,
  ];

  // unique non-empty values
  const skuSet = [...new Set(candidates.filter(Boolean))];

  return Product.findOne({ sku: { $in: skuSet } });
}

async function collectCloudinaryUpcs() {
  const allUpcs = [];
  let nextCursor = null;
  do {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'balport-products/',
      max_results: 500,
      next_cursor: nextCursor,
    });

    for (const resource of result.resources) {
      const publicId = resource.public_id.replace('balport-products/', '');
      const upc = publicId.split('_')[0]; // strip suffix like _mdfswk
      allUpcs.push({ upc, publicId, resource });
    }

    nextCursor = result.next_cursor;
    if (nextCursor) await sleep(SLEEP_MS);
  } while (nextCursor);

  return allUpcs;
}

function collectLocalImages() {
  const images = [];
  for (const dir of LOCAL_IMAGE_DIRS) {
    if (!fs.existsSync(dir)) continue;
    const walk = (current) => {
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (/\.(jpg|jpeg|png|webp)$/i.test(entry.name)) {
          const upc = path.parse(entry.name).name.replace(/\D/g, '');
          if (upc) {
            images.push({ upc, filePath: fullPath, fileName: entry.name });
          }
        }
      }
    };
    walk(dir);
  }
  return images;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Collect Cloudinary UPCs
  console.log('\n=== Cloudinary ===');
  const cloudinaryItems = await collectCloudinaryUpcs();
  console.log(`Total Cloudinary balport-products: ${cloudinaryItems.length}`);

  const cloudinaryMatched = [];
  const cloudinaryUnmatched = [];
  const cloudinaryAlreadyHasImage = [];

  for (const item of cloudinaryItems) {
    const product = await findProductByUpc(item.upc);
    if (!product) {
      cloudinaryUnmatched.push(item);
    } else if (product.images && product.images.length > 0 && !product.images[0].url.includes('placeholder')) {
      cloudinaryAlreadyHasImage.push({ ...item, product });
    } else {
      cloudinaryMatched.push({ ...item, product });
    }
  }

  console.log(`  Matched needing image: ${cloudinaryMatched.length}`);
  console.log(`  Matched already has image: ${cloudinaryAlreadyHasImage.length}`);
  console.log(`  Unmatched: ${cloudinaryUnmatched.length}`);

  // Collect local images
  console.log('\n=== Local image files ===');
  const localImages = collectLocalImages();
  console.log(`Total local image files: ${localImages.length}`);

  const localMatched = [];
  const localUnmatched = [];
  const localAlreadyHasImage = [];

  for (const img of localImages) {
    const product = await findProductByUpc(img.upc);
    if (!product) {
      localUnmatched.push(img);
    } else if (product.images && product.images.length > 0 && !product.images[0].url.includes('placeholder')) {
      localAlreadyHasImage.push({ ...img, product });
    } else {
      localMatched.push({ ...img, product });
    }
  }

  console.log(`  Matched needing image: ${localMatched.length}`);
  console.log(`  Matched already has image: ${localAlreadyHasImage.length}`);
  console.log(`  Unmatched: ${localUnmatched.length}`);

  // Save reports
  const reportDir = '/tmp/retry-match-reports';
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

  fs.writeFileSync(
    path.join(reportDir, 'cloudinary-matched.json'),
    JSON.stringify(cloudinaryMatched.map(i => ({ upc: i.upc, publicId: i.publicId, sku: i.product.sku, name: i.product.name })), null, 2)
  );
  fs.writeFileSync(
    path.join(reportDir, 'cloudinary-unmatched.json'),
    JSON.stringify(cloudinaryUnmatched.map(i => ({ upc: i.upc, publicId: i.publicId })), null, 2)
  );
  fs.writeFileSync(
    path.join(reportDir, 'local-matched.json'),
    JSON.stringify(localMatched.map(i => ({ upc: i.upc, file: i.filePath, sku: i.product.sku, name: i.product.name })), null, 2)
  );
  fs.writeFileSync(
    path.join(reportDir, 'local-unmatched.json'),
    JSON.stringify(localUnmatched.map(i => ({ upc: i.upc, file: i.filePath })), null, 2)
  );

  console.log(`\nReports saved to ${reportDir}`);
  console.log('Next: run link/upload scripts using these JSON files');

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
