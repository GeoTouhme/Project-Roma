/**
 * Fix categories and subcategories from pricebook CSV.
 *
 * 1. Assign 8 uncategorized products to System subcategory
 * 2. Move 5 subcategories to correct parent categories
 * 3. Update product.category for products under moved subcategories
 * 4. Set `category` parent field on all 86 subcategories
 * 5. Recalculate productCount on all categories and subcategories
 *
 * Run from backend/ with MONGODB_URI set.
 */

const mongoose = require('mongoose');

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  const db = mongoose.connection.db;
  const products = db.collection('products');
  const categories = db.collection('categories');
  const subcategories = db.collection('subcategories');

  // --- Build name → ObjectId maps ---
  const allCats = await categories.find({}).toArray();
  const catByName = {};
  const catById = {};
  allCats.forEach(c => {
    catByName[c.name] = c._id;
    catById[c._id.toString()] = c;
  });

  const allSubs = await subcategories.find({}).toArray();
  const subByName = {};
  const subById = {};
  allSubs.forEach(s => {
    subByName[s.name] = s._id;
    subById[s._id.toString()] = s;
  });

  // =========================================================
  // FIX 1: Assign 8 uncategorized products to System subcategory
  // =========================================================
  console.log('\n--- FIX 1: Uncategorized products ---');
  const systemSubId = subByName['System'];
  const accessoriesCatId = catByName['Accessories & More'];
  if (!systemSubId) {
    console.error('ERROR: "System" subcategory not found');
    process.exit(1);
  }

  const uncategorizedSkus = [
    '499733700019', '499733700040', '75050054', '074570082025',
    '499733700002', '644216837632', '688083004339', '853736005548',
  ];

  for (const sku of uncategorizedSkus) {
    const r = await products.updateOne(
      { sku },
      { $set: { category: accessoriesCatId, subCategory: systemSubId } }
    );
    console.log(`  ${sku}: matched=${r.matchedCount} modified=${r.modifiedCount}`);
  }

  // =========================================================
  // FIX 2: Move 5 subcategories to correct parent categories
  // =========================================================
  console.log('\n--- FIX 2: Move questionable subcategories ---');
  const moves = [
    { sub: 'Sake & Soju',                                    newCat: 'Spirits' },
    { sub: 'Non-Alcoholic Beer & Wine',                      newCat: 'Non-Alcoholic Drinks' },
    { sub: 'Coffee & Milk & Protein shakes and Dairy',       newCat: 'Non-Alcoholic Drinks' },
    { sub: 'Protein & Hydration',                            newCat: 'Non-Alcoholic Drinks' },
    { sub: 'Protein Bars',                                   newCat: 'Snacks & Food' },
  ];

  for (const move of moves) {
    const subId = subByName[move.sub];
    const newCatId = catByName[move.newCat];
    if (!subId || !newCatId) {
      console.error(`  SKIP: ${move.sub} or ${move.newCat} not found`);
      continue;
    }

    // Update all products under this subcategory to new parent category
    const r = await products.updateMany(
      { subCategory: subId },
      { $set: { category: newCatId } }
    );
    console.log(`  ${move.sub} → ${move.newCat}: ${r.modifiedCount} products updated`);
  }

  // =========================================================
  // FIX 3: Set parent category on all 86 subcategories
  // =========================================================
  console.log('\n--- FIX 3: Set parent category on subcategories ---');

  // Build sub → parent mapping from product assignments (after fixes)
  const subToParent = {};
  const aggResult = await products.aggregate([
    { $match: { subCategory: { $exists: true, $ne: null }, category: { $exists: true, $ne: null } } },
    { $group: { _id: '$subCategory', parentCategory: { $first: '$category' }, count: { $sum: 1 } } },
  ]).toArray();

  aggResult.forEach(a => {
    subToParent[a._id.toString()] = a.parentCategory;
  });

  let subFixed = 0;
  for (const sub of allSubs) {
    const parentId = subToParent[sub._id.toString()];
    if (parentId) {
      await subcategories.updateOne(
        { _id: sub._id },
        { $set: { category: parentId } }
      );
      subFixed++;
    }
  }
  console.log(`  ${subFixed}/${allSubs.length} subcategories got parent category set`);

  // =========================================================
  // FIX 4: Recalculate productCount on all categories and subcategories
  // =========================================================
  console.log('\n--- FIX 4: Recalculate productCount ---');

  // Subcategory counts
  const subCounts = await products.aggregate([
    { $match: { subCategory: { $exists: true, $ne: null } } },
    { $group: { _id: '$subCategory', count: { $sum: 1 } } },
  ]).toArray();

  let subCountUpdated = 0;
  for (const sc of subCounts) {
    await subcategories.updateOne(
      { _id: sc._id },
      { $set: { productCount: sc.count } }
    );
    subCountUpdated++;
  }
  console.log(`  ${subCountUpdated} subcategory productCounts updated`);

  // Category counts
  const catCounts = await products.aggregate([
    { $match: { category: { $exists: true, $ne: null } } },
    { $group: { _id: '$category', count: { $sum: 1 } } },
  ]).toArray();

  let catCountUpdated = 0;
  for (const cc of catCounts) {
    await categories.updateOne(
      { _id: cc._id },
      { $set: { productCount: cc.count } }
    );
    catCountUpdated++;
  }
  console.log(`  ${catCountUpdated} category productCounts updated`);

  // =========================================================
  // SUMMARY
  // =========================================================
  console.log('\n========== DONE ==========');
  console.log(`Uncategorized products fixed: 8`);
  console.log(`Subcategories moved: ${moves.length}`);
  console.log(`Subcategory parent links set: ${subFixed}/${allSubs.length}`);
  console.log(`productCount recalculated: ${catCountUpdated} categories, ${subCountUpdated} subcategories`);

  // Final check
  const remainingUncat = await products.countDocuments({
    $or: [{ category: { $exists: false } }, { category: null }, { subCategory: { $exists: false } }, { subCategory: null }]
  });
  console.log(`\nRemaining uncategorized products: ${remainingUncat}`);

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});