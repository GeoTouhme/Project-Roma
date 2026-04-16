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

const OUTPUT_CSV = path.join(__dirname, 'product-pic-urls.csv');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const extractPicUrls = async () => {
    await connectDB();

    try {
        const products = await Product.find({}, 'name sku slug images').lean();
        console.log(`Found ${products.length} products in DB.`);

        const csvRows = ['product_name,sku,slug,image_index,image_url,cloudinary_id'];
        let totalImages = 0;
        let productsWithImages = 0;
        let productsWithoutImages = 0;

        for (const product of products) {
            if (product.images && product.images.length > 0) {
                productsWithImages++;
                product.images.forEach((img, idx) => {
                    // Escape commas in product name
                    const safeName = `"${(product.name || '').replace(/"/g, '""')}"`;
                    csvRows.push(
                        `${safeName},${product.sku || ''},${product.slug || ''},${idx + 1},${img.url || ''},${img._id || ''}`
                    );
                    totalImages++;
                });
            } else {
                productsWithoutImages++;
            }
        }

        // Write CSV
        fs.writeFileSync(OUTPUT_CSV, csvRows.join('\n'), 'utf-8');

        console.log(`\n--- Results ---`);
        console.log(`Total products:            ${products.length}`);
        console.log(`Products WITH images:      ${productsWithImages}`);
        console.log(`Products WITHOUT images:   ${productsWithoutImages}`);
        console.log(`Total image URLs extracted: ${totalImages}`);
        console.log(`\nOutput saved to: ${OUTPUT_CSV}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

extractPicUrls();
