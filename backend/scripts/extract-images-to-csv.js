'use strict';

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGO_URI = 'mongodb://127.0.0.1:27017/liquor_shop';
const OUT_PATH = path.join(__dirname, 'product_images.csv');

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected to local MongoDB');

  const db = client.db('liquor_shop');
  const col = db.collection('products');

  const count = await col.countDocuments();
  console.log(`Total products: ${count}`);

  // Projection: sku, code (UPC), images
  const cursor = col.find({}, { projection: { sku: 1, code: 1, images: 1 } }).limit(10000);

  const lines = ['sku,upc,image_url'];
  let rowCount = 0;

  for await (const product of cursor) {
    const sku = (product.sku || '').toString().trim();
    const upc = (product.code || '').toString().trim();
    const images = product.images || [];

    for (const img of images) {
      const url = (img.url || '').toString().trim();
      if (!sku || !url) continue;

      // CSV-escape
      const esc = (s) => {
        s = String(s).replace(/"/g, '""');
        return `"${s}"`;
      };
      lines.push(`${esc(sku)},${esc(upc)},${esc(url)}`);
      rowCount++;
    }
  }

  await client.close();

  fs.writeFileSync(OUT_PATH, lines.join('\n') + '\n', 'utf8');
  console.log(`Wrote ${rowCount} image rows to ${OUT_PATH}`);

  // Show sample
  lines.slice(0, 6).forEach(l => console.log(l));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
