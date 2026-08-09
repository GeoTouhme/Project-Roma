const mongoose = require('mongoose');
const Product = require('../models/Product');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop');
  console.log('Connected to MongoDB');

  // Swap price and priceSale: copy current price back to priceSale, then set price to null
  const products = await Product.find({ category: { $exists: true, $ne: null } });
  let updated = 0;
  for (const p of products) {
    await Product.updateOne(
      { _id: p._id },
      { $set: { priceSale: p.price, price: null } },
      { runValidators: false }
    );
    updated++;
  }

  console.log(`Updated ${updated} products: price=null, priceSale=original price`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
