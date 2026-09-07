const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const SPARE_DIR = process.env.SPARE_DIR || '/home/geo/projects/Project-Roma/image-fallback/spare';
const SUFFIX = process.env.SUFFIX || '_white';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const files = fs.readdirSync(SPARE_DIR).filter(f => fs.statSync(path.join(SPARE_DIR, f)).isFile());
  const candidates = files.filter(f => /_0\.[a-zA-Z0-9]+$/i.test(f));

  console.log(`_0-suffixed files in spare: ${candidates.length}`);
  console.log(`Dry run: ${DRY_RUN}`);

  let renamed = 0;
  let productUpdated = 0;
  let skipped = 0;
  let errors = 0;
  const logLines = [];

  for (const filename of candidates) {
    const sku = filename.replace(/_0\.[a-zA-Z0-9]+$/i, '');
    const ext = path.extname(filename);
    const targetFilename = `${sku}_0${SUFFIX}${ext}`;
    const sourcePath = path.join(SPARE_DIR, filename);
    const targetPath = path.join(STORAGE_DIR, targetFilename);

    const product = await Product.findOne({ sku });
    if (!product) {
      skipped++;
      logLines.push(JSON.stringify({ filename, sku, action: 'skipped', reason: 'product not found' }));
      continue;
    }

    if (fs.existsSync(targetPath)) {
      skipped++;
      logLines.push(JSON.stringify({ filename, sku, action: 'skipped', reason: 'target already exists', targetPath }));
      continue;
    }

    try {
      if (!DRY_RUN) {
        fs.copyFileSync(sourcePath, targetPath);
        await Product.updateOne(
          { _id: product._id },
          { $set: { 'images.$[img].fallbackUrl': `/api/images/${targetFilename}` } },
          { arrayFilters: [{ 'img.url': { $regex: `${sku}` } }] }
        );
      }
      renamed++;
      if (!DRY_RUN) productUpdated++;
      logLines.push(JSON.stringify({ filename, sku, action: 'renamed_and_linked', targetFilename, targetPath, productId: product._id.toString() }));
    } catch (err) {
      errors++;
      logLines.push(JSON.stringify({ filename, sku, action: 'error', error: err.message }));
      console.error('Error processing', filename, err.message);
    }
  }

  const logPath = path.join(SPARE_DIR, `relink-rename${DRY_RUN ? '-dryrun' : ''}-${Date.now()}.jsonl`);
  fs.writeFileSync(logPath, logLines.join('\n'));

  await mongoose.disconnect();

  console.log(`Renamed/moved: ${renamed}`);
  console.log(`Products updated with fallbackUrl: ${productUpdated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Log: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
