const mongoose = require('mongoose');

async function verify() {
    await mongoose.connect('mongodb://balport-mongo:27017/liquor_shop');
    const db = mongoose.connection.db;
    const products = db.collection('products');

    // Check a sample corrected product
    const sample = await products.findOne({ _id: new mongoose.Types.ObjectId('69bc66526f0fa539b06f0c66') });
    console.log('Sample corrected product:', JSON.stringify({
        name: sample?.name,
        category: sample?.category,
        status: sample?.status,
        isActive: sample?.isActive
    }, null, 2));

    // Count totals
    const total = await products.countDocuments({});
    const withStatus = await products.countDocuments({ status: 'active' });
    const noStatus = await products.countDocuments({ status: { $exists: false } });
    console.log(`\nTotal: ${total}, status=active: ${withStatus}, no status field: ${noStatus}`);

    // Category counts (all products regardless of status)
    const cats = await products.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } }
    ]).toArray();
    
    cats.sort((a, b) => b.count - a.count);
    console.log('\n--- Category counts (all products) ---');
    for (const c of cats) {
        console.log(`  ${(c._id || 'null').toString().padEnd(25)}: ${c.count}`);
    }

    await mongoose.disconnect();
}

verify().catch(e => { console.error(e); process.exit(1); });
