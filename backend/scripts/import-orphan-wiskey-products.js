/**
 * import-orphan-wiskey-products.js
 *
 * Creates placeholder products for orphan wiskey-photos
 * and uploads their photos to Cloudinary.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const cloudinaryService = require('../src/services/cloudinary.service');

const PHOTOS_DIR = path.join(__dirname, '../wiskey-photos');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

async function connectDB() {
    const uri = 'mongodb://127.0.0.1:27017/liquor_shop';
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`Connected — ${count} products\n`);
}

async function run() {
    await connectDB();

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    // Get categories
    const whiskeyCat = await Category.findOne({ name: 'WHISKEY' });
    const vodkaCat = await Category.findOne({ name: 'VODKA' });
    if (!whiskeyCat || !vodkaCat) {
        console.error('❌ WHISKEY or VODKA category not found');
        process.exit(1);
    }

    // Get all existing product codes
    const allProds = await Product.find({}, 'code sku');
    const dbCodes = new Set(allProds.map(p => String(p.code || '').trim()));

    // Scan all photo files
    const orphanList = [];
    function scanDir(dir, subdir) {
        const entries = fs.readdirSync(dir);
        for (const ent of entries) {
            const full = path.join(dir, ent);
            const stat = fs.statSync(full);
            if (stat.isDirectory()) {
                scanDir(full, ent);
                continue;
            }
            if (!/\.(jpg|jpeg)$/i.test(ent)) continue;
            if (ent.includes('(1)')) continue; // skip duplicates

            const base = path.parse(ent).name.replace(/\s*\(\d+\)$/, '').trim();
            const stripped = stripLeadingZeros(base);
            if (dbCodes.has(stripped)) continue;

            const category = subdir === 'vodka' ? vodkaCat : whiskeyCat;
            const type = subdir === 'vodka' ? 'Vodka' : 'Whiskey';
            orphanList.push({ upc: base, stripped, filename: ent, subdir, photoPath: full, category, type });
        }
    }
    scanDir(PHOTOS_DIR, '');

    console.log(`Found ${orphanList.length} orphan photos\n`);
    if (orphanList.length === 0) {
        console.log('No orphans to process. Exiting.');
        process.exit(0);
    }

    const results = {
        created: [],
        skipped: [],
        uploaded: [],
        errors: [],
    };

    // ── CREATE PRODUCTS ──
    console.log(`${'='.repeat(60)}`);
    console.log(`CREATING ${orphanList.length} ORPHAN PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    const productsToUpload = [];

    for (let i = 0; i < orphanList.length; i++) {
        const o = orphanList[i];
        const progress = `[${i + 1}/${orphanList.length}]`;

        const existing = await Product.findOne({
            $or: [{ code: o.stripped }, { sku: `BP-${o.stripped}` }],
        });

        if (existing) {
            console.log(`${progress} ⚠️ Already exists: "${existing.name}" (code=${existing.code})`);
            results.skipped.push({ upc: o.upc, reason: 'already exists', productId: existing._id.toString() });
            productsToUpload.push({ ...o, productId: existing._id.toString() });
            continue;
        }

        const name = `${o.type} Product - ${o.upc}`;
        const slug = `${o.type.toLowerCase()}-product-${o.stripped}`;
        const sku = `BP-${o.stripped}`;

        try {
            const product = await Product.create({
                name,
                slug,
                sku,
                code: o.stripped,
                priceSale: 0,
                available: 0,
                status: 'Inactive',
                description: `Placeholder ${o.type.toLowerCase()} product created from orphan photo. Please update name, price, and details before activating.`,
                category: o.category._id,
                images: [],
            });
            console.log(`${progress} ✅ Created: "${product.name}" | id=${product._id}`);
            results.created.push({ upc: o.upc, stripped: o.stripped, productId: product._id.toString(), name });
            productsToUpload.push({ ...o, productId: product._id.toString() });
        } catch (err) {
            console.error(`${progress} ❌ Failed to create for ${o.upc}: ${err.message}`);
            results.errors.push({ upc: o.upc, stage: 'create', error: err.message });
        }
    }

    // ── UPLOAD PHOTOS ──
    console.log(`\n${'='.repeat(60)}`);
    console.log(`UPLOADING PHOTOS FOR ${productsToUpload.length} PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    for (let i = 0; i < productsToUpload.length; i++) {
        const o = productsToUpload[i];
        const progress = `[${i + 1}/${productsToUpload.length}]`;

        if (!fs.existsSync(o.photoPath)) {
            console.log(`${progress} ⚠️ Photo not found: ${o.photoPath}`);
            results.errors.push({ upc: o.upc, stage: 'photo-missing' });
            continue;
        }

        const tempPath = path.join(TEMP_DIR, `temp_${o.stripped}.jpg`);
        fs.copyFileSync(o.photoPath, tempPath);

        try {
            console.log(`${progress} 📤 Uploading ${o.filename} ...`);
            const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

            await Product.updateOne(
                { _id: o.productId },
                {
                    $set: {
                        images: [{
                            url: uploadResult.url,
                            _id: uploadResult.public_id,
                            blurDataURL: uploadResult.blurDataURL,
                        }],
                    },
                }
            );

            console.log(`   ✅ Uploaded: ${uploadResult.url}`);
            results.uploaded.push({ upc: o.upc, productId: o.productId, url: uploadResult.url });
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.error(`   ❌ Upload failed: ${err.message}`);
            results.errors.push({ upc: o.upc, stage: 'upload', error: err.message });
        }
    }

    // ── SUMMARY ──
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Products created:   ${results.created.length}`);
    console.log(`Products skipped:   ${results.skipped.length}`);
    console.log(`Photos uploaded:    ${results.uploaded.length}`);
    console.log(`Errors:             ${results.errors.length}`);

    const reportPath = path.join(__dirname, 'orphan-wiskey-import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
