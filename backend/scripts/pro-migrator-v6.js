const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinaryService = require('../src/services/cloudinary.service');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');

const CSV_FILE_PATH = path.join(__dirname, '../pro_data/inventory_pro.csv');
const IMAGES_DIR = path.join(__dirname, '../pro_data/images');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://balport-mongo:27017/liquor_shop");
        console.log('✅ MongoDB Connected');
    } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        process.exit(1);
    }
};

const parseProCSV = (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0].split('\t');
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split('\t');
        const row = {};
        headers.forEach((h, idx) => { row[h] = parts[idx]; });
        if (row['Upc']) {
            data.push({
                category: row['Department'] || 'SPIRITS',
                name: row['Official_Name'] || row['Name'],
                upc: row['Upc'],
                price: parseFloat(row['price $']?.replace('$', '').replace(',', '')) || 0,
                description: row['Description'] || '',
                brand: row['Brand'] || ''
            });
        }
    }
    return data;
};

const generateSlug = (name, upc) => {
    return (name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + upc.slice(-6)).substring(0, 60);
};

const migratePro = async () => {
    await connectDB();
    try {
        console.log('📖 Reading Professional CSV...');
        const records = parseProCSV(CSV_FILE_PATH);
        const allCategories = await Category.find({});
        const allSubCats = await SubCategory.find({});
        
        // Create Maps for fast lookup
        const categoryMap = new Map();
        allCategories.forEach(c => categoryMap.set(c.name.toUpperCase(), c._id));
        
        const subCatLookup = {}; // catId -> subCatId
        allSubCats.forEach(s => {
            if (!subCatLookup[s.parentCategory.toString()]) {
                subCatLookup[s.parentCategory.toString()] = s._id;
            }
        });

        let processed = 0;
        for (const record of records) {
            try {
                const catId = categoryMap.get(record.category.toUpperCase()) || categoryMap.get('SPIRITS');
                // Ensure we ALWAYS have a subcategory ID to pass validation
                const subCatId = subCatLookup[catId.toString()] || allSubCats[0]._id;

                const imageFilename = `${record.upc}.jpg`;
                const sourceImagePath = path.join(IMAGES_DIR, imageFilename);
                let productImages = [];

                if (fs.existsSync(sourceImagePath)) {
                    console.log(`📷 [${processed+1}] Uploading: ${record.name}`);
                    try {
                        const uploadResult = await cloudinaryService.uploadImage(sourceImagePath, 'balport-products');
                        productImages.push({
                            url: uploadResult.url,
                            _id: uploadResult.public_id,
                            blurDataURL: uploadResult.blurDataURL
                        });
                    } catch (imgErr) { console.error(`❌ Cloudinary error on ${record.upc}`); }
                }

                const productData = {
                    name: record.name,
                    slug: generateSlug(record.name, record.upc),
                    sku: `BP-${record.upc}-${Date.now().toString().slice(-4)}`, 
                    code: record.upc,
                    priceSale: record.price,
                    available: 100,
                    status: 'Active',
                    description: record.description,
                    category: catId,
                    subCategory: subCatId,
                    images: productImages,
                    metaTitle: record.name,
                    metaDescription: record.description.substring(0, 160)
                };

                await Product.create(productData);
                processed++;
                if (processed % 20 === 0) console.log(`✅ Progress: ${processed} items synced.`);
            } catch (err) { console.error(`⚠️ Error on ${record.upc}:`, err.message); }
        }
        console.log(`\n✨ FINISHED. Total: ${processed}`);
        process.exit(0);
    } catch (error) { console.error('❌ Fatal Error:', error); process.exit(1); }
};
migratePro();
