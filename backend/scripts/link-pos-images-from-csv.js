const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const CSV_PATH = process.env.CSV_PATH || '/home/geo/projects/Project-Roma/image-fallback/pos-code-mapping-reviwed.csv';
const IMAGE_SOURCE_DIR = process.env.IMAGE_SOURCE_DIR || '/home/geo/projects/Project-Roma/image-fallback/download-review-v2';
const IMAGE_TARGET_DIR = process.env.IMAGE_TARGET_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images';
const DRY_RUN = process.env.DRY_RUN === 'true';

function normalizeUpc(upc) {
  if (!upc) return '';
  upc = upc.trim();
  // Add leading zero if it looks like an 11-digit UPC
  if (/^\d{11}$/.test(upc)) return '0' + upc;
  // Excel scientific notation strings might have . - skip those
  if (upc.includes('E') || upc.includes('e') || upc.includes('.')) return '';
  return upc;
}

function getPosCodeFromFilename(filename) {
  const m = filename.match(/^(\d+)_[a-z0-9]+\.[a-zA-Z0-9]+$/i);
  return m ? m[1] : null;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  fs.mkdirSync(IMAGE_TARGET_DIR, { recursive: true });

  const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(line => {
    // Simple CSV parse (no quoted commas in this data)
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = cols[i] ? cols[i].trim() : ''));
    return row;
  });

  let linked = 0;
  let notFound = 0;
  let alreadyHasImage = 0;
  let errors = 0;
  const logLines = [];

  for (const row of rows) {
    const filename = row.filename;
    const sourcePath = path.join(IMAGE_SOURCE_DIR, filename);
    const targetFilename = `${normalizeUpc(row.upc_sku)}_0_white.jpg`;

    if (!fs.existsSync(sourcePath)) {
      logLines.push(JSON.stringify({ action: 'error', filename, reason: 'source file missing' }));
      errors++;
      continue;
    }

    let upc = normalizeUpc(row.upc_sku);
    let product = null;
    let matchMethod = '';

    if (upc) {
      product = await Product.findOne({ sku: upc });
      matchMethod = 'sku';
    }

    if (!product && row.product_name) {
      const nameRegex = row.product_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      product = await Product.findOne({ name: { $regex: nameRegex, $options: 'i' } });
      matchMethod = 'name';
    }

    if (!product) {
      notFound++;
      logLines.push(JSON.stringify({ action: 'not_found', filename, upc: upc || null, product_name: row.product_name || null }));
      continue;
    }

    const existingImages = product.images || [];
    if (existingImages.length > 0 && existingImages[0].url && !existingImages[0].url.includes('placeholder')) {
      alreadyHasImage++;
      logLines.push(JSON.stringify({ action: 'skipped_has_image', filename, upc, productId: product._id.toString(), existingUrl: existingImages[0].url }));
      continue;
    }

    const targetPath = path.join(IMAGE_TARGET_DIR, targetFilename);
    let finalTarget = targetPath;
    let counter = 1;
    while (fs.existsSync(finalTarget)) {
      const ext = path.extname(targetPath);
      const base = targetPath.slice(0, -ext.length);
      finalTarget = `${base}_${counter}${ext}`;
      counter++;
    }

    try {
      if (!DRY_RUN) {
        fs.copyFileSync(sourcePath, finalTarget);

        // Generate a simple blur placeholder
        const blurPlaceholder = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
          'base64'
        );
        const blurDataURL = `data:image/png;base64,${blurPlaceholder.toString('base64')}`;

        await Product.updateOne(
          { _id: product._id },
          { $set: { images: [{ url: `/api/images/${path.basename(finalTarget)}`, _id: path.basename(finalTarget, path.extname(finalTarget)), blurDataURL, fallbackUrl: null }] } }
        );
      }
      linked++;
      logLines.push(JSON.stringify({
        action: DRY_RUN ? 'would_link' : 'linked',
        filename,
        upc,
        productId: product._id.toString(),
        productName: product.name,
        matchMethod,
        targetUrl: `/api/images/${path.basename(finalTarget)}`,
        targetPath: finalTarget,
      }));
    } catch (err) {
      errors++;
      logLines.push(JSON.stringify({ action: 'error', filename, upc, error: err.message }));
      console.error('Error linking', filename, err.message);
    }
  }

  const logPath = path.join(IMAGE_TARGET_DIR, `link-pos-images${DRY_RUN ? '-dryrun' : ''}-${Date.now()}.jsonl`);
  fs.writeFileSync(logPath, logLines.join('\n'));

  await mongoose.disconnect();

  console.log(`Total rows: ${rows.length}`);
  console.log(`${DRY_RUN ? 'Would link' : 'Linked'}: ${linked}`);
  console.log(`Not found: ${notFound}`);
  console.log(`Already has real image: ${alreadyHasImage}`);
  console.log(`Errors: ${errors}`);
  console.log(`Log: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
