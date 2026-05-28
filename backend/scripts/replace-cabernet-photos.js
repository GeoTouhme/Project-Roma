/**
 * replace-cabernet-photos.js
 *
 * Replaces product photos with new photos from the cabernet-photos directory.
 * Matches photos by UPC code (filename) to Product.code field.
 *
 * Usage:
 *   node scripts/replace-cabernet-photos.js --dry-run
 *   node scripts/replace-cabernet-photos.js
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set.');
}

const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');
const cloudinary = require('../src/config/cloudinary');

// ─── Configuration ───────────────────────────────────────────────
const PHOTOS_DIR = path.join(__dirname, '../cabernet-photos');
const LOG_FILE = path.join(__dirname, 'cabernet-photo-migration-log.json');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 1500;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractUPC(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) return null;
    if (filename.includes('(1)')) return null;
    const name = path.basename(filename, ext);
    if (name.includes('.') || name.includes('-') || name.includes('http')) return null;
    if (!/^\d+$/.test(name)) return null;
    return name;
}

function stripLeadingZeros(str) {
    const stripped = str.replace(/^0+/, '');
    return stripped || '0';
}

async function findProductByUPC(upc) {
    let product = await Product.findOne({ code: upc });
    if (product) return product;
    const stripped = stripLeadingZeros(upc);
    product = await Product.findOne({ code: stripped });
    if (product) return product;
    product = await Product.findOne({ sku: `BP-${stripped}` });
    if (product) return product;
    product = await Product.findOne({ sku: `BP-${upc}` });
    if (product) return product;
    return null;
}

async function deleteOldImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`    Deleted old Cloudinary image: ${publicId}`);
    } catch (err) {
        console.log(`    Failed to delete old image ${publicId}: ${err.message}`);
    }
}

const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`Connected — ${count} products`);
    if (count === 0) {
        console.error('No products found! Wrong database?');
        process.exit(1);
    }
};

const runMigration = async () => {
    await connectDB();

    console.log('\n' + '='.repeat(60));
    console.log(DRY_RUN ? 'DRY RUN — No changes will be made' : 'LIVE MODE — Photos will be replaced');
    console.log('='.repeat(60));

    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`Photos directory not found: ${PHOTOS_DIR}`);
        process.exit(1);
    }

    const photoMap = new Map();
    const skippedFiles = [];

    function scanDir(dir, subdir) {
        const entries = fs.readdirSync(dir);
        for (const ent of entries) {
            const fullPath = path.join(dir, ent);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                scanDir(fullPath, ent);
            } else {
                const upc = extractUPC(ent);
                if (upc) {
                    photoMap.set(upc, { filename: ent, subdir });
                } else {
                    skippedFiles.push(ent);
                }
            }
        }
    }
    scanDir(PHOTOS_DIR, '');

    console.log(`Valid UPC photos: ${photoMap.size}`);
    if (skippedFiles.length > 0) {
        console.log(`Skipped files: ${skippedFiles.length}`);
        skippedFiles.forEach(f => console.log(`   - ${f}`));
    }

    const results = { matched: [], noMatch: [], uploaded: [], errors: [], skipped: skippedFiles };
    const migrationLog = [];
    let processed = 0;
    const total = photoMap.size;

    console.log(`\n${'-'.repeat(60)}`);
    console.log('Processing photos...\n');

    for (const [upc, fileInfo] of photoMap) {
        processed++;
        const progress = `[${processed}/${total}]`;
        const { filename, subdir } = fileInfo;

        try {
            const product = await findProductByUPC(upc);

            if (!product) {
                console.log(`${progress} No match for UPC: ${upc}`);
                results.noMatch.push({ upc, filename });
                continue;
            }

            console.log(`${progress} Match: ${upc} -> "${product.name}"`);
            results.matched.push({ upc, filename, productId: product._id.toString(), productName: product.name, productSku: product.sku });

            const oldImages = (product.images || []).map(img => ({ url: img.url, _id: img._id, blurDataURL: img.blurDataURL }));
            migrationLog.push({ upc, productId: product._id.toString(), productName: product.name, oldImages, newFile: filename, timestamp: new Date().toISOString() });

            if (DRY_RUN) continue;

            const photoPath = subdir ? path.join(PHOTOS_DIR, subdir, filename) : path.join(PHOTOS_DIR, filename);
            const stat = fs.statSync(photoPath);
            if (stat.size === 0) {
                console.log(`   Empty file, skipping: ${filename}`);
                results.errors.push({ upc, error: 'Empty file' });
                continue;
            }

            const tempPath = path.join(PHOTOS_DIR, `_temp_${filename}`);
            fs.copyFileSync(photoPath, tempPath);

            try {
                console.log(`   Uploading to Cloudinary...`);
                const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

                for (const oldImg of oldImages) {
                    if (oldImg._id) await deleteOldImage(oldImg._id);
                }

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

                console.log(`   Updated! New URL: ${uploadResult.url}`);
                results.uploaded.push({ upc, productName: product.name, newUrl: uploadResult.url });
            } catch (uploadErr) {
                console.error(`   Upload failed: ${uploadErr.message}`);
                results.errors.push({ upc, productName: product.name, error: uploadErr.message });
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) { }
            }

            await sleep(DELAY_MS);
        } catch (err) {
            console.error(`${progress} Error processing ${upc}: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }
    }

    fs.writeFileSync(LOG_FILE, JSON.stringify(migrationLog, null, 2), 'utf-8');
    console.log(`\nMigration log saved to: ${LOG_FILE}`);

    console.log('\n' + '='.repeat(60));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Total photos:           ${total}`);
    console.log(`  Matched to products:    ${results.matched.length}`);
    console.log(`  No match (orphans):     ${results.noMatch.length}`);
    if (!DRY_RUN) {
        console.log(`  Successfully uploaded:  ${results.uploaded.length}`);
        console.log(`  Errors:                 ${results.errors.length}`);
    }
    console.log(`  Skipped files:          ${results.skipped.length}`);
    console.log('='.repeat(60));

    if (results.noMatch.length > 0) {
        console.log('\nUnmatched UPCs:');
        results.noMatch.forEach(item => console.log(`   - ${item.upc} (${item.filename})`));
    }

    if (results.errors.length > 0) {
        console.log('\nErrors:');
        results.errors.forEach(item => console.log(`   - ${item.upc}: ${item.error}`));
    }

    if (DRY_RUN) {
        console.log('\nDRY RUN complete. No changes were made.');
    }

    process.exit(0);
};

runMigration().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
