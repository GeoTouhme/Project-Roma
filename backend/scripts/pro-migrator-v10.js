const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinaryService = require('../src/services/cloudinary.service');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');

const CSV_FILE_PATH = path.join(__dirname, '../pro_data/Final_Pro_Verified_V10.csv');
const IMAGES_DIR = path.join(__dirname, '../pro_data/images');

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://balport-mongo:27017/liquor_shop");
        console.log('✅ Connected to MongoDB');
    } catch (error) {
        process.exit(1);
    }
};

const parseV10CSV = (filePath) => {
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
                dept: row['Department'],
                name: row['Official_Name'] || row['Name'],
                upc: row['Upc'].trim(),
                price: parseFloat(row['price $']?.replace('$', '').replace(',', '')) || 0,
                description: row['Clean_Desc']
            });
        }
    }
    return data;
};

const migrate = async () => {
    await connectDB();
    await Product.deleteMany({});
    
    const records = parseV10CSV(CSV_FILE_PATH);
    const allCategories = await Category.find({});
    const allSubCats = await SubCategory.find({});
    
    const catMap = new Map();
    allCategories.forEach(c => catMap.set(c.name.toUpperCase(), c._id));
    
    const subCatMap = {};
    allSubCats.forEach(s => {
        const pid = s.parentCategory.toString();
        if (!subCatMap[pid]) subCatMap[pid] = s._id;
    });

    let count = 0;
    for (const r of records) {
        try {
            const catId = catMap.get(r.dept.toUpperCase()) || catMap.get('SPIRITS');
            const subId = subCatMap[catId.toString()] || (allSubCats[0]?._id);

            const imgFile = path.join(IMAGES_DIR, `${r.upc}.jpg`);
            let imgs = [];
            if (fs.existsSync(imgFile) && fs.statSync(imgFile).size > 0) {
                console.log(`📸 [${count+1}] Uploading ${r.upc}...`);
                const up = await cloudinaryService.uploadImage(imgFile, 'balport-products');
                imgs.push({ url: up.url, _id: up.public_id, blurDataURL: up.blurDataURL });
            }

            await Product.create({
                name: r.name,
                slug: (r.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + r.upc),
                sku: `BP-V10-${r.upc}`,
                code: r.upc,
                priceSale: r.price,
                available: 100,
                status: 'Active',
                description: r.description,
                category: catId,
                subCategory: subId,
                images: imgs,
                metaTitle: r.name,
                metaDescription: r.description.substring(0, 160)
            });
            count++;
            if (count % 50 === 0) console.log(`🚀 Synced ${count} products.`);
        } catch (e) { console.error(`Err ${r.upc}: ${e.message}`); }
    }
    console.log(`✨ FINISHED: ${count} products.`);
    process.exit(0);
};
migrate();
