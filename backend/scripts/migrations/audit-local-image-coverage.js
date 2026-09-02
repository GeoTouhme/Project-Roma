const fs = require('fs');
const mongoose = require('/app/node_modules/mongoose');
const Product = require('/app/src/models/Product');

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/usr/src/app/image-fallback/storage/images';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');
  const files = new Set(fs.readdirSync(STORAGE_DIR));

  const visible = await Product.countDocuments({
    status: { $nin: ['disabled', 'inactive'] },
    available: { $gt: 0 },
    images: { $exists: true, $ne: [] },
  });

  const prods = await Product.find({
    status: { $nin: ['disabled', 'inactive'] },
    available: { $gt: 0 },
    images: { $exists: true, $ne: [] },
  }, 'sku images').lean();

  let matched = 0;
  let cloudinaryOnly = 0;
  let noRealUrl = 0;
  let localButMissingFile = 0;

  for (const p of prods) {
    const url = p.images?.[0]?.url || '';
    const hasLocalFile = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => files.has(p.sku + '_0' + ext));
    const isCloudinary = url.includes('cloudinary.com');
    const isLocal = url.startsWith('/api/images/');

    if (isLocal) {
      if (hasLocalFile) matched++;
      else localButMissingFile++;
    } else if (isCloudinary) {
      cloudinaryOnly++;
    } else {
      noRealUrl++;
    }
  }

  console.log(`Visible products: ${visible}`);
  console.log(`  Using local URL + file exists: ${matched}`);
  console.log(`  Using local URL but file missing: ${localButMissingFile}`);
  console.log(`  Still using Cloudinary URL: ${cloudinaryOnly}`);
  console.log(`  No real URL (placeholder/empty): ${noRealUrl}`);

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
