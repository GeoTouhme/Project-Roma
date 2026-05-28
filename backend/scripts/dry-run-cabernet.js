require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Product = require('../src/models/Product');

const PHOTOS_DIR = path.join(__dirname, '../cabernet-photos');

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

async function connectDB() {
    const uri = 'mongodb://127.0.0.1:27017/liquor_shop';
    await mongoose.connect(uri);
    console.log(`Connected — ${await Product.countDocuments()} products\n`);
}

async function run() {
    await connectDB();

    const files = fs.readdirSync(PHOTOS_DIR).filter(f => f.endsWith('.jpg') || f.endsWith('.png') || f.endsWith('.webp'));
    const validFiles = files.filter(f => !f.includes('(1)') && /^\d+/.test(f));
    const skipped = files.length - validFiles.length;

    console.log(`Total files: ${files.length}`);
    console.log(`Valid (numeric UPC): ${validFiles.length}`);
    console.log(`Skipped (duplicates/non-numeric): ${skipped}\n`);

    let matched = 0;
    let orphan = 0;
    const orphans = [];

    for (const file of validFiles) {
        const upc = stripLeadingZeros(path.basename(file, path.extname(file)));
        const product = await Product.findOne({ code: upc }).lean();
        if (product) {
            matched++;
        } else {
            orphan++;
            orphans.push({ file, upc });
        }
    }

    console.log(`Matched existing products: ${matched}`);
    console.log(`Orphan photos (no DB match): ${orphan}\n`);

    if (orphans.length > 0) {
        console.log('Orphan UPCs:');
        for (const o of orphans) console.log(`  ${o.file} (UPC: ${o.upc})`);
    }

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
