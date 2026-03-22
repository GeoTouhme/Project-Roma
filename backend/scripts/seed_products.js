const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Setup environment and paths
const BACKEND_DIR = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
dotenv.config({ path: path.join(BACKEND_DIR, '.env.local') }); // In case they use .env.local

// Ensure we have models
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');

// Try to require CloudinaryService, handle errors securely
let CloudinaryService;
try {
    CloudinaryService = require('../src/services/cloudinary.service');
} catch (e) {
    console.warn("Could not load CloudinaryService. Seed will run, but uploads might fail if missing dependencies.");
}

// Configuration
const CSV_FILE_PATH = process.argv[2] || path.resolve(process.cwd(), 'UPC_Lookup_Only_Pro_Cleaned.csv');
const BASE_IMAGE_DIR = process.argv[3] || process.cwd(); // Assume running from project root
const MONGODB_URI = process.env.MONGODB_URI;

function slugify(text) {
    return text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// Simple fallback blurDataUrl
const DUMMY_BLUR = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

async function seedProducts() {
    if (!MONGODB_URI) {
        console.error("❌ ERROR: MONGODB_URI is not set in environment. Please provide it.");
        process.exit(1);
    }

    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`❌ ERROR: CSV file not found at ${CSV_FILE_PATH}`);
        process.exit(1);
    }

    console.log(`Connecting to MongoDB at: ${MONGODB_URI.split('@').pop()}...`);
    await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ Connected to MongoDB");

    // Cache to avoid hitting DB for every row
    const memoryCache = {
        categories: {},
        subCategories: {}
    };

    const csvData = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
    const lines = csvData.split('\n').filter(l => l.trim().length > 0);
    const headers = lines[0].split('\t').map(h => h.trim());

    console.log(`Found ${lines.length - 1} products to process in CSV.`);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row = {};
        for (let j = 0; j < headers.length; j++) {
            row[headers[j]] = values[j] ? values[j].trim() : '';
        }

        const upc = row['Upc'] || `UNKNOWN-SKU-${i}`;
        const name = row['Official_Name'] || row['Name'] || upc;
        const priceStr = (row['price $'] || '0').replace('$', '');
        const price = parseFloat(priceStr) || 0;
        const department = row['Department'] || 'Uncategorized';
        const description = row['Descreptions'] || row['Description'] || '';
        const localImagePath = row['Local_Image_File'];

        let categoryId = null;
        let subCategoryId = null;

        try {
            // -- CATEGORY LOGIC --
            const catSlug = slugify(department);
            if (memoryCache.categories[catSlug]) {
                categoryId = memoryCache.categories[catSlug];
            } else {
                let cat = await Category.findOne({ slug: catSlug });
                if (!cat) {
                    cat = await Category.create({
                        name: department,
                        slug: catSlug,
                        metaTitle: department,
                        metaDescription: `All products in ${department}`,
                        description: `All products in ${department}`,
                        status: 'Active',
                        cover: {
                            url: "https://res.cloudinary.com/balport/image/upload/v1/placeholder.jpg",
                            _id: "placeholder",
                            blurDataURL: DUMMY_BLUR
                        }
                    });
                    console.log(`Created new Category: ${department}`);
                }
                categoryId = cat._id;
                memoryCache.categories[catSlug] = categoryId;
            }

            // -- SUBCATEGORY LOGIC --
            const subName = `All ${department}`;
            const subSlug = slugify(subName);
            if (memoryCache.subCategories[subSlug]) {
                subCategoryId = memoryCache.subCategories[subSlug];
            } else {
                let sub = await SubCategory.findOne({ slug: subSlug, parentCategory: categoryId });
                if (!sub) {
                    sub = await SubCategory.create({
                        name: subName,
                        slug: subSlug,
                        metaTitle: subName,
                        metaDescription: `All items in ${department}`,
                        description: `All items in ${department}`,
                        status: 'Active',
                        parentCategory: categoryId,
                        cover: {
                            url: "https://res.cloudinary.com/balport/image/upload/v1/placeholder.jpg",
                            _id: "placeholder",
                            blurDataURL: DUMMY_BLUR
                        }
                    });
                    console.log(`Created new SubCategory: ${subName}`);
                }
                subCategoryId = sub._id;
                memoryCache.subCategories[subSlug] = subCategoryId;
            }

            // -- CHECK PRODUCT EXISTS --
            const productSlug = slugify(`${name}-${upc}`);
            const existingProduct = await Product.findOne({
                $or: [{ sku: upc }, { slug: productSlug }]
            });

            if (existingProduct) {
                console.log(`[SKIP] Product ${name} (SKU: ${upc}) already exists.`);
                continue;
            }

            // -- CLOUDINARY UPLOAD --
            let uploadedImage = {
                url: "https://res.cloudinary.com/balport/image/upload/v1/placeholder.jpg",
                _id: "placeholder_product",
                blurDataURL: DUMMY_BLUR
            };

            if (localImagePath && CloudinaryService) {
                // Ignore the CSV's folder structure, just get the file name (e.g. 123.jpg)
                const imageName = path.basename(localImagePath.replace(/\\/g, '/'));
                const fullImagePath = path.resolve(BASE_IMAGE_DIR, imageName);
                
                if (fs.existsSync(fullImagePath)) {
                    console.log(`Uploading ${imageName} to Cloudinary...`);
                    try {
                        const uploadResult = await CloudinaryService.uploadImage(fullImagePath, 'balport-products/seeded');
                        uploadedImage = {
                            url: uploadResult.url,
                            _id: uploadResult.public_id,
                            blurDataURL: uploadResult.blurDataURL || DUMMY_BLUR
                        };
                    } catch (uploadErr) {
                        console.error(`Failed to upload image ${localImagePath}:`, uploadErr.message);
                    }
                } else {
                    console.log(`Image not found on disk at ${fullImagePath}, using placeholder.`);
                }
            }

            // -- CREATE PRODUCT --
            await Product.create({
                name: name,
                code: upc,
                sku: upc,
                price: price,
                priceSale: price,
                available: 100, // Default inventory
                sold: 0,
                status: 'Active',
                description: description,
                metaTitle: name,
                slug: productSlug,
                category: categoryId,
                subCategory: subCategoryId,
                images: [uploadedImage]
            });

            console.log(`[SUCCESS] Seeded product: ${name}`);
            successCount++;

        } catch (err) {
            console.error(`[ERROR] Failed to seed row ${i} (UPC: ${upc}):`, err.message);
            errorCount++;
        }
    }

    console.log("\n=================================");
    console.log("🎊 SEEDING COMPLETE 🎊");
    console.log(`Processed: ${successCount} successful products.`);
    console.log(`Errors: ${errorCount}`);
    console.log("=================================\n");
    process.exit(0);
}

seedProducts().catch(err => {
    console.error("CRITICAL ERROR DURING SEED:", err);
    process.exit(1);
});
