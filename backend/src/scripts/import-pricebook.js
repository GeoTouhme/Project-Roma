const mongoose = require('mongoose');
const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

const Product = require('../models/Product');
const Category = require('../models/Category');

const PLACEHOLDER_IMAGE = {
  url: 'https://via.placeholder.com/600x600.png?text=No+Image',
  _id: 'placeholder_001',
  blurDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
};

const PLACEHOLDER_COVER = {
  ...PLACEHOLDER_IMAGE,
};

// Prioritized category order for the homepage category slider/filter.
const CATEGORY_ORDER = [
  'Wine', 'Red Wine', 'White Wine', 'Wine Rosé', 'Wine Cabernet Sauvignon', 'Wine Small Sizes',
  'Beer', 'IPA', 'Domestic Beer', 'Craft / Local Beer', 'Import Beer', 'Mexican Beer',
  'Hard Seltzer', 'Hard Iced Tea', 'Malt Beverage', 'Cider', 'Sake & Soju', 'Spiked',
  'Tequila', 'Whiskey', 'Vodka', 'Vodka - Flavored', 'Rum', 'GIN', 'Liqueur', 'Shots',
  'Spirits - Other', 'Scotch Whisky', 'Brandy & Cognac', 'Ready-to-Drink',
  'Energy Drinks', 'Soda', 'Healthy Soda', 'Juice', 'Water', 'SPARKLING WATER', 'COCUNUT & Flavored  WATER',
  'Iced Tea', 'Specialty Drinks', 'Exhotic Drink', 'Kombucha', 'Foucus and cava drinks',
  'Grocery', 'Snacks & Condiments', 'Hanging Snacks', 'Chips', 'Chips - Frito-Lay',
  'Candy & Chocolate', 'Gum & Breath Mints', 'Ice Cream', 'Exotic ice-cream', 'BEEF JERKY',
  'Health & Wellness', 'Protein Bars', 'Protein & Hydration', 'Coffee & Milk & Protein shakes and Dairy', 'Milk',
  'Cigars', 'Tabaco Cigarettes', 'Nicotine Pouches', 'Zyn', 'Nicotine & Tobacco Products', 'Juul',
  'Rolling Papers & Wraps', 'Vape',
  'ACCESSORIES', 'General Merchandise', 'Beach Essentials', 'Sun Care',
  'Fish Bait', 'Ice', 'System', 'Tax', 'SCRATCHER', 'Medicen', 'SEXUAL ENHANCEMENT',
  'Mixer', 'mixers & Drink', 'Drinks & Mixers', 'Pantry & Grocery Extras',
];

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

function getCategoryOrder(name) {
  const idx = CATEGORY_ORDER.indexOf(name);
  return idx >= 0 ? idx + 1 : 999; // Unordered categories get a large fallback order
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

        // 1. Create/update categories with order values
        const uniqueCategories = [...new Set(results.map(r => r.category).filter(Boolean))];
        const categoryMap = {};

        for (const catName of uniqueCategories) {
          const slug = slugify(catName);
          let category = await Category.findOne({ slug });
          const order = getCategoryOrder(catName);

          if (!category) {
            category = await Category.create({
              name: catName,
              slug,
              status: 'active',
              taxable: true,
              crvRate: 0,
              order,
              metaTitle: catName,
              metaDescription: `Shop ${catName} at Bal-Port Liquors`,
              description: `Browse our selection of ${catName}`,
              cover: PLACEHOLDER_COVER,
            });
            console.log(`Created category: ${catName} (order=${order})`);
          } else {
            category.order = order;
            await category.save();
            console.log(`Updated category: ${catName} (order=${order})`);
          }
          categoryMap[catName] = category._id;
        }

        // 2. Import products
        let created = 0;
        let skipped = 0;

        for (const row of results) {
          const sku = row.sku || row.upc;
          const existing = await Product.findOne({ sku });
          if (existing) {
            skipped++;
            continue;
          }

          const categoryId = categoryMap[row.category];
          if (!categoryId) {
            console.log(`Skipping ${row.name}: no category found`);
            skipped++;
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
            category: categoryId,
            price,
            priceSale: price,
            available: parseInt(row.stock, 10) || 0,
            size: row.size || null,
            sold: 0,
            images: [PLACEHOLDER_IMAGE],
            tags: row.category ? [row.category] : [],
            colors: [],
            sizes: row.size ? [row.size] : [],
          });
          created++;
        }

        console.log(`\nImport complete: ${created} created, ${skipped} skipped`);
        process.exit(0);
      } catch (err) {
        console.error('Import error:', err);
        process.exit(1);
      }
    });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
