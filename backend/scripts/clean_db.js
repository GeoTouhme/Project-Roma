const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Setup environment and paths
const BACKEND_DIR = __dirname; // Assuming we run from backend/scripts/ or backend/
dotenv.config({ path: path.join(BACKEND_DIR, '../.env') });
dotenv.config({ path: path.join(BACKEND_DIR, '.env') }); 

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');

async function cleanDB() {
    if (!process.env.MONGODB_URI) {
        console.error("❌ ERROR: MONGODB_URI is not set in environment.");
        process.exit(1);
    }

    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("✅ Connected to MongoDB");

    try {
        console.log("🗑️ Deleting all Products...");
        const productResult = await Product.deleteMany({});
        console.log(`Removed ${productResult.deletedCount} products.`);

        console.log("🗑️ Deleting all Categories...");
        const catResult = await Category.deleteMany({});
        console.log(`Removed ${catResult.deletedCount} categories.`);

        console.log("🗑️ Deleting all SubCategories...");
        const subCatResult = await SubCategory.deleteMany({});
        console.log(`Removed ${subCatResult.deletedCount} subcategories.`);

        console.log("✨ Database successfully cleaned!");
    } catch (err) {
        console.error("❌ Error cleaning database:", err);
    } finally {
        process.exit(0);
    }
}

cleanDB();
