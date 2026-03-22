const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
// const csv = require('csv-parser'); // Removed dependency, using manual parser below

// Try to load dotenv
try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
    console.log('dotenv not found, assuming environment variables are set.');
}

// Adjust module paths based on execution context
const Product = require('../src/models/Product');

// We expect the CSV file to be in the same directory
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

// Manual CSV Parser to handle complex cases if a library isn't available in the production container
const parseCSV = (content) => {
    // Handle Windows CRLF vs Linux LF
    const lines = content.split(/\r?\n/);
    console.log(`Debug: Total raw lines found: ${lines.length}`);
    if (lines.length > 0) {
        console.log(`Debug: First line (Header): ${lines[0]}`);
    }

    const data = [];


    // Header Reference:
    // Category, Sub Category, Name, upc..., price, Images, ..., SKU, Description 
    // We need Name (index 2), SKU (index 13), Description (index 14) based on analysis
    // NOTE: Index might vary slightly if there are empty columns.
    // Let's rely on the structure observed: 
    // ... , Images, , , , , , , SKU, Description

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

        // Debug first line parsing
        if (i === 1) {
            console.log(`Debug: Line 1 parts found: ${parts.length}`);
            console.log(`Debug: Line 1 content: ${JSON.stringify(parts)}`);
        }

        // Ensure we have enough parts.
        // Debug output showed 14 parts.
        // Index 2: Name
        // Index 12: SKU (BP-BEE-11.2OZ-10001)
        // Index 13: Description ("Golden, easy-drinking...")
        if (parts.length >= 14) {
            data.push({
                name: parts[2],
                sku: parts[12],
                description: parts[13]
            });
        }
    }
    return data;
};

const updateInventory = async () => {
    await connectDB();

    try {
        console.log(`Reading CSV from ${CSV_FILE_PATH}...`);
        if (!fs.existsSync(CSV_FILE_PATH)) {
            throw new Error(`CSV file not found at ${CSV_FILE_PATH}`);
        }

        const content = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
        const records = parseCSV(content);

        console.log(`Found ${records.length} records to process.`);

        let processed = 0;
        let updated = 0;
        let notFound = 0;

        for (const record of records) {
            if (!record.name) continue;

            try {
                // Find by name
                const product = await Product.findOne({ name: record.name });

                if (product) {
                    let isModified = false;

                    // Update SKU if different
                    if (record.sku && product.sku !== record.sku) {
                        console.log(`[UPDATE] SKU for "${record.name}": ${product.sku} -> ${record.sku}`);
                        product.sku = record.sku;
                        isModified = true;
                    }

                    // Update Description if different (and not empty in CSV)
                    if (record.description && product.description !== record.description) {
                        // Only log if it's a significant update
                        // console.log(`[UPDATE] Description for "${record.name}"`);
                        product.description = record.description;
                        isModified = true;
                    }

                    if (isModified) {
                        try {
                            await product.save();
                            updated++;
                        } catch (saveError) {
                            console.error(`[ERROR] Failed to save "${record.name}":`, saveError.message);
                        }
                    }
                } else {
                    console.log(`[WARN] Product not found: "${record.name}"`);
                    notFound++;
                }
            } catch (err) {
                console.error(`[ERROR] Processing "${record.name}":`, err.message);
            }
            processed++;
        }

        console.log('--- Summary ---');
        console.log(`Total Processed: ${processed}`);
        console.log(`Updated: ${updated}`);
        console.log(`Not Found: ${notFound}`);

        process.exit(0);
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
};

updateInventory();
