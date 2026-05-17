/**
 * import-missing-whiskey-products.js
 *
 * Imports 20 products from pricebook73825.csv that exist in the CSV
 * but not in the MongoDB database. Then uploads their photos from
 * wiskey-photos/ to Cloudinary and updates the products.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const cloudinaryService = require('../src/services/cloudinary.service');

// Load env
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const PHOTOS_DIR = path.join(__dirname, '../wiskey-photos');

// The 20 UPCs from the pricebook that are missing in the DB
const MISSING_UPCS = [
    '0040232379123',
    '0040232555442',
    '0051497363840',
    '0080686009955',
    '0081128000646',
    '0081128001872',
    '0081128002879',
    '0082000809791',
    '0085246503126',
    '0088076188365',
    '0088076190566',
    '0655709000303',
    '0810020890020',
    '0812066020300',
    '0814794011957',
    '0816136023413',
    '0850003347653',
    '0857186006025',
    '0858349004100',
    '0860009871007',
];

// The 10 orphans not in pricebook either
const ORPHAN_UPCS = [
    '0080686004424',
    '0080686007746',
    '0082184004371',
    '0085246503171',
    '08262802',
    '08269203',
    '08773502',
    '08773900',
    '08776509',
    '10055406',
];

const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`Connected — ${count} products\n`);
};

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

function parsePricebookCSV(csvPath) {
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split(',');

    const idx = {
        upc: headers.indexOf('Upc'),
        department: headers.indexOf('Department'),
        name: headers.indexOf('Name'),
        cents: headers.indexOf('cents'),
        size: headers.indexOf('size'),
    };

    const products = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Simple CSV parse — handle quoted fields
        const cols = line.split(',');
        if (cols.length < Math.max(idx.upc, idx.name, idx.cents) + 1) continue;

        let upc = cols[idx.upc] || '';
        // Strip Excel formula wrapper: "=""040232379123""" → 040232379123
        upc = upc.replace(/^"=""/, '').replace(/"""$/, '').replace(/"/g, '').trim();
        if (!upc) continue;

        const name = (cols[idx.name] || '').replace(/^"/, '').replace(/"$/, '').trim();
        const department = (cols[idx.department] || '').replace(/^"/, '').replace(/"$/, '').trim();
        const cents = parseInt((cols[idx.cents] || '0').replace(/^"/, '').replace(/"$/, '').trim(), 10) || 0;
        const size = (cols[idx.size] || '').replace(/^"/, '').replace(/"$/, '').trim();

        products.push({ upc, name, department, cents, size });
    }

    return products;
}

async function run() {
    await connectDB();

    // Get categories
    const whiskeyCat = await Category.findOne({ name: 'WHISKEY' });
    const whiskeySub = await SubCategory.findOne({ name: 'All WHISKEY', parentCategory: whiskeyCat?._id });

    if (!whiskeyCat || !whiskeySub) {
        console.error('❌ Could not find WHISKEY category/subcategory');
        process.exit(1);
    }

    console.log(`Category: ${whiskeyCat.name} (${whiskeyCat._id})`);
    console.log(`SubCategory: ${whiskeySub.name} (${whiskeySub._id})\n`);

    // Parse CSV
    const csvPath = path.join(__dirname, '../../pricebook73825.csv');
    const csvProducts = parsePricebookCSV(csvPath);
    console.log(`Parsed ${csvProducts.length} rows from pricebook CSV`);

    // Filter to our 20 missing UPCs
    const missingProducts = [];
    for (const upc of MISSING_UPCS) {
        const csvUpcStripped = stripLeadingZeros(upc);
        const match = csvProducts.find(p => stripLeadingZeros(p.upc) === csvUpcStripped || p.upc === upc);
        if (match) {
            missingProducts.push({ ...match, originalUPC: upc });
        } else {
            console.log(`⚠️ UPC ${upc} not found in pricebook CSV`);
        }
    }

    console.log(`\nFound ${missingProducts.length} products to import\n`);

    // Check which already exist in DB (should be none, but double-check)
    const toImport = [];
    for (const item of missingProducts) {
        const stripped = stripLeadingZeros(item.originalUPC);
        const existing = await Product.findOne({
            $or: [
                { code: item.originalUPC },
                { code: stripped },
                { sku: `BP-${stripped}` },
                { sku: `BP-${item.originalUPC}` },
            ]
        });
        if (existing) {
            console.log(`⚠️ Already exists: "${existing.name}" (code=${existing.code}, sku=${existing.sku})`);
        } else {
            toImport.push(item);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`IMPORTING ${toImport.length} PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    const imported = [];
    let count = 0;

    for (const item of toImport) {
        count++;
        const strippedUPC = stripLeadingZeros(item.originalUPC);
        const slug = (item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + strippedUPC).substring(0, 80);
        const sku = `BP-${strippedUPC}`;
        const priceSale = item.cents / 100;

        try {
            const product = await Product.create({
                name: item.name,
                slug,
                sku,
                code: strippedUPC,
                priceSale,
                available: 100,
                status: 'Active',
                description: '',
                category: whiskeyCat._id,
                subCategory: whiskeySub._id,
                images: [],
            });

            console.log(`[${count}/${toImport.length}] ✅ Created: "${product.name}" | code=${product.code} | id=${product._id}`);
            imported.push({ upc: item.originalUPC, productId: product._id.toString(), name: product.name });
        } catch (err) {
            console.error(`[${count}/${toImport.length}] ❌ Failed to create "${item.name}": ${err.message}`);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`UPLOADING PHOTOS FOR ${imported.length} IMPORTED PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    const photoResults = [];
    let photoCount = 0;

    for (const item of imported) {
        photoCount++;
        const photoPath = path.join(PHOTOS_DIR, `${item.upc}.jpg`);

        if (!fs.existsSync(photoPath)) {
            console.log(`[${photoCount}/${imported.length}] ⚠️ Photo not found: ${item.upc}.jpg`);
            continue;
        }

        try {
            console.log(`[${photoCount}/${imported.length}] 📤 Uploading ${item.upc}.jpg...`);
            const uploadResult = await cloudinaryService.uploadImage(photoPath, 'balport-products');

            await Product.updateOne(
                { _id: item.productId },
                {
                    $set: {
                        images: [{
                            url: uploadResult.url,
                            _id: uploadResult.public_id,
                            blurDataURL: uploadResult.blurDataURL,
                        }]
                    }
                }
            );

            console.log(`   ✅ Uploaded: ${uploadResult.url}`);
            photoResults.push({ upc: item.upc, productName: item.name, url: uploadResult.url });
        } catch (err) {
            console.error(`   ❌ Upload failed: ${err.message}`);
        }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Products imported:     ${imported.length}`);
    console.log(`Photos uploaded:       ${photoResults.length}`);
    console.log(`Orphan UPCs (no data): ${ORPHAN_UPCS.length}`);

    if (ORPHAN_UPCS.length > 0) {
        console.log(`\nOrphan UPCs not in database or pricebook:`);
        ORPHAN_UPCS.forEach(u => console.log(`  - ${u}`));
    }

    // Save report
    const reportPath = path.join(__dirname, 'missing-whiskey-import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        imported,
        photoResults,
        orphans: ORPHAN_UPCS,
        timestamp: new Date().toISOString(),
    }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
