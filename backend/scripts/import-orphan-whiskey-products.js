/**
 * import-orphan-whiskey-products.js
 *
 * Creates placeholder products in MongoDB for the 10 orphan whiskey UPCs
 * (photos exist but no DB or pricebook record), uploads their photos to
 * Cloudinary, and links them to the new products.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const cloudinaryService = require('../src/services/cloudinary.service');

// Load env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    require('dotenv').config({ path: envPath });
}

const PHOTOS_DIR = path.join(__dirname, '../wiskey-photos');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');

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

    // Ensure temp dir exists (cloudinaryService deletes the file after upload)
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    // Verify Cloudinary config loaded
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('❌ Cloudinary env vars not loaded. Run with explicit vars, e.g.:');
        console.error(`   CLOUDINARY_CLOUD_NAME=xx CLOUDINARY_API_KEY=yy CLOUDINARY_API_SECRET=zz node scripts/${path.basename(__filename)}`);
        process.exit(1);
    }

    // Get categories
    const whiskeyCat = await Category.findOne({ name: 'WHISKEY' });
    const whiskeySub = await SubCategory.findOne({ name: 'All WHISKEY' });

    if (!whiskeyCat) {
        console.error('❌ WHISKEY category not found');
        process.exit(1);
    }
    if (!whiskeySub) {
        console.error('❌ All WHISKEY subcategory not found');
        process.exit(1);
    }

    console.log(`Category:    ${whiskeyCat.name} (${whiskeyCat._id})`);
    console.log(`SubCategory: ${whiskeySub.name} (${whiskeySub._id})\n`);

    const results = {
        created: [],
        skipped: [],
        uploaded: [],
        uploadErrors: [],
    };

    // ── CREATE PRODUCTS ───────────────────────────────────────────────
    console.log(`${'='.repeat(60)}`);
    console.log(`CREATING ${ORPHAN_UPCS.length} ORPHAN PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    const productsToUpload = []; // { upc, stripped, productId }

    for (let i = 0; i < ORPHAN_UPCS.length; i++) {
        const upc = ORPHAN_UPCS[i];
        const stripped = stripLeadingZeros(upc);
        const progress = `[${i + 1}/${ORPHAN_UPCS.length}]`;

        // Safety: skip if already exists
        const existing = await Product.findOne({
            $or: [{ code: stripped }, { sku: `BP-${stripped}` }],
        });

        if (existing) {
            console.log(`${progress} ⚠️ Already exists: "${existing.name}" (code=${existing.code}, sku=${existing.sku})`);
            results.skipped.push({ upc, reason: 'already exists', productId: existing._id.toString() });
            continue;
        }

        const name = `Whiskey Product - ${upc}`;
        const slug = `whiskey-product-${stripped}`;
        const sku = `BP-${stripped}`;

        try {
            const product = await Product.create({
                name,
                slug,
                sku,
                code: stripped,
                priceSale: 0,
                available: 0,
                status: 'Inactive',
                description: 'Placeholder product created from orphan photo. Please update name, price, and details before activating.',
                category: whiskeyCat._id,
                subCategory: whiskeySub._id,
                images: [],
            });

            console.log(`${progress} ✅ Created: "${product.name}" | id=${product._id} | code=${product.code}`);
            results.created.push({ upc, stripped, productId: product._id.toString(), name });
            productsToUpload.push({ upc, stripped, productId: product._id.toString() });
        } catch (err) {
            console.error(`${progress} ❌ Failed to create product for ${upc}: ${err.message}`);
            results.uploadErrors.push({ upc, stage: 'create', error: err.message });
        }
    }

    // ── UPLOAD PHOTOS ───────────────────────────────────────────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log(`UPLOADING PHOTOS FOR ${productsToUpload.length} PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    for (let i = 0; i < productsToUpload.length; i++) {
        const { upc, productId } = productsToUpload[i];
        const progress = `[${i + 1}/${productsToUpload.length}]`;
        const photoPath = path.join(PHOTOS_DIR, `${upc}.jpg`);

        if (!fs.existsSync(photoPath)) {
            console.log(`${progress} ⚠️ Photo not found: ${upc}.jpg`);
            results.uploadErrors.push({ upc, stage: 'photo-missing' });
            continue;
        }

        // Copy to temp so the original wiskey-photos file survives deletion by cloudinaryService
        const tempPath = path.join(TEMP_DIR, `temp_${upc}.jpg`);
        fs.copyFileSync(photoPath, tempPath);

        try {
            console.log(`${progress} 📤 Uploading ${upc}.jpg ...`);
            const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

            await Product.updateOne(
                { _id: productId },
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
            results.uploaded.push({ upc, productId, url: uploadResult.url, publicId: uploadResult.public_id });

            // Small delay to be kind to Cloudinary
            await new Promise(r => setTimeout(r, 1000));
        } catch (err) {
            console.error(`   ❌ Upload failed: ${err.message}`);
            results.uploadErrors.push({ upc, stage: 'upload', error: err.message });
        }
    }

    // ── SUMMARY ───────────────────────────────────────────────────────
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Products created:   ${results.created.length}`);
    console.log(`Products skipped:   ${results.skipped.length}`);
    console.log(`Photos uploaded:    ${results.uploaded.length}`);
    console.log(`Errors:             ${results.uploadErrors.length}`);

    const reportPath = path.join(__dirname, 'orphan-whiskey-import-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        created: results.created,
        skipped: results.skipped,
        uploaded: results.uploaded,
        errors: results.uploadErrors,
        timestamp: new Date().toISOString(),
    }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
