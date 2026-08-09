const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const Product = require('../models/Product');
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');

const PLACEHOLDER_IMAGE = {
  url: 'https://via.placeholder.com/600x600.png?text=No+Image',
  _id: 'placeholder_001',
  blurDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
};

const PLACEHOLDER_COVER = { ...PLACEHOLDER_IMAGE };

// Parent category definitions: name → child category names (in display order)
const PARENT_CATEGORY_MAP = {
  'Wine': ['Wine', 'Red Wine', 'White Wine', 'Wine Rosé', 'Wine Cabernet Sauvignon', 'Wine Small Sizes', 'Champagne'],
  'Beer': ['Beer', 'IPA', 'Domestic Beer', 'Craft / Local Beer', 'Import Beer', 'Mexican Beer', 'Sour Beer', 'Non-Alcoholic Beer & Wine'],
  'Spirits': ['Tequila', 'Whiskey', 'Vodka', 'Vodka - Flavored', 'Rum', 'GIN', 'Liqueur', 'Shots', 'Spirits - Other', 'Scotch Whisky', 'Brandy & Cognac'],
  'Ready-to-Drink & Seltzers': ['Ready-to-Drink', 'Hard Seltzer', 'Hard Iced Tea', 'Malt Beverage', 'Cider', 'Sake & Soju', 'Spiked', 'Kombucha'],
  'Non-Alcoholic Drinks': ['Soda', 'Healthy Soda', 'Juice', 'Water', 'SPARKLING WATER', 'COCUNUT & Flavored  WATER', 'Iced Tea', 'Specialty Drinks', 'Exhotic Drink', 'Foucus and cava drinks', 'Energy Drinks', 'Milk', 'Sports & Hydration Drinks'],
  'Snacks & Food': ['Grocery', 'Snacks & Condiments', 'Hanging Snacks', 'Chips', 'Chips - Frito-Lay', 'Candy & Chocolate', 'Gum & Breath Mints', 'Ice Cream', 'Exotic ice-cream', 'BEEF JERKY', 'Coffee & Milk & Protein shakes and Dairy', 'Pantry & Grocery Extras', 'Gummy'],
  'Health & Wellness': ['Health & Wellness', 'Protein Bars', 'Protein & Hydration'],
  'Tobacco & Nicotine': ['Cigars', 'Tabaco Cigarettes', 'Nicotine Pouches', 'Zyn', 'Nicotine & Tobacco Products', 'Juul', 'Vape', 'Rolling Papers & Wraps', 'Pouches'],
  'Mixers': ['Mixer', 'mixers & Drink', 'Drinks & Mixers'],
  'Accessories & More': ['ACCESSORIES', 'General Merchandise', 'Beach Essentials', 'Sun Care', 'Fish Bait', 'Ice', 'System', 'Tax', 'SCRATCHER', 'Medicen', 'SEXUAL ENHANCEMENT'],
};

const PARENT_ORDER = Object.keys(PARENT_CATEGORY_MAP);

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const results = [];
  const csvPath = process.argv[2] || path.join(__dirname, '../../..', 'price_book_clean.csv');

  fs.createReadStream(csvPath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        console.log(`Parsed ${results.length} products from CSV`);

        // 1. Clear old category/subcategory data
        await Category.deleteMany({});
        await SubCategory.deleteMany({});
        await Product.updateMany({}, { $unset: { category: '', subCategory: '' } });
        console.log('Cleared old categories/subcategories and product links');

        // 2. Create parent categories
        const parentMap = {};
        for (let i = 0; i < PARENT_ORDER.length; i++) {
          const name = PARENT_ORDER[i];
          const slug = slugify(name);
          const parent = await Category.create({
            name,
            slug,
            status: 'active',
            taxable: true,
            crvRate: 0,
            order: i + 1,
            metaTitle: name,
            metaDescription: `Shop ${name} at Bal-Port Liquors`,
            description: `Browse our selection of ${name}`,
            cover: PLACEHOLDER_COVER,
            subCategories: [],
            productCount: 0,
          });
          parentMap[name] = parent._id;
          console.log(`Created parent category: ${name}`);
        }

        // 3. Create subcategories (children) and build lookup
        const subCategoryMap = {}; // childName -> ObjectId
        const childToParent = {}; // childName -> parentName

        for (const [parentName, children] of Object.entries(PARENT_CATEGORY_MAP)) {
          const parentId = parentMap[parentName];
          const subCategoryIds = [];

          for (let i = 0; i < children.length; i++) {
            const childName = children[i];
            const slug = slugify(childName);
            const sub = await SubCategory.create({
              name: childName,
              slug,
              status: 'active',
              parentCategory: parentId,
              order: i + 1,
              metaTitle: childName,
              metaDescription: `Shop ${childName} at Bal-Port Liquors`,
              description: `Browse our selection of ${childName}`,
              cover: PLACEHOLDER_COVER,
              productCount: 0,
            });
            subCategoryMap[childName] = sub._id;
            childToParent[childName] = parentName;
            subCategoryIds.push(sub._id);
            console.log(`  Created subcategory: ${childName} under ${parentName}`);
          }

          // Link subcategories to parent
          await Category.findByIdAndUpdate(parentId, { subCategories: subCategoryIds });
        }

        // 4. Import products, linking to subcategory and parent category
        let created = 0;
        let skipped = 0;
        let unmapped = 0;

        for (const row of results) {
          const sku = row.sku || row.upc;
          const existing = await Product.findOne({ sku });
          if (existing) {
            skipped++;
            continue;
          }

          const childName = row.category;
          const subCategoryId = subCategoryMap[childName];
          const parentName = childToParent[childName];
          const parentCategoryId = parentName ? parentMap[parentName] : null;

          if (!subCategoryId || !parentCategoryId) {
            console.log(`Skipping ${row.name}: unmapped category '${childName}'`);
            unmapped++;
            continue;
          }

          const price = parseFloat(row.price) || 0;
          const name = row.name.trim();
          const slugBase = slugify(name);
          let slug = slugBase;
          let counter = 1;
          while (await Product.findOne({ slug })) {
            slug = `${slugBase}-${counter++}`;
          }

          await Product.create({
            name,
            slug,
            sku,
            code: row.upc,
            status: 'active',
            isFeatured: false,
            isBestSeller: false,
            isTopCollection: false,
            category: parentCategoryId,
            subCategory: subCategoryId,
            price: null,
            priceSale: price,
            available: parseInt(row.stock, 10) || 0,
            size: row.size || null,
            sold: 0,
            images: [PLACEHOLDER_IMAGE],
            tags: parentName ? [parentName] : [],
            colors: [],
            sizes: row.size ? [row.size] : [],
          });
          created++;
        }

        // 5. Update product counts
        const parentCounts = await Product.aggregate([
          { $group: { _id: '$category', count: { $sum: 1 } } },
        ]);
        for (const c of parentCounts) {
          await Category.updateOne({ _id: c._id }, { productCount: c.count });
        }

        const subCounts = await Product.aggregate([
          { $group: { _id: '$subCategory', count: { $sum: 1 } } },
        ]);
        for (const c of subCounts) {
          await SubCategory.updateOne({ _id: c._id }, { productCount: c.count });
        }

        console.log(`\nImport complete: ${created} created, ${skipped} skipped, ${unmapped} unmapped`);
        console.log(`Updated ${parentCounts.length} parent counts and ${subCounts.length} subcategory counts`);
        process.exit(0);
      } catch (err) {
        console.error('Import error:', err);
        process.exit(1);
      }
    });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
