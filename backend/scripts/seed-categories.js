const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Try to load dotenv
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set or not needed if hardcoded (not recommended).');
}

// Adjust module paths based on execution context
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');

const CSV_FILE_PATH = path.join(__dirname, 'inventory.csv');

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
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Naive CSV parser handling quoted fields
        const parts = [];
        let current = '';
        let inQuote = false;

        for (let char of line) {
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === ',' && !inQuote) {
                parts.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        parts.push(current.trim());

        // Assuming column 0 is Category and column 1 is Sub Category based on user request/standard
        // Adjust indices if the CSV structure is different
        if (parts.length > 1) {
            data.push({
                category: parts[0].replace(/^"|"$/g, ''),
                subCategory: parts[1].replace(/^"|"$/g, '')
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

const seedCategories = async () => {
    await connectDB();

    try {
        console.log('Reading CSV...');
        if (!fs.existsSync(CSV_FILE_PATH)) {
            throw new Error(`CSV file not found at ${CSV_FILE_PATH}`);
        }

        const records = parseCSV(CSV_FILE_PATH);
        const categoryMap = new Map(); // Name -> Set<SubCategoryName>

        records.forEach(record => {
            if (!record.category) return;

            if (!categoryMap.has(record.category)) {
                categoryMap.set(record.category, new Set());
            }
            if (record.subCategory) {
                categoryMap.get(record.category).add(record.subCategory);
            }
        });

        console.log(`Found ${categoryMap.size} main categories.`);

        for (const [catName, subCats] of categoryMap) {
            const catSlug = generateSlug(catName);

            const categoryData = {
                name: catName,
                slug: catSlug,
                metaTitle: catName,
                description: `Shop for ${catName} at Balport`,
                metaDescription: `Buy ${catName} online. Best selection and prices.`,
                status: 'Active',
                cover: {
                    _id: `placeholder-${catSlug}`,
                    url: 'https://placehold.co/600x400?text=' + encodeURIComponent(catName),
                    blurDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI8wNPvd7POQAAAABJRU5ErkJggg==',
                },
            };

            const category = await Category.findOneAndUpdate(
                { slug: catSlug },
                categoryData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );

            console.log(`Processed Category: ${catName}`);

            let subCatIds = [];
            // Initialize subCategories if it doesn't exist or fetch existing
            if (category.subCategories && category.subCategories.length > 0) {
                subCatIds = [...category.subCategories];
            }

            for (const subCatName of subCats) {
                const subCatSlug = generateSlug(subCatName);

                const subCategoryData = {
                    name: subCatName,
                    slug: subCatSlug,
                    metaTitle: subCatName,
                    description: `Shop for ${subCatName}`,
                    metaDescription: `Buy ${subCatName} online.`,
                    status: 'Active',
                    parentCategory: category._id,
                    cover: {
                        _id: `placeholder-${subCatSlug}`,
                        url: 'https://placehold.co/600x400?text=' + encodeURIComponent(subCatName),
                        blurDataURL: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI8wNPvd7POQAAAABJRU5ErkJggg==',
                    }
                };

                const subCategory = await SubCategory.findOneAndUpdate(
                    { slug: subCatSlug, parentCategory: category._id },
                    subCategoryData,
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                );

                if (!subCatIds.includes(subCategory._id)) {
                    subCatIds.push(subCategory._id);
                }
            }

            // Update parent category with all subcategory IDs
            category.subCategories = subCatIds;
            await category.save();

            console.log(`  - Seeded ${subCats.size} subcategories for ${catName}`);
        }

        console.log('All categories and subcategories seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding categories:', error);
        process.exit(1);
    }
};

seedCategories();
