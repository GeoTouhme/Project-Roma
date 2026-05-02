/**
 * replace-whiskey-photos.js
 * 
 * Replaces product photos in the database with new photos from the wiskey-photos directory.
 * Matches photos by UPC code (filename) to Product.code field.
 * 
 * Usage:
 *   node scripts/replace-whiskey-photos.js --dry-run    # Preview matches only, no changes
 *   node scripts/replace-whiskey-photos.js              # Execute the migration
 * 
 * Server paths:
 *   Photos: /usr/src/app/wiskey-photos/
 *   Script: /usr/src/app/scripts/replace-whiskey-photos.js
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Load env
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set.');
}

const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');
const cloudinary = require('../src/config/cloudinary');

// ─── Configuration ───────────────────────────────────────────────
const PHOTOS_DIR = path.join(__dirname, '../wiskey-photos');
const LOG_FILE = path.join(__dirname, 'whiskey-photo-migration-log.json');
const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 1500; // Delay between uploads to avoid rate limiting

// ─── Helpers ─────────────────────────────────────────────────────

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extract UPC code from filename, skipping invalid files.
 * Returns null for files that should be skipped.
 */
function extractUPC(filename) {
    // Skip non-jpg files
    if (!filename.toLowerCase().endsWith('.jpg')) return null;

    // Skip duplicate files (those with "(1)" suffix)
    if (filename.includes('(1)')) return null;

    // Get name without extension
    const name = filename.replace(/\.jpg$/i, '');

    // Skip non-UPC filenames (like URLs)
    if (name.includes('.') || name.includes('-') || name.includes('http')) return null;

    // Must be numeric
    if (!/^\d+$/.test(name)) return null;

    return name;
}

/**
 * Try to find a product by UPC code.
 * Attempts exact match first, then tries zero-padded variants for short codes.
 */
async function findProductByUPC(upc) {
    // Try exact match first
    let product = await Product.findOne({ code: upc });
    if (product) return product;

    // For short codes (< 13 digits), try zero-padding to 13 digits
    if (upc.length < 13) {
        const padded = upc.padStart(13, '0');
        product = await Product.findOne({ code: padded });
        if (product) return product;
    }

    // Try matching via SKU field (BP-PRO-{UPC})
    product = await Product.findOne({ sku: `BP-PRO-${upc}` });
    if (product) return product;

    // Try padded SKU
    if (upc.length < 13) {
        const padded = upc.padStart(13, '0');
        product = await Product.findOne({ sku: `BP-PRO-${padded}` });
        if (product) return product;
    }

    return null;
}

/**
 * Delete old Cloudinary image safely
 */
async function deleteOldImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`    🗑️  Deleted old Cloudinary image: ${publicId}`);
    } catch (err) {
        console.log(`    ⚠️  Failed to delete old image ${publicId}: ${err.message}`);
    }
}

// ─── Database Connection ─────────────────────────────────────────

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/liquor_shop';
        await mongoose.connect(uri);
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

// ─── Main Migration ──────────────────────────────────────────────

