const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Try to load dotenv
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set.');
}

// Adjust module paths based on execution context
const Product = require('../src/models/Product');

// We copy the CSV file to the same directory as the script in the container
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

// Manual CSV Parser (re-using robust logic from previous script)
const parseCSV = (content) => {
    // Handle Windows CRLF vs Linux LF
    const lines = content.split(/\r?\n/);
    console.log(`Debug: Total raw lines found: ${lines.length}`);

    const data = [];

    // Header Reference:
    // Index 2: Name
    // Index 4: Price ("13٫99")

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

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

        // Ensure we have enough parts. Price is at index 4.
        if (parts.length >= 5) {
            data.push({
                name: parts[2],
                priceRaw: parts[4] // Needs cleaning
            });
        }
    }
    return data;
};

const cleanPrice = (priceStr) => {
    if (!priceStr) return 0;
    // Replace Arabic decimal separator '٫' with '.'
    // Remove any other non-numeric characters except '.'
    let clean = priceStr.replace(/٫/g, '.').replace(/[^0-9.]/g, '');
    return parseFloat(clean) || 0;
};

const updatePrices = async () => {
    await connectDB();

    try {
        console.log(`Reading CSV...`);
        if (!fs.existsSync(CSV_FILE_PATH)) {
            throw new Error(`CSV file not found at ${CSV_FILE_PATH}`);
        }

        const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
        const records = parseCSV(content);
        console.log(`Found ${records.length} records in CSV.`);

        let processedCount = 0;
        let updatedCount = 0;
        let notFoundCount = 0;

        for (const record of records) {
            try {
                if (!record.name) continue;

                // Find product by Name
                const product = await Product.findOne({ name: record.name });

                if (product) {
                    const newSalePrice = cleanPrice(record.priceRaw);

                    // Logic: 
                    // Set 'price' to null
                    // Set 'priceSale' to newSalePrice

                    // Check if update is needed to avoid unnecessary writes
                    let needsUpdate = false;

                    if (product.price !== null) {
                        product.price = null;
                        needsUpdate = true;
                    }

                    if (product.priceSale !== newSalePrice) {
                        product.priceSale = newSalePrice;
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        console.log(`  - Updating "${record.name}": price -> null, priceSale -> ${newSalePrice}`);
                        await product.save();
                        updatedCount++;
                    }
                } else {
                    // console.warn(`[WARN] Product not found: "${record.name}"`);
                    notFoundCount++;
                }

                processedCount++;
            } catch (err) {
                console.error(`[ERROR] Failed to process "${record.name}":`, err.message);
            }
        }

        console.log(`\nPrice Update Completed.`);
        console.log(`Total Records: ${records.length}`);
        console.log(`Processed: ${processedCount}`);
        console.log(`Updated: ${updatedCount}`);
        console.log(`Not Found: ${notFoundCount}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

updatePrices();
