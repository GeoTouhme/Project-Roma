/**
 * upload-tequila-orphan-photos.js
 *
 * Uploads photos for newly imported tequila orphan products.
 * Products were created but photos failed due to missing dotenv.
 */

const path = require('path');
const fs = require('fs');

// Load env FIRST before requiring cloudinary
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');

const PHOTOS_DIR = path.join(__dirname, '../tequila-photos');
const DELAY_MS = 1500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Try exact match first
    let idx = photoBasenames.indexOf(upc);
    if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);

    // Try zero-padded match (e.g., DB: 197716000032 → file: 0197716000032)
    const padded = upc.padStart(13, '0');
    idx = photoBasenames.indexOf(padded);
    if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);

    // Try shorter padding (e.g., 12-digit or 14-digit)
    for (let len = 12; len <= 14; len++) {
        const tryPadded = upc.padStart(len, '0');
        idx = photoBasenames.indexOf(tryPadded);
        if (idx !== -1) return path.join(PHOTOS_DIR, allPhotos[idx]);
    }

    return null;
}

const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`📡 Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`✅ MongoDB Connected — ${count} products`);
};

const runUpload = async () => {
    await connectDB();

    // Find newly imported tequila orphans (no images, BP- SKU)
    const products = await Product.find({
        sku: { $regex: /^BP-/ },
        'images.0': { $exists: false }
    }).select('name code sku').lean();

    console.log(`\n📦 Found ${products.length} products needing photos`);

    const results = { uploaded: 0, errors: [], noPhoto: [] };
    let processed = 0;

    for (const product of products) {
        processed++;
        const progress = `[${processed}/${products.length}]`;
        const upc = product.code;

        const photoPath = findPhotoPath(upc);
        if (!photoPath || !fs.existsSync(photoPath)) {
            console.log(`${progress} ❌ No photo file for UPC: ${upc} (${product.name})`);
            results.noPhoto.push(upc);
            continue;
        }

        console.log(`${progress} 📤 ${product.name} — ${path.basename(photoPath)}`);

        const tempPath = path.join(PHOTOS_DIR, `_temp_upload_${path.basename(photoPath)}`);
        fs.copyFileSync(photoPath, tempPath);

        try {
            const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

            await Product.updateOne(
                { _id: product._id },
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

            results.uploaded++;
            console.log(`   ✅ Uploaded: ${uploadResult.url}`);
        } catch (err) {
            console.error(`   ❌ Upload failed: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }

        await sleep(DELAY_MS);
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 PHOTO UPLOAD SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total products:     ${products.length}`);
    console.log(`  Successfully uploaded: ${results.uploaded}`);
    console.log(`  No photo file:          ${results.noPhoto.length}`);
    console.log(`  Upload errors:          ${results.errors.length}`);
    console.log(`${'═'.repeat(60)}`);

    process.exit(0);
};

runUpload().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
