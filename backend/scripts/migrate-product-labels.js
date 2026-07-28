const mongoose = require('mongoose');
const Product = require('../src/models/Product');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('MONGODB_URI environment variable is required.');
  process.exit(1);
}

const BEST_SELLER_SEED_COUNT = 12;

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB.');

    // 1. Migrate isFeatured → isTopCollection so existing featured products keep their label.
    const topCollectionResult = await Product.updateMany(
      { isTopCollection: { $ne: true } },
      [{ $set: { isTopCollection: { $ifNull: ['$isFeatured', false] } } }]
    );
    console.log(
      `Migrated isTopCollection: matched ${topCollectionResult.matchedCount}, modified ${topCollectionResult.modifiedCount}`
    );

    // 2. Seed an initial Best Seller set from the top-selling products so the home section is not empty.
    const existingBestSellers = await Product.countDocuments({ isBestSeller: true });
    if (existingBestSellers === 0) {
      const topSold = await Product.find({
        status: { $nin: ['disabled', 'inactive'] },
        available: { $gt: 0 },
      })
        .sort({ sold: -1 })
        .limit(BEST_SELLER_SEED_COUNT)
        .select('_id');

      if (topSold.length > 0) {
        const ids = topSold.map((p) => p._id);
        const bestSellerResult = await Product.updateMany(
          { _id: { $in: ids } },
          { $set: { isBestSeller: true } }
        );
        console.log(
          `Seeded best sellers: matched ${bestSellerResult.matchedCount}, modified ${bestSellerResult.modifiedCount}`
        );
      } else {
        console.log('No sold products found to seed as best sellers.');
      }
    } else {
      console.log(`Skipping best-seller seeding — ${existingBestSellers} products already flagged.`);
    }

    const counts = await Product.aggregate([
      {
        $group: {
          _id: null,
          bestSellers: { $sum: { $cond: ['$isBestSeller', 1, 0] } },
          topCollections: { $sum: { $cond: ['$isTopCollection', 1, 0] } },
        },
      },
    ]);

    if (counts.length) {
      console.log('Final counts:', counts[0]);
    }

    console.log('Migration complete.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
