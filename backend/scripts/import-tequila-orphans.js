const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const mongoose = require('mongoose');

// ─── Config ──────────────────────────────────────────────
const ORPHAN_FILE = path.join(__dirname, 'tequila-orphans-not-found.txt');
const PRICEBOOK_FILE = path.join(__dirname, '../../pricebook73825.csv');
const PHOTOS_DIR = path.join(__dirname, '../tequila-photos');
const DRY_RUN = process.argv.includes('--dry-run');

const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');
const cloudinary = require('../src/config/cloudinary');

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

function extractUPC(filename) {
    if (!filename.toLowerCase().endsWith('.jpg')) return null;
    if (filename.includes('(1)')) return null;
    const name = path.basename(filename).replace(/\.jpg$/i, '');
    if (name.includes('.') || name.includes('-') || name.includes('http')) return null;
    if (!/^\d+$/.test(name)) return null;
    return name;
}

async function deleteOldImage(publicId) {
    if (!publicId) return;
    try {
        await cloudinary.uploader.destroy(publicId);
        console.log(`    🗑️  Deleted old Cloudinary image: ${publicId}`);
    } catch (err) {
        console.log(`    ⚠️  Failed to delete old image ${publicId}: ${err.message}`);
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const DELAY_MS = 1500;

// ─── Load orphans ──────────────────────────────────────────
async function loadOrphans() {
    // If orphan file doesn't exist, extract from migration output
    let orphanUPCs = [];
    if (fs.existsSync(ORPHAN_FILE)) {
        orphanUPCs = fs.readFileSync(ORPHAN_FILE, 'utf-8').split('\n').filter(Boolean);
    }

    // Also scan photos dir for all valid UPCs and check which are NOT in DB
    const allPhotos = getAllJpgFiles(PHOTOS_DIR);
    const photoUPCs = new Set();
    for (const p of allPhotos) {
        const upc = extractUPC(p);
        if (upc) photoUPCs.add(upc);
    }

    console.log(`📁 Photo UPCs total: ${photoUPCs.size}`);
    console.log(`📄 Orphan list from file: ${orphanUPCs.length}`);

    return { orphanUPCs, photoUPCs: Array.from(photoUPCs) };
}

// ─── Load pricebook ───────────────────────────────────────
async function loadPricebook(targetUPCs) {
    return new Promise((resolve, reject) => {
        const upcMap = new Map();
        const targetSet = new Set(targetUPCs);
        const strippedSet = new Map();
        for (const u of targetUPCs) {
            strippedSet.set(stripLeadingZeros(u), u);
        }

        let checked = 0;
        fs.createReadStream(PRICEBOOK_FILE)
            .pipe(csv())
            .on('data', (row) => {
                const rawUpc = row.Upc ? row.Upc.replace(/["=]/g, '') : '';
                if (!rawUpc || !/^\d+$/.test(rawUpc)) return;

                if (targetSet.has(rawUpc)) {
                    upcMap.set(rawUpc, row);
                    checked++;
                } else if (strippedSet.has(rawUpc)) {
                    const original = strippedSet.get(rawUpc);
                    upcMap.set(original, row);
                    checked++;
                }
            })
            .on('end', () => {
                console.log(`✅ Pricebook entries matched: ${upcMap.size} (checked ${checked})`);
                resolve(upcMap);
            })
            .on('error', reject);
    });
}

// ─── Find photo path for UPC ───────────────────────────────
function findPhotoPath(upc) {
    const allPhotos = getAllJpgFiles(PHOTOS_DIR);
    for (const p of allPhotos) {
        if (path.basename(p).replace(/\.jpg$/i, '') === upc) {
            return path.join(PHOTOS_DIR, p);
        }
    }
    return null;
}

// ─── Connect DB ────────────────────────────────────────────
const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`📡 Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`✅ MongoDB Connected — ${count} products`);
    if (count === 0) {
        console.error('❌ No products found!');
        process.exit(1);
    }
};

// ─── Main ──────────────────────────────────────────────────
const runImport = async () => {
    await connectDB();

    const { orphanUPCs, photoUPCs } = await loadOrphans();
    const pricebook = await loadPricebook(orphanUPCs.length > 0 ? orphanUPCs : photoUPCs);

    // Get products currently missing from DB
    const missingUPCs = [];
    for (const upc of (orphanUPCs.length > 0 ? orphanUPCs : photoUPCs)) {
        const stripped = stripLeadingZeros(upc);
        const exists = await Product.findOne({
            $or: [{ code: upc }, { code: stripped }, { sku: `BP-${stripped}` }, { sku: `BP-${upc}` }]
        });
        if (!exists) {
            missingUPCs.push(upc);
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(DRY_RUN ? '🔍 DRY RUN — No changes' : '🚀 LIVE — Will import + upload');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Orphan UPCs without products: ${missingUPCs.length}`);
    console.log(`Found in pricebook: ${pricebook.size}`);

    const results = { imported: 0, uploaded: 0, errors: [], noData: [] };
    let processed = 0;

    for (const upc of missingUPCs) {
        processed++;
        const progress = `[${processed}/${missingUPCs.length}]`;
        const row = pricebook.get(upc);

        if (!row) {
            console.log(`${progress} ❌ No pricebook data for UPC: ${upc}`);
            results.noData.push(upc);
            continue;
        }

        const name = row.Name || 'Unknown Product';
        const dept = row.Department || 'SPIRITS';
        const cents = parseInt(row.cents || '0', 10);
        const price = cents > 0 ? Math.round(cents / 100) : 0;
        const priceSale = price;
        const size = row.size || '';
        const fullName = size ? `${name} (${size})` : name;

        console.log(`${progress} 📦 ${upc} → "${fullName}" (${dept}) $${price}`);

        if (DRY_RUN) {
            results.imported++;
            continue;
        }

        // Generate slug
        let slug = fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        // Ensure unique slug
        let suffix = '';
        let counter = 1;
        while (await Product.findOne({ slug: slug + suffix })) {
            suffix = `-${counter}`;
            counter++;
        }
        slug += suffix;

        try {
            // Create product
            const product = new Product({
                name: fullName,
                sku: `BP-${stripLeadingZeros(upc)}`,
                slug,
                code: stripLeadingZeros(upc),
                price,
                priceSale,
                description: row.Descreptions || '',
                category: null, // Will need manual assignment
                images: [],
                status: 'active',
                brand: row.Brand || '',
            });
            await product.save();
            results.imported++;
            console.log(`   ✅ Created product: ${product._id}`);

            // Upload photo
            const photoPath = findPhotoPath(upc);
            if (photoPath && fs.existsSync(photoPath)) {
                const tempPath = path.join(PHOTOS_DIR, `_temp_${path.basename(photoPath)}`);
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
                    console.log(`   ✅ Photo uploaded: ${uploadResult.url}`);
                } catch (uploadErr) {
                    console.error(`   ❌ Upload failed: ${uploadErr.message}`);
                    results.errors.push({ upc, error: uploadErr.message });
                }

                await sleep(DELAY_MS);
            } else {
                console.log(`   ⚠️  No photo file found for ${upc}`);
            }

        } catch (err) {
            console.error(`${progress} ❌ Error: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 IMPORT SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total orphans:        ${missingUPCs.length}`);
    console.log(`  With pricebook data:    ${missingUPCs.length - results.noData.length}`);
    console.log(`  Imported:               ${results.imported}`);
    console.log(`  Photos uploaded:        ${results.uploaded}`);
    console.log(`  Errors:                 ${results.errors.length}`);
    console.log(`  No pricebook data:      ${results.noData.length}`);
    console.log(`${'═'.repeat(60)}`);

    if (results.noData.length > 0) {
        console.log('\n📝 No pricebook data for these UPCs:');
        results.noData.forEach(u => console.log(`   - ${u}`));
    }

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
