const mongoose = require('mongoose');
const Category = require('../src/models/Category');

(async () => {
  const uri = 'mongodb+srv://rchintan77:LcUwAquAzGzYMrJ4@liquorcluster.33tgqb3.mongodb.net/?retryWrites=true&w=majority&appName=liquorcluster';
  await mongoose.connect(uri, { dbName: 'liquor_shop' });

  const cats = await Category.find({}).lean();
  console.log(`Found ${cats.length} categories:\n`);
  cats.forEach(c => console.log(`  - ${c.name} (slug: ${c.slug || 'none'})`));

  await mongoose.disconnect();
})();
