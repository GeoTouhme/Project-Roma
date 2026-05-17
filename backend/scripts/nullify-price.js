// One-off script: set price = null on all products where price exists
// Keeps priceSale intact

require('dotenv').config();
const mongoose = require('mongoose');

const Product = require('../src/models/Product');

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const result = await Product.updateMany(
    { price: { $ne: null } },
    { $set: { price: null } }
  );

  console.log(`Updated ${result.modifiedCount} products — price set to null`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
