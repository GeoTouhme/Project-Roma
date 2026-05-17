/**
 * batch-remove-backgrounds.js
 *
 * Batch processes all product photos: downloads from Cloudinary,
 * removes background, adds pure white background, re-uploads to
 * Cloudinary (overwriting the original), and updates blurDataURL.
 *
 * Uses local rembg (Python) — no per-image cost.
 *
 * Usage:
 *   node scripts/batch-remove-backgrounds.js --dry-run   # preview counts
 *   node scripts/batch-remove-backgrounds.js             # execute
 *
 * Requires:
 *   - backend/venv-rembg (Python venv with rembg + Pillow)
 *   - MongoDB running locally
 *   - Cloudinary env vars set
 */

const path = require('path');
const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');
const mongoose = require('mongoose');

// Load env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const cloudinary = require('../src/config/cloudinary');
const getBlurDataURL = require('../src/config/getBlurDataURL');

// ─── Configuration ───────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;
const PYTHON = path.join(__dirname, '../venv-rembg/bin/python');
const BG_SCRIPT = path.join(__dirname, 'remove-bg-white.py');
const TMP_DIR = path.join(__dirname, '../temp-uploads');
const DELAY_MS = 800; // small delay between uploads

// ─── Helpers ─────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadImage(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https
            .get(url, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(`HTTP ${res.statusCode}`));
                    return;
                }
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(dest);
                });
            })
            .on('error', reject);
    });
}

function removeBackground(inputPath, outputPath) {
    const cmd = `${PYTHON} "${BG_SCRIPT}" "${inputPath}" "${outputPath}"`;
    execSync(cmd, { stdio: 'pipe' });
}

async function overwriteCloudinary(filePath, publicId) {
    const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        overwrite: true,
        resource_type: 'image',
    });
    const blurDataURL = await getBlurDataURL(result.secure_url);
    return {
        url: result.secure_url,
        public_id: result.public_id,
        blurDataURL,
    };
}

// ─── Main ────────────────────────────────────────────────────────

async function run() {
    // Verify Python env exists
    if (!fs.existsSync(PYTHON)) {
        console.error(`❌ Python venv not found at ${PYTHON}`);
        console.error('   Run: cd backend && python3 -m venv venv-rembg && source venv-rembg/bin/activate && pip install rembg pillow');
        process.exit(1);
    }

    // Verify Python script exists
    if (!fs.existsSync(BG_SCRIPT)) {
        console.error(`❌ Python script not found at ${BG_SCRIPT}`);
        process.exit(1);
    }

    ensureDir(TMP_DIR);

    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(uri);
    const totalProducts = await Product.countDocuments();
    console.log(`✅ Connected — ${totalProducts} products total\n`);

    // Gather only WHISKEY + TEQUILA category images
    const whiskeyCat = await Category.findOne({ name: /whiskey/i }).lean();
    const tequilaCat = await Category.findOne({ name: /tequila/i }).lean();
    const targetIds = [];
    if (whiskeyCat) targetIds.push(whiskeyCat._id.toString());
    if (tequilaCat) targetIds.push(tequilaCat._id.toString());

    const products = await Product.find({
        images: { $exists: true, $ne: [] },
        category: { $in: targetIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).lean();

    const tasks = [];
    for (const p of products) {
        for (let i = 0; i < p.images.length; i++) {
            const img = p.images[i];
            if (!img || !img.url) continue;
            tasks.push({
                productId: p._id.toString(),
                productName: p.name,
                imageIndex: i,
                url: img.url,
                publicId: img._id || img.public_id,
            });
        }
    }

    const catLabel = [whiskeyCat?.name, tequilaCat?.name].filter(Boolean).join(' + ');
    console.log(`🔍 Found ${tasks.length} images in ${catLabel} across ${products.length} products`);

    if (LIMIT && tasks.length > LIMIT) {
        tasks.length = LIMIT;
        console.log(`⏹️  Limited to first ${LIMIT} images for testing\n`);
    }

    if (DRY_RUN) {
        console.log('\n🔍 DRY RUN — no changes will be made.\n');
        console.log('First 5 tasks:');
        tasks.slice(0, 5).forEach((t) => console.log(`   - ${t.productName}: ${t.publicId}`));
        process.exit(0);
    }

    console.log(`\n🚀 Starting batch background removal...\n`);

    const results = { success: 0, errors: 0, skippedNoPublicId: 0 };
    const log = [];

    for (let idx = 0; idx < tasks.length; idx++) {
        const task = tasks[idx];
        const label = `[${idx + 1}/${tasks.length}]`;

        try {
            if (!task.publicId) {
                console.log(`${label} ⚠️ Skipping (no public_id): ${task.productName}`);
                results.skippedNoPublicId++;
                continue;
            }

            console.log(`${label} 📥 ${task.publicId}`);

            const rawPath = path.join(TMP_DIR, `${task.publicId.replace(/\//g, '_')}_raw.jpg`);
            const cleanPath = path.join(TMP_DIR, `${task.publicId.replace(/\//g, '_')}_clean.jpg`);

            // Download original
            await downloadImage(task.url, rawPath);

            // Remove background + white via Python
            removeBackground(rawPath, cleanPath);

            // Re-upload overwriting existing
            const uploaded = await overwriteCloudinary(cleanPath, task.publicId);

            // Update DB
            await Product.updateOne(
                { _id: task.productId },
                {
                    $set: {
                        [`images.${task.imageIndex}.url`]: uploaded.url,
                        [`images.${task.imageIndex}.blurDataURL`]: uploaded.blurDataURL,
                    },
                }
            );

            console.log(`   ✅ Replaced`);
            results.success++;
            log.push({ productId: task.productId, publicId: task.publicId, status: 'success', newUrl: uploaded.url });

            // Cleanup temp files
            try {
                fs.unlinkSync(rawPath);
                fs.unlinkSync(cleanPath);
            } catch (_) {}

            await sleep(DELAY_MS);
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
            results.errors++;
            log.push({ productId: task.productId, publicId: task.publicId, status: 'error', error: err.message });
        }
    }

    // Save log
    const logPath = path.join(__dirname, 'batch-bg-removal-log.json');
    fs.writeFileSync(logPath, JSON.stringify({ results, log, timestamp: new Date().toISOString() }, null, 2));

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total images:        ${tasks.length}`);
    console.log(`  Successful:          ${results.success}`);
    console.log(`  Errors:              ${results.errors}`);
    console.log(`  Skipped (no pub id): ${results.skippedNoPublicId}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n📋 Log saved to: ${logPath}`);

    process.exit(0);
}

run().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
