const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinaryService = require('../src/services/cloudinary.service');

// Try to load dotenv
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set.');
}

// Adjust module paths based on execution context
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');

const CSV_FILE_PATH = path.join(__dirname, 'inventory.csv');
const IMAGES_DIR = path.join(__dirname, '../downloaded_photos');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (error) {
        console.error('MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const parseCSV = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const data = [];

    // Skip header
    // Assuming Header: Category,Sub Category,Name,upc from pricebook,price from pricebook,Images,SKU,Description
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Start Naive CSV parser handling quoted fields
        const parts = [];
        let current = '';
        let inQuote = false;

        for (let char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        // End Naive CSV parser

        if (parts.length > 2) {
            data.push({
                category: parts[0],
                subCategory: parts[1],
                name: parts[2],
                upc: parts[3],
                price: parseFloat(parts[4].replace(/[^0-9.]/g, '')) || 0,
                // parts[5] is Images column (Drive URL), ignoring for now using local files
                sku: parts[6] || `SKU-${Date.now()}-${i}`, // Fallback if missing
                description: parts[7] || '',
            });
        }
    }
    return data;
};

const generateSlug = (name) => {
    return name
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
};

const seedProducts = async () => {
    await connectDB();

    try {
        console.log('Reading CSV...');
        if (!fs.existsSync(CSV_FILE_PATH)) {
            throw new Error(`CSV file not found at ${CSV_FILE_PATH}`);
        }

        const records = parseCSV(CSV_FILE_PATH);
        console.log(`Found ${records.length} records in CSV.`);

        // Pre-fetch Categories and SubCategories to minimize DB calls
        const allCategories = await Category.find({});
        const allSubCategories = await SubCategory.find({});

        const categoryMap = new Map(); // Name -> _id
        allCategories.forEach(c => categoryMap.set(c.name.toLowerCase(), c._id));

        const subCategoryMap = new Map(); // Name -> _id
        allSubCategories.forEach(s => subCategoryMap.set(s.name.toLowerCase(), s._id));

        let processedCount = 0;
        let createdCount = 0;
        let updatedCount = 0;

        for (const record of records) {
            try {
                // 1. Lookup Category & SubCategory
                const catId = categoryMap.get(record.category.toLowerCase());
                const subCatId = subCategoryMap.get(record.subCategory.toLowerCase());

                if (!catId || !subCatId) {
                    console.warn(`[WARN] Skipping "${record.name}": Category "${record.category}" or SubCategory "${record.subCategory}" not found.`);
                    continue;
                }

                // 2. Handle Image Upload
                // Construct expected filename: Replace spaces with underscores
                const imageFilename = record.name.replace(/ /g, '_') + '.jpg';
                const sourceImagePath = path.join(IMAGES_DIR, imageFilename);
                let productImages = [];

                if (fs.existsSync(sourceImagePath)) {
                    console.log(`  - Uploading image for: ${record.name}`);

                    // Copy to temp file to avoid Cloudinary service deleting the original
                    const tempImagePath = path.join(__dirname, `temp_${imageFilename}`);
                    fs.copyFileSync(sourceImagePath, tempImagePath);

                    const uploadResult = await cloudinaryService.uploadImage(tempImagePath, 'balport-products');

                    productImages.push({
                        url: uploadResult.url,
                        _id: uploadResult.public_id,
                        blurDataURL: uploadResult.blurDataURL
                    });
                } else {
                    console.warn(`  - [WARN] Image not found: ${imageFilename}`);
                    // Optional: Use a placeholder or skip? skipping for now.
                    // If updating, maybe we want to keep existing images? 
                    // For now, if no new image found, we won't overwrite images field unless it's a new product
                }

                // 3. Construct Product Data
                const productSlug = generateSlug(record.name);

                const productData = {
                    name: record.name,
                    slug: productSlug,
                    sku: record.sku,
                    code: record.upc,
                    price: record.price,
                    priceSale: record.price, // Defaulting sale price to regular price
                    available: 100, // Default stock
                    status: 'Active',
                    description: record.description,
                    category: catId,
                    subCategory: subCatId,
                    metaTitle: record.name,
                    metaDescription: record.description.substring(0, 160),
                };

                // Only update images if we successfully uploaded a new one
                if (productImages.length > 0) {
                    productData.images = productImages;
                }

                // 4. Upsert Product
                // Using SKU as the unique key
                const result = await Product.findOneAndUpdate(
                    { sku: record.sku },
                    productData,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                if (result.isNew) { // Mongoose doesn't have .isNew on findOneAndUpdate result directly usually, checking logic
                    // Actually findOneAndUpdate returns the document. We can't easily know if it was inserted or updated without 'includeResultMetadata' option in newer mongoose
                    // Simple logging:
                    // console.log(`  - Processed: ${record.name}`);
                }

                console.log(`Processed: ${record.name} (SKU: ${record.sku})`);
                processedCount++;

            } catch (err) {
                console.error(`[ERROR] Failed to process "${record.name}":`, err.message);
            }
        }

        console.log(`\nSeed Completed.`);
        console.log(`Total Records: ${records.length}`);
        console.log(`Successfully Processed: ${processedCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

seedProducts();
