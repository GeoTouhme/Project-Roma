const mongoose = require('mongoose');

const uri = 'mongodb+srv://rchintan77:LcUwAquAzGzYMrJ4@liquorcluster.33tgqb3.mongodb.net/?retryWrites=true&w=majority';

(async () => {
  await mongoose.connect(uri, { dbName: 'liquor_shop' });

  const cats = await mongoose.connection.db.collection('categories').find({}).toArray();
  console.log('Categories:', cats.length);
  cats.forEach(c => console.log('  -', c.name));

  const cocktail = cats.find(c => /cocktail/i.test(c.name));
  if (cocktail) {
    const prods = await mongoose.connection.db.collection('products').countDocuments({ category: cocktail._id });
    const withImg = await mongoose.connection.db.collection('products').countDocuments({ category: cocktail._id, images: { $exists: true, $ne: [] } });
    console.log('Cocktail products:', prods);
    console.log('With images:', withImg);
  } else {
    console.log('No cocktail category found');
  }

  await mongoose.disconnect();
})();
