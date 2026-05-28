const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);

  const cocktailCat = await Category.findOne({ name: /cocktail/i }).lean();
  console.log('COCKTAIL category:', cocktailCat ? cocktailCat.name : 'NOT FOUND');

  if (cocktailCat) {
    const total = await Product.countDocuments({ category: cocktailCat._id });
    const withImages = await Product.countDocuments({ category: cocktailCat._id, images: { $exists: true, $ne: [] } });
    const without = await Product.countDocuments({ category: cocktailCat._id, $or: [{ images: { $exists: false } }, { images: { $size: 0 } }] });

    console.log('Total cocktail products:', total);
    console.log('With images:', withImages);
    console.log('Without images:', without);
  }

  await mongoose.disconnect();
})();
