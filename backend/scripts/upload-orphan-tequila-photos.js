/**
 * upload-orphan-tequila-photos.js
 *
 * Uploads photos for the 47 newly created orphan tequila placeholder products.
 */

const path = require('path');
const fs = require('fs');

// Load env FIRST
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');

const PHOTOS_DIR = path.join(__dirname, '../tequila-photos');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');
const DELAY_MS = 1000;

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

    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

    // Find the 47 newly created orphan placeholders (no images, name starts with "Tequila Product")
    const products = await Product.find({
        name: { $regex: /^Tequila Product/ },
        'images.0': { $exists: false }
    }).select('name code sku').lean();

    console.log(`Found ${products.length} placeholder products needing photos\n`);

    const results = { uploaded: 0, errors: [], noPhoto: [] };

    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const progress = `[${i + 1}/${products.length}]`;
        const upc = product.code;

        const photoPath = findPhotoPath(upc);
        if (!photoPath || !fs.existsSync(photoPath)) {
            console.log(`${progress} ⚠️ No photo for UPC: ${upc} (${product.name})`);
            results.noPhoto.push(upc);
            continue;
        }

        const tempPath = path.join(TEMP_DIR, `temp_orphan_${path.basename(photoPath)}`);
        fs.copyFileSync(photoPath, tempPath);

        try {
            console.log(`${progress} 📤 ${product.name} — ${path.basename(photoPath)}`);
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
            console.log(`   ✅ ${uploadResult.url}`);
        } catch (err) {
            console.error(`   ❌ ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }

        await new Promise(r => setTimeout(r, DELAY_MS));
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total:        ${products.length}`);
    console.log(`Uploaded:     ${results.uploaded}`);
    console.log(`No photo:     ${results.noPhoto.length}`);
    console.log(`Errors:       ${results.errors.length}`);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
