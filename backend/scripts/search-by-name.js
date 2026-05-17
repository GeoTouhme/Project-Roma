const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const searchTerms = [
  'UNCLE NEAREST 1884',
  'UNCLE NEAREST 1856',
  'UNCLE NEAREST RYE',
  'JIM BEAM PINEAPPLE',
  'WOODFORD RESERVE',
  'CROWN ROYAL',
  'MAKERS MARK CHAMPION',
  'BUCHANAN',
  'BUCHANANS SCOTCH GREEN SEAL',
  'JEFFERSON',
  'CHICKEN COCK',
  'Highland Park',
  'DUKE BOURBON',
  'HOWLER HEAD',
  'YELLOW ROSE OUTLAW',
  'Woodinville',
  'FRASER',
];

async function run() {
  await mongoose.connect('mongodb://localhost:27017/liquor_shop');
  const count = await Product.countDocuments();
  console.log('Products in DB:', count, '\n');

  for (const term of searchTerms) {
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const products = await Product.find({ name: regex }).limit(5).lean();
    if (products.length > 0) {
      console.log('Found for:', term);
      products.forEach(p => {
        console.log(`  → "${p.name}" | code: ${p.code} | sku: ${p.sku} | id: ${p._id}`);
      });
      console.log();
    }
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
