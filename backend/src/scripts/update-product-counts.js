const mongoose = require('mongoose');
const Product = require('../models/Product');
const Category = require('../models/Category');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');
  console.log('Connected to MongoDB');

  const counts = await Product.aggregate([
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]);

  for (const c of counts) {
    await Category.updateOne({ _id: c._id }, { productCount: c.count });
  }

  console.log(`Updated ${counts.length} categories with product counts`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
