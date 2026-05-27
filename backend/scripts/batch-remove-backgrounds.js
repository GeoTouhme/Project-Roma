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
 *   node scripts/batch-remove-backgrounds.js --dry-run --categories=whiskey,tequila
 *   node scripts/batch-remove-backgrounds.js --categories=all --limit=50
 *   node scripts/batch-remove-backgrounds.js --resume
 *   node scripts/batch-remove-backgrounds.js
 *
 * Requires:
 *   - backend/venv-rembg (Python venv with rembg + Pillow)
 *   - MongoDB env var MONGODB_URI set (or default localhost)
 *   - Cloudinary env vars set
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const axios = require('axios');

// Load env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const cloudinary = require('../src/config/cloudinary');
const getBlurDataURL = require('../src/config/getBlurDataURL');

// ─── CLI args ────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const RESUME = process.argv.includes('--resume');

const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

const CATEGORIES_ARG = process.argv.find(arg => arg.startsWith('--categories='));
const CATEGORIES = CATEGORIES_ARG ? CATEGORIES_ARG.split('=')[1].split(',') : ['whiskey', 'tequila'];

// ─── Configuration ───────────────────────────────────────────────
const PYTHON = path.join(__dirname, '../venv-rembg/bin/python');
const BG_SCRIPT = path.join(__dirname, 'remove-bg-white.py');
const TMP_DIR = path.join(__dirname, '../temp-uploads');
const LOG_PATH = path.join(__dirname, 'batch-bg-removal-log.jsonl');
const DELAY_MS = 0;

// ─── Helpers ─────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function downloadImage(url, dest) {
    const res = await axios.get(url, {
        responseType: 'stream',
        maxRedirects: 5,
        timeout: 30_000,
    });
    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        res.data.pipe(file);
        file.on('finish', resolve);
        file.on('error', reject);
    });

    // Validate size
    const { size } = fs.statSync(dest);
    if (size < 1024) throw new Error(`Suspiciously small download (${size} bytes)`);
}

async function overwriteCloudinary(filePath, publicId) {
    const result = await cloudinary.uploader.upload(filePath, {
        public_id: publicId,
        overwrite: true,
        backup: true,
        resource_type: 'image',
    });
    const blurDataURL = await getBlurDataURL(result.secure_url);
    return {
        url: result.secure_url,
        public_id: result.public_id,
        blurDataURL,
    };
}

function resolvePublicId(img) {
    if (img.public_id) return img.public_id;
    if (typeof img._id === 'string' && img._id.includes('/')) return img._id;
    return null;
}

function loadSuccessPublicIds() {
    if (!fs.existsSync(LOG_PATH)) return new Set();
    const ids = new Set();
    const lines = fs.readFileSync(LOG_PATH, 'utf-8').split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.status === 'success' && entry.publicId) {
                ids.add(entry.publicId);
            }
        } catch (_) {}
    }
    return ids;
}

// ─── Python worker ───────────────────────────────────────────────

