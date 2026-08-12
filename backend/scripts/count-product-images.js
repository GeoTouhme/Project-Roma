const mongoose = require('mongoose');
async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const Product = mongoose.connection.collection('products');
  const total = await Product.countDocuments();
  const real = await Product.countDocuments({
    images: {$exists: true, $ne: []},
    $expr: {$not: {$regexMatch: {input: {$arrayElemAt: ['$images.url', 0]}, regex: 'placeholder'}}}
  });
  const placeholder = await Product.countDocuments({
    images: {$exists: true, $ne: []},
    $expr: {$regexMatch: {input: {$arrayElemAt: ['$images.url', 0]}, regex: 'placeholder'}}
  });
  console.log(JSON.stringify({total, real, placeholder}));
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
