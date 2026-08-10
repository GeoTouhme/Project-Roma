const cloudinary = require('./src/config/cloudinary');
const mongoose = require('mongoose');
const Product = require('../models/Product');

const PLACEHOLDER_BLUR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function stripLeadingZeros(str) {
  if (!str) return str;
  return str.replace(/^(0+)/g, '');
}

async function getAllCloudinaryImages() {
  let allResources = [];
  let nextCursor = null;
  do {
    const opts = { type: 'upload', max_results: 500, resource_type: 'image', prefix: 'balport-products/' };
    if (nextCursor) opts.next_cursor = nextCursor;
    const result = await cloudinary.api.resources(opts);
    allResources = allResources.concat(result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);
  return allResources;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');

  console.log('Fetching Cloudinary resources...');
  const resources = await getAllCloudinaryImages();
  console.log(`Found ${resources.length} resources`);

  const upcToUrls = new Map();
  resources.forEach(r => {
    const publicId = r.public_id.replace('balport-products/', '');
    const upcMatch = publicId.match(/^(\d+)/);
    if (upcMatch) {
      const stripped = stripLeadingZeros(upcMatch[1]);
      if (!upcToUrls.has(stripped)) upcToUrls.set(stripped, []);
      upcToUrls.get(stripped).push(r.secure_url);
    }
  });

  console.log(`Unique stripped UPC images: ${upcToUrls.size}`);

  let matched = 0;
  let updated = 0;
  let notFound = 0;
  let multipleImages = 0;

  const products = await Product.find().select('sku name');
  console.log(`Total products: ${products.length}`);

  for (const product of products) {
    const sku = stripLeadingZeros(product.sku);
    const urls = upcToUrls.get(sku);

    if (!urls || urls.length === 0) {
      notFound++;
      continue;
    }

    // Don't overwrite existing real images if already set
    const hasRealImage = product.images && product.images.some(img => img && img.url && !img.url.includes('placeholder'));
    if (hasRealImage) {
      matched++;
      continue;
    }

    matched++;
    if (urls.length > 1) multipleImages++;

    product.images = urls.map((url, idx) => ({
      url,
      _id: `${sku}-${idx}`,
      blurDataURL: PLACEHOLDER_BLUR,
    }));

    await product.save();
    updated++;
  }

  console.log('\n--- Summary ---');
  console.log(`Total products: ${products.length}`);
  console.log(`Products matched with images: ${matched}`);
  console.log(`Products updated: ${updated}`);
  console.log(`Products without matching images: ${notFound}`);
  console.log(`Products with multiple images: ${multipleImages}`);

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