function startPythonWorker() {
    const child = spawn(PYTHON, [BG_SCRIPT, '--worker'], {
        stdio: ['pipe', 'pipe', 'inherit'],
    });

    const pending = new Map();
    let seq = 0;

    const reader = require('readline').createInterface({
        input: child.stdout,
        crlfDelay: Infinity,
    });

    reader.on('line', (line) => {
        const [status, payload] = line.split('\t');
        if (status === 'OK' || status === 'ERR') {
            const cb = pending.get(payload);
            if (cb) {
                pending.delete(payload);
                cb(status === 'OK' ? null : new Error(payload));
            }
        }
    });

    return {
        async removeBackground(inputPath, outputPath) {
            const p = new Promise((resolve, reject) => {
                pending.set(outputPath, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            child.stdin.write(`${inputPath}\t${outputPath}\n`);
            return p;
        },
        close() {
            child.stdin.end();
            return new Promise((resolve) => child.on('close', resolve));
        },
    };
}

// ─── Main ────────────────────────────────────────────────────────

async function run() {
    if (!fs.existsSync(PYTHON)) {
        console.error(`❌ Python venv not found at ${PYTHON}`);
        console.error('   Run: cd backend && python3 -m venv venv-rembg && source venv-rembg/bin/activate && pip install rembg pillow');
        process.exit(1);
    }

    if (!fs.existsSync(BG_SCRIPT)) {
        console.error(`❌ Python script not found at ${BG_SCRIPT}`);
        process.exit(1);
    }

    ensureDir(TMP_DIR);

    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
    console.log(`📡 Connecting to MongoDB...`);
    await mongoose.connect(uri);
    const totalProducts = await Product.countDocuments();
    console.log(`✅ Connected — ${totalProducts} products total\n`);

    // Resolve categories
    const categoryNames = CATEGORIES.map(c => c.toLowerCase().trim());
    const isAll = categoryNames.includes('all');

    let targetIds = [];
    if (isAll) {
        const allCats = await Category.find({}).lean();
        targetIds = allCats.map(c => c._id.toString());
        console.log(`🔍 Processing ALL categories (${targetIds.length} categories)`);
    } else {
        for (const name of categoryNames) {
            const cat = await Category.findOne({ name: new RegExp(name, 'i') }).lean();
            if (cat) {
                targetIds.push(cat._id.toString());
                console.log(`🔍 Found category: ${cat.name}`);
            } else {
                console.log(`⚠️ Category not found: ${name}`);
            }
        }
    }

    if (targetIds.length === 0) {
        console.error('❌ No matching categories found. Exiting.');
        process.exit(1);
    }

    const products = await Product.find({
        images: { $exists: true, $ne: [] },
        category: { $in: targetIds.map(id => new mongoose.Types.ObjectId(id)) },
    }).lean();

    const tasks = [];
    for (const p of products) {
        for (let i = 0; i < p.images.length; i++) {
            const img = p.images[i];
            if (!img || !img.url) continue;
            const publicId = resolvePublicId(img);
            tasks.push({
                productId: p._id.toString(),
                productName: p.name,
                imageIndex: i,
                url: img.url,
                publicId,
            });
        }
    }

    const successIds = RESUME ? loadSuccessPublicIds() : new Set();
    const filteredTasks = tasks.filter(t => !successIds.has(t.publicId));
    const skippedResume = tasks.length - filteredTasks.length;

    console.log(`🔍 Found ${tasks.length} images across ${products.length} products`);
    if (skippedResume > 0) console.log(`⏭️  Skipped ${skippedResume} already processed (resume)`);

    let finalTasks = filteredTasks;
    if (LIMIT && finalTasks.length > LIMIT) {
        finalTasks = finalTasks.slice(0, LIMIT);
        console.log(`⏹️  Limited to first ${LIMIT} images for testing\n`);
    }

    if (DRY_RUN) {
        console.log('\n🔍 DRY RUN — no changes will be made.\n');
        console.log('First 5 tasks:');
        finalTasks.slice(0, 5).forEach((t) => console.log(`   - ${t.productName}: ${t.publicId || '(no public_id)'}`));
        process.exit(0);
    }

    console.log(`\n🚀 Starting batch background removal (${finalTasks.length} images)...\n`);

    // Start persistent Python worker
    const worker = startPythonWorker();

    // Open append-only log stream
    const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' });

    const results = { success: 0, errors: 0, skippedNoPublicId: 0 };

    for (let idx = 0; idx < finalTasks.length; idx++) {
        const task = finalTasks[idx];
        const label = `[${idx + 1}/${finalTasks.length}]`;
        const rawPath = path.join(TMP_DIR, `${task.publicId ? task.publicId.replace(/\//g, '_') : 'no_id'}_raw.jpg`);
        const cleanPath = path.join(TMP_DIR, `${task.publicId ? task.publicId.replace(/\//g, '_') : 'no_id'}_clean.jpg`);

        try {
            if (!task.publicId) {
                console.log(`${label} ⚠️ Skipping (no public_id): ${task.productName}`);
                results.skippedNoPublicId++;
                continue;
            }

            console.log(`${label} 📥 ${task.publicId}`);

            // Download original
            await downloadImage(task.url, rawPath);

            // Remove background via persistent worker
            await worker.removeBackground(rawPath, cleanPath);

            // Re-upload overwriting existing
            const uploaded = await overwriteCloudinary(cleanPath, task.publicId);

            // Update DB
            await Product.updateOne(
                { _id: task.productId },
                {
                    $set: {
                        [`images.${task.imageIndex}.url`]: uploaded.url,
                        [`images.${task.imageIndex}.public_id`]: uploaded.public_id,
                        [`images.${task.imageIndex}.blurDataURL`]: uploaded.blurDataURL,
                    },
                }
            );

            console.log(`   ✅ Replaced`);
            results.success++;

            const logEntry = {
                productId: task.productId,
                publicId: task.publicId,
                status: 'success',
                newUrl: uploaded.url,
                timestamp: new Date().toISOString(),
            };
            logStream.write(JSON.stringify(logEntry) + '\n');
        } catch (err) {
            console.error(`   ❌ Error: ${err.message}`);
            results.errors++;

            const logEntry = {
                productId: task.productId,
                publicId: task.publicId,
                status: 'error',
                error: err.message,
                timestamp: new Date().toISOString(),
            };
            logStream.write(JSON.stringify(logEntry) + '\n');
        } finally {
            // Cleanup temp files
            try {
                if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
                if (fs.existsSync(cleanPath)) fs.unlinkSync(cleanPath);
            } catch (_) {}
        }

        if (DELAY_MS > 0) await sleep(DELAY_MS);
    }

    // Close log stream and worker
    logStream.end();
    await worker.close();

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 SUMMARY');
    console.log(`${'═'.repeat(60)}`);
    console.log(`  Total images:        ${finalTasks.length}`);
    console.log(`  Successful:          ${results.success}`);
    console.log(`  Errors:              ${results.errors}`);
    console.log(`  Skipped (no pub id): ${results.skippedNoPublicId}`);
    if (skippedResume > 0) console.log(`  Skipped (resume):    ${skippedResume}`);
    console.log(`${'═'.repeat(60)}`);
    console.log(`\n📋 Log saved to: ${LOG_PATH}`);

    process.exit(results.errors > 0 ? 1 : 0);
}

run().catch((err) => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});
