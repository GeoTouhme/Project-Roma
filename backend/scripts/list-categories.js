const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Category = require('../src/models/Category');

(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);

  const cats = await Category.find({}).lean();
  console.log(`Found ${cats.length} categories:\n`);
  cats.forEach(c => console.log(`  - ${c.name} (slug: ${c.slug || 'none'})`));

  await mongoose.disconnect();
})();
