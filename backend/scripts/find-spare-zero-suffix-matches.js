const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const SPARE_DIR = process.env.SPARE_DIR || '/home/geo/projects/Project-Roma/image-fallback/spare';
const OUTPUT = process.env.OUTPUT || path.join(SPARE_DIR, `relink-candidates-${Date.now()}.jsonl`);

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const files = fs.readdirSync(SPARE_DIR).filter(f => fs.statSync(path.join(SPARE_DIR, f)).isFile());
  const candidates = files.filter(f => /_0\.[a-zA-Z0-9]+$/i.test(f));

  console.log(`_0-suffixed files in spare: ${candidates.length}`);

  const logLines = [];
  let foundBySku = 0;
  let foundByImage = 0;
  let noMatch = 0;

  for (const filename of candidates) {
    const base = filename.replace(/_0(\.[a-zA-Z0-9]+)$/i, '$1'); // e.g. 018200204326.jpg
    const sku = filename.replace(/_0\.[a-zA-Z0-9]+$/i, '');      // e.g. 018200204326

    const bySku = await Product.findOne({ sku });
    const byImage = await Product.findOne({ 'images.url': { $regex: base.replace(/\./g, '\\.') } });

    const match = bySku || byImage;
    if (bySku) foundBySku++;
    if (byImage) foundByImage++;
    if (!match) noMatch++;

    logLines.push(JSON.stringify({
      filename,
      base,
      sku,
      matched: !!match,
      matchedBySku: !!bySku,
      matchedByImage: !!byImage,
      productId: match?._id?.toString() || null,
      productName: match?.name || null,
      productSku: match?.sku || null,
      productImages: match?.images?.map(i => i.url) || [],
    }));
  }

  fs.writeFileSync(OUTPUT, logLines.join('\n'));
  await mongoose.disconnect();

  console.log(`Matched by SKU: ${foundBySku}`);
  console.log(`Matched by image URL: ${foundByImage}`);
  console.log(`No match: ${noMatch}`);
  console.log(`Output: ${OUTPUT}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
