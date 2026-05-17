/**
 * check-unmatched-upcs.js
 *
 * Checks which of the unmatched whiskey UPCs exist in the database
 * with various normalization strategies.
 */

const path = require('path');
const mongoose = require('mongoose');

try {
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) { }

const Product = require('../src/models/Product');

const connectDB = async () => {
    const uri = 'mongodb://localhost:27017/liquor_shop';
    console.log(`Connecting to: ${uri}`);
    await mongoose.connect(uri);
    const count = await Product.countDocuments();
    console.log(`Connected — ${count} products\n`);
};

const UNMATCHED_UPCS = [
    // Full 13-digit UPCs
    '0040232379123',
    '0040232555442',
    '0051497363840',
    '0080686004424',
    '0080686007746',
    '0080686009955',
    '0081128000646',
    '0081128001872',
    '0081128002879',
    '0082000809791',
    '0082184004371',
    '0085246503126',
    '0085246503171',
    '0088076188365',
    '0088076190566',
    '0655709000303',
    '0810020890020',
    '0812066020300',
    '0814794011957',
    '0816136023413',
    '0850003347653',
    '0857186006025',
    '0858349004100',
    '0860009871007',
    // Short UPCs
    '08262802',
    '08269203',
    '08773502',
    '08773900',
    '08776509',
    '10055406',
];

function stripLeadingZeros(str) {
    return str.replace(/^0+/, '') || '0';
}

async function run() {
    await connectDB();

    const results = {
        found: [],
        notFound: [],
    };

    for (const upc of UNMATCHED_UPCS) {
        const stripped = stripLeadingZeros(upc);
        const padded13 = upc.padStart(13, '0');
        const padded12 = upc.padStart(12, '0');

        const queries = [
            { code: upc },
            { code: stripped },
            { code: padded13 },
            { code: padded12 },
            { sku: `BP-${upc}` },
            { sku: `BP-${stripped}` },
            { sku: `BP-${padded13}` },
            { sku: `BP-${padded12}` },
            { sku: upc },
            { sku: stripped },
        ];

        let product = null;
        let matchedQuery = null;

        for (const q of queries) {
            product = await Product.findOne(q);
            if (product) {
                matchedQuery = JSON.stringify(q);
                break;
            }
        }

        if (product) {
            results.found.push({
                upc,
                productName: product.name,
                productCode: product.code,
                productSku: product.sku,
                matchedQuery,
            });
        } else {
            results.notFound.push(upc);
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`FOUND IN DATABASE: ${results.found.length}`);
    console.log(`${'='.repeat(60)}`);
    for (const r of results.found) {
        console.log(`✅ ${r.upc} → "${r.productName}" (code=${r.productCode}, sku=${r.productSku})`);
        console.log(`   Matched with: ${r.matchedQuery}`);
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`NOT FOUND IN DATABASE: ${results.notFound.length}`);
    console.log(`${'='.repeat(60)}`);
    for (const upc of results.notFound) {
        console.log(`❌ ${upc}`);
    }

    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