const runMigration = async () => {
    await connectDB();

    console.log('\n' + '═'.repeat(60));
    console.log(DRY_RUN ? '🔍 DRY RUN MODE — No changes will be made' : '🚀 LIVE MODE — Photos will be replaced');
    console.log('═'.repeat(60));

    // Verify photos directory exists
    if (!fs.existsSync(PHOTOS_DIR)) {
        console.error(`\n❌ Photos directory not found: ${PHOTOS_DIR}`);
        console.error('   Please copy photos to this location first.');
        console.error('   Example: docker cp /tmp/wiskey-photos/ balport-backend:/usr/src/app/wiskey-photos/');
        process.exit(1);
    }

    // Read all photo files
    const allFiles = fs.readdirSync(PHOTOS_DIR);
    console.log(`\n📁 Found ${allFiles.length} files in ${PHOTOS_DIR}`);

    // Extract valid UPCs
    const photoMap = new Map(); // UPC -> filename
    const skippedFiles = [];

    for (const file of allFiles) {
        const upc = extractUPC(file);
        if (upc) {
            photoMap.set(upc, file);
        } else {
            skippedFiles.push(file);
        }
    }

    console.log(`✅ Valid UPC photos: ${photoMap.size}`);
    if (skippedFiles.length > 0) {
        console.log(`⏭️  Skipped files: ${skippedFiles.length}`);
        skippedFiles.forEach(f => console.log(`   - ${f}`));
    }

    // Process each photo
    const results = {
        matched: [],
        noMatch: [],
        uploaded: [],
        errors: [],
        skipped: skippedFiles,
    };

    const migrationLog = []; // Detailed log for recovery
    let processed = 0;
    const total = photoMap.size;

    console.log(`\n${'─'.repeat(60)}`);
    console.log('Processing photos...\n');

    for (const [upc, filename] of photoMap) {
        processed++;
        const progress = `[${processed}/${total}]`;

        try {
            const product = await findProductByUPC(upc);

            if (!product) {
                console.log(`${progress} ❌ No match for UPC: ${upc}`);
                results.noMatch.push({ upc, filename });
                continue;
            }

            console.log(`${progress} ✅ Match: ${upc} → "${product.name}"`);
            results.matched.push({
                upc,
                filename,
                productId: product._id.toString(),
                productName: product.name,
                productSku: product.sku,
            });

            // Log old images for recovery
            const oldImages = (product.images || []).map(img => ({
                url: img.url,
                _id: img._id,
                blurDataURL: img.blurDataURL,
            }));

            migrationLog.push({
                upc,
                productId: product._id.toString(),
                productName: product.name,
                oldImages,
                newFile: filename,
                timestamp: new Date().toISOString(),
            });

            if (DRY_RUN) continue;

            // ── LIVE: Upload new photo ──
            const photoPath = path.join(PHOTOS_DIR, filename);

            // Verify file exists and has content
            const stat = fs.statSync(photoPath);
            if (stat.size === 0) {
                console.log(`   ⚠️  Empty file, skipping: ${filename}`);
                results.errors.push({ upc, error: 'Empty file' });
                continue;
            }

            // Upload to Cloudinary (the service auto-deletes the local file, 
            // so we need to copy it first to preserve the original)
            const tempPath = path.join(PHOTOS_DIR, `_temp_${filename}`);
            fs.copyFileSync(photoPath, tempPath);

            try {
                console.log(`   📤 Uploading to Cloudinary...`);
                const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

                // Delete old Cloudinary images
                for (const oldImg of oldImages) {
                    if (oldImg._id) {
                        await deleteOldImage(oldImg._id);
                    }
                }

                // Update product in DB
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

                console.log(`   ✅ Updated! New URL: ${uploadResult.url}`);
                results.uploaded.push({ upc, productName: product.name, newUrl: uploadResult.url });

            } catch (uploadErr) {
                console.error(`   ❌ Upload failed: ${uploadErr.message}`);
                results.errors.push({ upc, productName: product.name, error: uploadErr.message });

                // Clean up temp file if it still exists
                try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch (e) {}
            }

            // Delay to avoid Cloudinary rate limiting
            await sleep(DELAY_MS);

        } catch (err) {
            console.error(`${progress} ❌ Error processing ${upc}: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }
    }

    // ── Save migration log ──
    fs.writeFileSync(LOG_FILE, JSON.stringify(migrationLog, null, 2), 'utf-8');
    console.log(`\n📋 Migration log saved to: ${LOG_FILE}`);

    // ── Print Summary ──
    console.log('\n' + '═'.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('═'.repeat(60));
    console.log(`  Total photos:           ${total}`);
    console.log(`  Matched to products:    ${results.matched.length}`);
    console.log(`  No match (orphans):     ${results.noMatch.length}`);
    if (!DRY_RUN) {
        console.log(`  Successfully uploaded:  ${results.uploaded.length}`);
        console.log(`  Errors:                 ${results.errors.length}`);
    }
    console.log(`  Skipped files:          ${results.skipped.length}`);
    console.log('═'.repeat(60));

    if (results.noMatch.length > 0) {
        console.log('\n📝 Unmatched UPCs (no product found):');
        results.noMatch.forEach(item => {
            console.log(`   - ${item.upc} (${item.filename})`);
        });
    }

    if (results.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        results.errors.forEach(item => {
            console.log(`   - ${item.upc}: ${item.error}`);
        });
    }

    if (DRY_RUN) {
        console.log('\n🔍 This was a DRY RUN. No changes were made.');
        console.log('   Run without --dry-run to execute the migration.');
    }

    process.exit(0);
};

// ── Run ──
runMigration().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
