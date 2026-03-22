const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cloudinary = require('../src/services/cloudinary.service');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');
const start = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://balport-mongo:27017/liquor_shop");
        console.log('✅ DB Connected');
        await Product.deleteMany({});
        const cats = await Category.find({});
        const subcats = await SubCategory.find({});
        const catMap = {}; cats.forEach(c => catMap[c.name.toUpperCase()] = c._id);
        const subMap = {}; subcats.forEach(s => { if(!subMap[s.parentCategory.toString()]) subMap[s.parentCategory.toString()] = s._id; });
        const content = fs.readFileSync('/app/pro_data/Final_Pro_Verified_V10.csv', 'utf-8');
        const lines = content.split('\n');
        const headers = lines[0].split('\t');
        const idx = {
            upc: headers.indexOf('Upc'),
            name: headers.indexOf('Official_Name'),
            altName: headers.indexOf('Name'),
            dept: headers.indexOf('Department'),
            price: headers.indexOf('price $'),
            desc: headers.indexOf('Clean_Desc')
        };
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const p = line.split('\t');
            const upc = p[idx.upc]?.trim();
            if (!upc) continue;
            try {
                const name = (p[idx.name] || p[idx.altName] || 'Unknown').trim();
                const cid = catMap[(p[idx.dept] || 'SPIRITS').toUpperCase()] || catMap['SPIRITS'];
                const sid = subMap[cid.toString()] || (subcats.length > 0 ? subcats[0]._id : null);
                let imgs = [];
                const imgPath = path.join('/app/pro_data/images', `${upc}.jpg`);
                if (fs.existsSync(imgPath)) {
                    console.log(`📸 [${count+1}] Uploading ${upc}...`);
                    const up = await cloudinary.uploadImage(imgPath, 'balport-products');
                    imgs.push({ url: up.url, _id: up.public_id, blurDataURL: up.blurDataURL });
                }
                await Product.create({
                    name: name,
                    slug: (name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + upc + '-' + count).substring(0, 80),
                    sku: `BP-FIN-${upc}-${count}`,
                    code: upc,
                    priceSale: parseFloat((p[idx.price] || '0').replace(/[$,]/g, '')) || 0,
                    available: 100,
                    status: 'Active',
                    description: p[idx.desc] || "",
                    category: cid,
                    subCategory: sid,
                    images: imgs
                });
                count++;
                if(count % 50 === 0) console.log(`🚀 Processed: ${count}`);
            } catch (e) { console.error(`❌ Err ${upc}: ${e.message}`); }
        }
        console.log('✨ ALL DONE');
        process.exit(0);
    } catch (err) { console.error('Fatal:', err); process.exit(1); }
};
start();
