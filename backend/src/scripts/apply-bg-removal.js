const mongoose = require('mongoose');
const Product = require('../models/Product');

const PLACEHOLDER_BLUR = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

function addBackgroundRemoval(url) {
  if (!url || !url.includes('cloudinary.com')) return url;
  if (url.includes('/e_background_removal,b_white/')) return url;
  return url.replace('/image/upload/', '/image/upload/e_background_removal,b_white/');
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');

  const products = await Product.find({
    'images.url': { $regex: /res\.cloudinary\.com/ },
  }).select('images name sku');

  console.log(`Found ${products.length} products with Cloudinary images`);

  let updated = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (product) => {
      let changed = false;
      product.images = product.images.map((img) => {
        const newUrl = addBackgroundRemoval(img.url);
        if (newUrl !== img.url) {
          changed = true;
          return { ...img.toObject(), url: newUrl };
        }
        return img;
      });

      if (changed) {
        await product.save();
        updated++;
      }
    }));

    console.log(`Processed ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}, updated ${updated}`);
  }

  console.log(`\nUpdated ${updated} products with background-removed URLs`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
