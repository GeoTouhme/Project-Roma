const mongoose = require('mongoose');
// We need to point to the right path for models inside Docker container
// In Docker, src is at /app/src
const Product = require('./models/Product');
require('dotenv').config({ path: '../.env' }); // Load env from parent directory if needed, or rely on container env

const resetProducts = async () => {
    try {
        // Connect using the connection string from environment
        const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/balport';

        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected.');

        // Delete all products
        console.log('Deleting all products...');
        const result = await Product.deleteMany({});
        console.log(`✅ Successfully deleted ${result.deletedCount} products.`);

        await mongoose.disconnect();
        console.log('Disconnected.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

resetProducts();
