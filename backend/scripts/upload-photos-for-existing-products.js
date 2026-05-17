/**
 * upload-photos-for-existing-products.js
 *
 * Uploads whiskey photos from wiskey-photos/ to Cloudinary
 * for the 20 products that already exist in the DB but have no images.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const Product = require('../src/models/Product');
const cloudinaryService = require('../src/services/cloudinary.service');

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const PHOTOS_DIR = path.join(__dirname, '../wiskey-photos');
const TEMP_DIR = path.join(__dirname, '../temp-uploads');

const TARGET_UPCS = [
    '0040232379123',
    '0040232555442',
    '0051497363840',
    '0080686009955',
    '0081128000646',
    '0081128001872',
    '0081128002879',
    '0082000809791',
    '0085246503126',
    '0088076188365',
    '0088076190566',
    '0655709000303',
    '0810020890020',
    '0812066020300',
    '0814794011957',
    '0816136023413',
    '0850003347653',
    '0857186006025',
    '0858349004100',
    '0860009871007',
];

const ORPHAN_UPCS = [
    '0080686004424',
    '0080686007746',
    '0082184004371',
    '0085246503171',
    '08262802',
    '08269203',
    '08773502',
    '08773900',
    '08776509',
    '10055406',
];

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

async function run() {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`Connected — ${count} products\n`);

    // Ensure temp dir exists
    if (!fs.existsSync(TEMP_DIR)) {
        fs.mkdirSync(TEMP_DIR, { recursive: true });
    }

    const results = {
        uploaded: [],
        noPhoto: [],
        notFound: [],
        errors: [],
    };

    let processed = 0;
    const total = TARGET_UPCS.length;

    console.log(`${'='.repeat(60)}`);
    console.log(`UPLOADING PHOTOS FOR ${total} PRODUCTS`);
    console.log(`${'='.repeat(60)}\n`);

    for (const upc of TARGET_UPCS) {
        processed++;
        const stripped = stripLeadingZeros(upc);
        const progress = `[${processed}/${total}]`;

        try {
            const product = await Product.findOne({ code: stripped });
            if (!product) {
                console.log(`${progress} ❌ Product not found in DB: code=${stripped}`);
                results.notFound.push(upc);
                continue;
            }

            const photoPath = path.join(PHOTOS_DIR, `${upc}.jpg`);
            if (!fs.existsSync(photoPath)) {
                console.log(`${progress} ⚠️ Photo file not found: ${upc}.jpg`);
                results.noPhoto.push(upc);
                continue;
            }

            // Copy to temp so cloudinaryService doesn't delete the original
            const tempPath = path.join(TEMP_DIR, `temp_${upc}.jpg`);
            fs.copyFileSync(photoPath, tempPath);

            console.log(`${progress} 📤 Uploading ${upc}.jpg for "${product.name}"...`);
            const uploadResult = await cloudinaryService.uploadImage(tempPath, 'balport-products');

            // Update product
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

            console.log(`   ✅ Uploaded: ${uploadResult.url}`);
            results.uploaded.push({
                upc,
                productId: product._id.toString(),
                productName: product.name,
                url: uploadResult.url,
                publicId: uploadResult.public_id,
            });

            // Small delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 1000));

        } catch (err) {
            console.error(`${progress} ❌ Error for ${upc}: ${err.message}`);
            results.errors.push({ upc, error: err.message });
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`Photos uploaded:  ${results.uploaded.length}`);
    console.log(`No photo file:    ${results.noPhoto.length}`);
    console.log(`Product not found: ${results.notFound.length}`);
    console.log(`Errors:           ${results.errors.length}`);

    if (ORPHAN_UPCS.length > 0) {
        console.log(`\nOrphan UPCs (no data in DB or pricebook):`);
        ORPHAN_UPCS.forEach(u => console.log(`  - ${u}`));
    }

    // Save report
    const reportPath = path.join(__dirname, 'whiskey-photo-upload-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        uploaded: results.uploaded,
        noPhoto: results.noPhoto,
        notFound: results.notFound,
        errors: results.errors,
        orphans: ORPHAN_UPCS,
        timestamp: new Date().toISOString(),
    }, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    process.exit(0);
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
