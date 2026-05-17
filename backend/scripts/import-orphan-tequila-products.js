/**
 * import-orphan-tequila-products.js
 *
 * Creates placeholder products in MongoDB for 47 orphan tequila UPCs
 * (photos exist but no pricebook record), uploads their photos to
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

const PHOTOS_DIR = path.join(__dirname, '../tequila-photos');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');

// Read orphan UPCs from file
const ORPHAN_FILE = path.join(__dirname, 'tequila-orphans-not-found.txt');
const ORPHAN_UPCS = fs.readFileSync(ORPHAN_FILE, 'utf-8').split('\n').filter(Boolean);

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

function getAllJpgFiles(dir, baseDir = dir) {
    const results = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...getAllJpgFiles(fullPath, baseDir));
        } else if (entry.name.toLowerCase().endsWith('.jpg')) {
            results.push(path.relative(baseDir, fullPath));
        }
    }
    return results;
}

function findPhotoPath(upc) {
    const allPhotos = getAllJpgFiles(PHOTOS_DIR);
    const photoBasenames = allPhotos.map(p => path.basename(p).replace(/\.jpg$/i, ''));

    let idx = photoBasenames.indexOf(upc);
    if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);

    const padded = upc.padStart(13, '0');
    idx = photoBasenames.indexOf(padded);
    if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);

    for (let len = 12; len <= 14; len++) {
        const tryPadded = upc.padStart(len, '0');
        idx = photoBasenames.indexOf(tryPadded);
        if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);
    }

    return null;
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

    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
        console.error('❌ Cloudinary env vars not loaded. Run with explicit vars, e.g.: CLOUDINARY_CLOUD_NAME=xx CLOUDINARY_API_KEY=yy CLOUDINARY_API_SECRET=zz node scripts/import-orphan-tequila-products.js');
        process.exit(1);
    }

    // Get categories
    const tequilaCat = await Category.findOne({ name: 'TEQUILA' });
    const cocktailCat = await Category.findOne({ name: 'COCKTAILS & SELTZERS' });
    const subCat = await SubCategory.findOne({ name: { $regex: /^All/i } });

    if (!tequilaCat || !cocktailCat) {
        console.error('❌ Required categories not found');
        process.exit(1);
    }

    console.log(`TEQUILA category:     ${tequilaCat.name} (${tequilaCat._id})`);
    console.log(`COCKTAILS category:   ${cocktailCat.name} (${cocktailCat._id})\n`);

    const results = {
        created: [],
        skipped: [],
        uploaded: [],
        uploadErrors: [],
    };

    const productsToUpload = [];

    console.log(`${'='.repeat(60)}`);
    console.log(`CREATING ${ORPHAN_UPCS.length} ORPHAN PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    for (let i = 0; i < ORPHAN_UPCS.length; i++) {
        const upc = ORPHAN_UPCS[i];
        const stripped = stripLeadingZeros(upc);
        const progress = `[${i + 1}/${ORPHAN_UPCS.length}]`;

        const existing = await Product.findOne({
            $or: [{ code: stripped }, { sku: `BP-${stripped}` }],
        });

        if (existing) {
            console.log(`${progress} ⚠️ Already exists: "${existing.name}" (code=${existing.code})`);
            results.skipped.push({ upc, reason: 'already exists', productId: existing._id.toString() });
            continue;
        }

        const name = `Tequila Product - ${upc}`;
        const slug = `tequila-product-${stripped}`;
        const sku = `BP-${stripped}`;

        // Determine category by photo location or default to TEQUILA
        const photoPath = findPhotoPath(upc);
        const isCocktail = photoPath && photoPath.includes('cocktail');
        const categoryId = isCocktail ? cocktailCat._id : tequilaCat._id;

        try {
            const product = await Product.create({
                name,
                slug,
                sku,
                code: stripped,
                price: 0,
                priceSale: 0,
                available: 0,
                status: 'Inactive',
                description: 'Placeholder product created from orphan photo. Please update name, price, and details before activating.',
                category: categoryId,
                subCategory: subCat ? subCat._id : null,
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
        const photoPath = findPhotoPath(upc);

        if (!photoPath || !fs.existsSync(photoPath)) {
            console.log(`${progress} ⚠️ Photo not found for UPC: ${upc}`);
            results.uploadErrors.push({ upc, stage: 'photo-missing' });
            continue;
        }

        const tempPath = path.join(TEMP_DIR, `temp_tequila_${upc}.jpg`);
        fs.copyFileSync(photoPath, tempPath);

        try {
            console.log(`${progress} 📤 Uploading ${path.basename(photoPath)} ...`);
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

    const reportPath = path.join(__dirname, 'orphan-tequila-import-report.json');
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
