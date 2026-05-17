const mongoose = require('mongoose');
const Product = require('../src/models/Product');

const codes = [
  '40232379123', '40232555442', '51497363840', '80686009955',
  '81128000646', '81128001872', '81128002879', '82000809791',
  '85246503126', '88076188365', '88076190566', '655709000303',
  '810020890020', '812066020300', '814794011957', '816136023413',
  '850003347653', '857186006025', '858349004100', '860009871007'
];

async function run() {
  await mongoose.connect('mongodb://localhost:27017/liquor_shop');
  let hasImage = 0;
  let noImage = 0;
  for (const c of codes) {
    const p = await Product.findOne({ code: c }).lean();
    if (p && p.images && p.images.length > 0) {
      hasImage++;
    } else {
      noImage++;
      console.log('No image:', c, p?.name);
    }
  }
  console.log('\nProducts with images: ' + hasImage + '/' + codes.length);
  console.log('Products without images: ' + noImage + '/' + codes.length);
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
