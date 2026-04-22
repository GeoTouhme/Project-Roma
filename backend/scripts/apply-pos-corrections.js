const mongoose = require('mongoose');
const corrections = require('./pos-verified-corrections');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://balport-mongo:27017/liquor_shop';

// Category slug → DB category slug mapping
const CATEGORY_SLUG_MAP = {
    'beer': 'beer',
    'wine': 'wine',
    'whiskey': 'whiskey',
    'vodka': 'vodka',
    'tequila': 'tequila',
    'rum': 'rum',
    'gin': 'gin',
    'liqueur-spirits': 'liqueur-spirits',
    'cocktails-seltzers': 'cocktails-seltzers',
    'snacks': 'snacks',
    'candy': 'candy',
    'gum-mints': 'gum-mints',
    'soda': 'soda',
    'juice-drinks': 'juice-drinks',
    'energy-drinks': 'energy-drinks',
    'water': 'water',
    'tea-coffee': 'tea-coffee',
    'ice-cream': 'ice-cream',
    'grocery': 'grocery',
    'pharmacy-care': 'pharmacy-care',
    'accessories': 'accessories',
};

async function run() {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.\n');

    const db = mongoose.connection.db;
    const products = db.collection('products');

    // Group by target category for efficient bulk operations
    const byTarget = {};
    for (const c of corrections) {
        if (!byTarget[c.to]) byTarget[c.to] = [];
        byTarget[c.to].push(c);
    }

    let totalUpdated = 0;
    let totalFailed = 0;
    const results = [];

    console.log(`Starting migration of ${corrections.length} products...\n`);
    console.log('='.repeat(60));

    for (const [targetCat, items] of Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length)) {
        const ids = items.map(i => new mongoose.Types.ObjectId(i.id));
        
        try {
            const result = await products.updateMany(
                { _id: { $in: ids } },
                { $set: { category: targetCat } }
            );
            
            totalUpdated += result.modifiedCount;
            results.push({ target: targetCat, attempted: items.length, updated: result.modifiedCount });
            console.log(`✅ → ${targetCat.padEnd(22)} ${result.modifiedCount}/${items.length} updated`);
        } catch (err) {
            totalFailed += items.length;
            console.error(`❌ → ${targetCat}: FAILED - ${err.message}`);
        }
    }

    console.log('='.repeat(60));
    console.log(`\n✅ Total updated: ${totalUpdated}`);
    console.log(`❌ Total failed:  ${totalFailed}`);
    console.log(`📦 Total attempted: ${corrections.length}`);

    // Verification: count products in each affected category
    console.log('\n--- Post-migration category counts (affected) ---');
    const affectedCats = [...new Set(corrections.map(c => c.to))];
    for (const cat of affectedCats.sort()) {
        const count = await products.countDocuments({ category: cat, status: 'active' });
        console.log(`  ${cat.padEnd(22)}: ${count} active products`);
    }

    await mongoose.disconnect();
    console.log('\nDone. Disconnected.');
}

run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
