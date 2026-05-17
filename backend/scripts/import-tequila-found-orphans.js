const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DRY_RUN = process.argv.includes('--dry-run');

const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');
const cloudinary = require('../src/config/cloudinary');

// ─── Config ──────────────────────────────────────────────
const FOUND_FILE = path.join(__dirname, 'tequila-orphans-found.json');
const PHOTOS_DIR = path.join(__dirname, '../tequila-photos');
const DELAY_MS = 1500;

// ─── Helpers ───────────────────────────────────────────────
function stripLeadingZeros(str) {
    const stripped = str.replace(/^0+/, '');
    return stripped || '0';
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
    for (const p of allPhotos) {
        if (path.basename(p).replace(/\.jpg$/i, '') === upc) {
            return path.join(PHOTOS_DIR, p);
        }
    }
    return null;
}

async function deleteOldImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) { /* ignore */ }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Connect DB ────────────────────────────────────────────
const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`📡 Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`✅ MongoDB Connected — ${count} products`);
};

// ─── Main ──────────────────────────────────────────────────
const runImport = async () => {
    await connectDB();

    if (!fs.existsSync(FOUND_FILE)) {
        console.error('❌ Found file not found:', FOUND_FILE);
        process.exit(1);
    }

    const foundData = JSON.parse(fs.readFileSync(FOUND_FILE, 'utf-8'));
    const upcs = Object.keys(foundData);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(DRY_RUN ? '🔍 DRY RUN — No changes' : '🚀 LIVE — Importing + uploading');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Products to import: ${upcs.length}`);

    const results = { imported: 0, uploaded: 0, errors: [], skipped: [] };
    let processed = 0;

    for (const upc of upcs) {
        processed++;
        const progress = `[${processed}/${upcs.length}]`;
        const row = foundData[upc];

        // Skip if already exists
        const stripped = stripLeadingZeros(upc);
        const exists = await Product.findOne({
            $or: [{ code: upc }, { code: stripped }, { sku: `BP-${stripped}` }]
        });
        if (exists) {
            console.log(`${progress} ⏭️  Already exists: ${upc} → "${exists.name}"`);
            results.skipped.push(upc);
            continue;
        }

        const name = row.Name || 'Unknown Product';
        const dept = row.Department || 'SPIRITS';
        const cents = parseInt(row.cents || '0', 10);
        const price = cents > 0 ? Math.round(cents / 100) : 0;
        const size = row.size || '';
        const fullName = size ? `${name} (${size})` : name;

        console.log(`${progress} 📦 ${upc} → "${fullName}" (${dept}) $${price}`);

        // Map department to category
        const deptLower = (dept || '').toLowerCase();
        let categoryId;
        if (deptLower.includes('tequila')) {
            categoryId = '69bc40b76f0fa539b06ef96a'; // TEQUILA
        } else if (deptLower.includes('cocktail') || deptLower.includes('soju') || deptLower.includes('spirit')) {
            categoryId = '69bd4c23013d204dfbd805e3'; // COCKTAILS & SELTZERS
        } else if (deptLower.includes('electrolit')) {
            categoryId = '69bc5e626f0fa539b06f083d'; // NONALCOHOL
        } else {
            categoryId = '69bc40b76f0fa539b06ef96a'; // default TEQUILA
        }

        if (DRY_RUN) {
            results.imported++;
            continue;
        }

        // Generate unique slug
        let slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        let suffix = '';
        let counter = 1;
        while (await Product.findOne({ slug: slug + suffix })) {
            suffix = `-${counter}`;
            counter++;
        }
        slug += suffix;

        try {
            const product = new Product({
                name: fullName,
                sku: `BP-${stripped}`,
                slug,
                code: stripped,
                price,
                priceSale: price,
                description: row.Descreptions || '',
                category: categoryId,
                available: 100,
                sold: 0,
                images: [],
                status: 'active',
            });
            await product.save();
            results.imported++;
            console.log(`   ✅ Created: ${product._id}`);

            // Upload photo
            const photoPath = findPhotoPath(upc);
            if (photoPath && fs.existsSync(photoPath)) {
                const tempPath = path.join(PHOTOS_DIR, `_temp_import_${path.basename(photoPath)}`);
                fs.copyFileSync(photoPath, tempPath);

                try {
                    console.log(`   📤 Uploading photo...`);
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
                    console.log(`   ✅ Photo: ${uploadResult.url}`);
                } catch (uploadErr) {
                    console.error(`   ❌ Upload failed: ${uploadErr.message}`);
                    results.errors.push({ upc, error: uploadErr.message });
                }

                await sleep(DELAY_MS);
            } else {
                console.log(`   ⚠️  No photo file for ${upc}`);
            }

        } catch (err) {
            console.error(`${progress} ❌ Error: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 IMPORT SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total to import:     ${upcs.length}`);
    console.log(`  Already existed:       ${results.skipped.length}`);
    console.log(`  Imported:              ${results.imported}`);
    console.log(`  Photos uploaded:       ${results.uploaded}`);
    console.log(`  Errors:                ${results.errors.length}`);
    console.log(`${'═'.repeat(60)}`);

    if (results.errors.length > 0) {
        console.log('\n⚠️  Errors:');
        results.errors.forEach(e => console.log(`   - ${e.upc}: ${e.error}`));
    }

    if (DRY_RUN) {
        console.log('\n🔍 This was a DRY RUN. No changes were made.');
    }

    process.exit(0);
};

runImport().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
