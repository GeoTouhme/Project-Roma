const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  // 1. Load current parent/subcategory IDs
  const categories = await Category.find({});
  const subCategories = await SubCategory.find({}).populate('parentCategory');

  const subMap = {};
  const parentMap = {};
  for (const sub of subCategories) {
    subMap[sub.name] = sub._id;
    parentMap[sub.name] = sub.parentCategory._id;
  }

  // 2. Read CSV to map each product to its original category
  const results = [];
  const csvPath = process.argv[2] || path.join(__dirname, '../../..', 'price_book_clean.csv');

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        console.log(`Parsed ${results.length} products from CSV`);

        let updated = 0;
        let notFound = 0;

        for (const row of results) {
          const sku = row.sku || row.upc;
          const childName = row.category;
          const subCategoryId = subMap[childName];
          const parentCategoryId = parentMap[childName];

          if (!subCategoryId || !parentCategoryId) {
            console.log(`Unmapped category: ${childName}`);
            continue;
          }

          const product = await Product.findOne({ sku });
          if (!product) {
            notFound++;
            continue;
          }

          product.category = parentCategoryId;
          product.subCategory = subCategoryId;
          await product.save();
          updated++;
        }

        // 3. Update product counts
        const parentCounts = await Product.aggregate([
          { $match: { category: { $exists: true, $ne: null } } },
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);
        for (const c of parentCounts) {
          await Category.updateOne({ _id: c._id }, { productCount: c.count });
        }

        const subCounts = await Product.aggregate([
          { $match: { subCategory: { $exists: true, $ne: null } } },
          { $group: { _id: '$subCategory', count: { $sum: 1 } } },
        ]);
        for (const c of subCounts) {
          await SubCategory.updateOne({ _id: c._id }, { productCount: c.count });
        }

        console.log(`\nMigration complete: ${updated} products updated, ${notFound} not found`);
        console.log(`Updated ${parentCounts.length} parent counts and ${subCounts.length} subcategory counts`);
        process.exit(0);
      } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
      }
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
