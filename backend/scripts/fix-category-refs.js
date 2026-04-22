const mongoose = require('mongoose');

async function fix() {
    await mongoose.connect('mongodb://balport-mongo:27017/liquor_shop');
    const db = mongoose.connection.db;
    const products = db.collection('products');
    const categories = db.collection('categories');

    // Get all categories with their slugs and IDs
    const allCats = await categories.find({}).toArray();
    console.log('=== ALL CATEGORIES ===');
    const slugToId = {};
    for (const cat of allCats) {
        console.log(`  ${(cat.slug || cat.name || 'N/A').padEnd(25)} → ${cat._id}`);
        if (cat.slug) slugToId[cat.slug] = cat._id;
        if (cat.name) slugToId[cat.name.toLowerCase()] = cat._id;
    }

    // Find all products with string category (our broken ones)
    const brokenSlugs = ['candy', 'grocery', 'liqueur-spirits', 'juice-drinks', 'snacks', 
        'soda', 'water', 'accessories', 'ice-cream', 'tea-coffee', 'cocktails-seltzers',
        'beer', 'pharmacy-care', 'energy-drinks', 'gum-mints', 'wine', 'whiskey', 'vodka', 'rum'];
    
    let totalFixed = 0;
    for (const slug of brokenSlugs) {
        const broken = await products.countDocuments({ category: slug });
        if (broken === 0) continue;
        
        const catId = slugToId[slug];
        if (!catId) {
            console.log(`❌ No category ID found for slug: ${slug}`);
            continue;
        }
        
        const result = await products.updateMany(
            { category: slug },
            { $set: { category: catId } }
        );
        
        totalFixed += result.modifiedCount;
        console.log(`✅ ${slug.padEnd(22)} → ${catId} (${result.modifiedCount} fixed)`);
    }

    console.log(`\nTotal fixed: ${totalFixed}`);

    // Verify - count categories again
    console.log('\n--- Post-fix category counts ---');
    const cats = await products.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
    ]).toArray();
    
    // Resolve category names
    for (const c of cats.sort((a, b) => b.count - a.count)) {
        const cat = allCats.find(ac => ac._id.toString() === c._id?.toString());
        const label = cat ? cat.slug || cat.name : c._id;
        console.log(`  ${String(label).padEnd(25)}: ${c.count}`);
    }

    await mongoose.disconnect();
}

fix().catch(e => { console.error(e); process.exit(1); });
