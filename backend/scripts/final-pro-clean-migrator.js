const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinaryService = require('../src/services/cloudinary.service');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');

const CSV_FILE_PATH = path.join(__dirname, '../pro_data/UPC_Lookup_Final_No_Tobacco.csv');
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
    
    const descIndex = headers.indexOf('Description');
    const officialNameIndex = headers.indexOf('Official_Name');
    const nameIndex = headers.indexOf('Name');
    const upcIndex = headers.indexOf('Upc');
    const priceIndex = headers.indexOf('price $');
    const deptIndex = headers.indexOf('Department');

    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const parts = line.split('\t');
        
        const upc = parts[upcIndex]?.trim();
        if (upc) {
            data.push({
                categoryRaw: parts[deptIndex] || 'SPIRITS',
                name: parts[officialNameIndex] || parts[nameIndex],
                upc: upc,
                price: parseFloat(parts[priceIndex]?.replace('$', '').replace(',', '')) || 0,
                description: parts[descIndex]?.replace(/^"|"$/g, '').replace(/""/g, '"') || ''
            });
        }
    }
    return data;
};

const generateSlug = (name, upc) => {
    return (name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + upc).substring(0, 80);
};

const migratePro = async () => {
    await connectDB();
    await Product.deleteMany({});
    console.log('🧹 DB Cleared. Starting Fresh Final Upload...');

    try {
        const records = parseProCSV(CSV_FILE_PATH);
        const allCategories = await Category.find({});
        const allSubCats = await SubCategory.find({});
        
        const categoryMap = new Map();
        allCategories.forEach(c => categoryMap.set(c.name.toUpperCase(), c._id));
        
        const subCatLookup = {}; 
        allSubCats.forEach(s => {
            const parentId = s.parentCategory.toString();
            if (!subCatLookup[parentId]) subCatLookup[parentId] = [];
            subCatLookup[parentId].push({ id: s._id, name: s.name.toUpperCase() });
        });

        let processed = 0;
        for (const record of records) {
            try {
                let dept = record.categoryRaw.toUpperCase();
                let catName = 'SPIRITS';
                
                if (dept.includes('WHISKEY')) catName = 'WHISKEY';
                else if (dept.includes('TEQUILA')) catName = 'TEQUILA';
                else if (dept.includes('BEER')) catName = 'BEER';
                else if (dept.includes('WINE')) catName = 'WINE';
                else if (dept.includes('VODKA')) catName = 'VODKA';
                else if (dept.includes('GIN')) catName = 'GIN';
                else if (dept.includes('SODA') || dept.includes('WATER') || dept.includes('DRINKS')) catName = 'DRINKS';
                else if (dept.includes('SNACK') || dept.includes('CHIPS') || dept.includes('CHOCOLATE') || dept.includes('CANDY')) catName = 'SNACKS';
                
                const catId = categoryMap.get(catName) || categoryMap.get('SPIRITS');
                const subCats = subCatLookup[catId.toString()] || [];
                let subCatId = subCats.length > 0 ? subCats[0].id : (allSubCats.length > 0 ? allSubCats[0]._id : null);

                const sourceImagePath = path.join(IMAGES_DIR, `${record.upc}.jpg`);
                let productImages = [];

                if (fs.existsSync(sourceImagePath) && fs.statSync(sourceImagePath).size > 0) {
                    try {
                        const uploadResult = await cloudinaryService.uploadImage(sourceImagePath, 'balport-products');
                        productImages.push({
                            url: uploadResult.url,
                            _id: uploadResult.public_id,
                            blurDataURL: uploadResult.blurDataURL
                        });
                    } catch (imgErr) {}
                }

                await Product.create({
                    name: record.name,
                    slug: generateSlug(record.name, record.upc),
                    sku: `BP-PRO-${record.upc}`,
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
                });

                processed++;
                if (processed % 100 === 0) console.log(`🚀 Final Sync Progress: ${processed}/${records.length}`);
            } catch (err) { console.error(`⚠️ Skip ${record.upc}:`, err.message); }
        }
        console.log(`\n✨ FINAL CLEAN UPLOAD FINISHED: ${processed} products.`);
        process.exit(0);
    } catch (error) { console.error('❌ Fatal Error:', error); process.exit(1); }
};
migratePro();
