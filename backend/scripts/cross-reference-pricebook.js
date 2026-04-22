const fs = require('fs');
const path = require('path');

// Load pricebook
const csv = fs.readFileSync('C:\\Users\\User\\Desktop\\Project-Roma\\pricebook73825.csv', 'utf8');
const lines = csv.split('\n');
const headers = lines[0].split(',');
const nameIdx = headers.indexOf('Name');
const deptIdx = headers.indexOf('Department');

// Build name→department lookup (lowercase name → department)
const pricebookLookup = {};
for (let i = 1; i < lines.length; i++) {
    // Simple CSV parse - handle quoted fields
    const row = lines[i];
    if (!row.trim()) continue;
    
    // Extract name and department using regex for CSV
    const fields = [];
    let field = '';
    let inQuotes = false;
    for (let j = 0; j < row.length; j++) {
        const ch = row[j];
        if (ch === '"') { inQuotes = !inQuotes; continue; }
        if (ch === ',' && !inQuotes) { fields.push(field); field = ''; continue; }
        field += ch;
    }
    fields.push(field);
    
    const name = (fields[nameIdx] || '').trim();
    const dept = (fields[deptIdx] || '').trim();
    if (name && dept) {
        pricebookLookup[name.toLowerCase()] = dept;
    }
}

console.log(`Loaded ${Object.keys(pricebookLookup).length} products from pricebook\n`);

// Map POS departments to website categories
const DEPT_TO_CATEGORY = {
    'ACCESSORIES': 'accessories',
    'BEACH TOYS': 'accessories',
    'BEER': 'beer', 'Beer1osama': 'beer', 'IPA BEER 1': 'beer', 'SOUR BEER': 'beer', 'MALT BEVERGE': 'beer',
    'BEEF JERKY': 'snacks',
    'BREATH REFRESHER': 'gum-mints',
    'CANDY GUMMIES 1': 'candy', 'Candy1osama': 'candy', 'CHOCOLATE 1': 'candy', 'CHEWING GUMMIES': 'candy', 'GUMMY 1': 'candy', 'SOUR GUMMIES 1': 'candy',
    'CELCIUS': 'energy-drinks', 'ENERGY DRINKS 1': 'energy-drinks', 'GHOST 1': 'energy-drinks', 'REDBULL 1': 'energy-drinks', 'ROCKSTAR 1': 'energy-drinks', 'SMALL ENERGY AND HYDRATION DRINKS 1': 'energy-drinks',
    'CHIPS FRETOLAY': 'snacks', 'CHIPS NON- FRETOLAY': 'snacks', 'HANGING SNACK 1': 'snacks', 'Snacks1osama': 'snacks', 'Protien bar': 'snacks', 'PROTIEN BARS 1': 'snacks', 'PROTEIN SHAKES': 'snacks',
    'COCKTAIL 1': 'cocktails-seltzers', 'Hard Seltzer1osama': 'cocktails-seltzers', 'HARD SILTZER  1': 'cocktails-seltzers', 'Seltzers & More1osama': 'cocktails-seltzers', 'Spiked1osama': 'cocktails-seltzers', 'HARD ICE TEA 1': 'cocktails-seltzers',
    'COFFEE 1': 'tea-coffee', 'ICE TEA 1': 'tea-coffee',
    'CONDOMS': 'pharmacy-care', 'MEDICINE': 'pharmacy-care', 'Personal Care1osama': 'pharmacy-care', 'SUNSCREEN 1': 'pharmacy-care',
    'Dairy & Eggs1osama': 'grocery', 'Grocery 1': 'grocery', 'Grocery1osama': 'grocery', 'Pantry1osama': 'grocery', 'Household1osama': 'grocery', 'SAUCES 1': 'grocery', 'Frozen1osama': 'grocery', 'milk 1': 'grocery', 'DIPS 1': 'grocery',
    'Drinks & Mixers1osama': 'soda', 'Drinks1osama': 'soda', 'Big soda 1': 'soda', 'SMALL SODA 1': 'soda', 'HEALTHY SODA 1': 'soda',
    'ELECTROLIT 1': 'juice-drinks', 'GATORADE BIG 1': 'juice-drinks', 'GATORADE SMALL 1': 'juice-drinks', 'JUICE 1': 'juice-drinks', 'Coconut Water 1': 'juice-drinks',
    'Fish Bait': 'accessories',
    'Gin1osama': 'gin', 'Big Gin': 'gin',
    'GUM 1': 'gum-mints',
    'Ice.cream 1': 'ice-cream',
    'LIQUEUR 1': 'liqueur-spirits', 'Liqueur1osama': 'liqueur-spirits', 'SHOTS LIQUOR 1': 'liqueur-spirits', 'Brandy & Cognac1osama': 'liqueur-spirits', 'Spirit osama': 'liqueur-spirits', 'Spirit1': 'liqueur-spirits', 'Spirits1osama': 'liqueur-spirits',
    'MIXERS': 'soda',
    'Rum1osama': 'rum',
    'SAKE': 'liqueur-spirits', 'SOJU 1': 'liqueur-spirits',
    'SPARKLING WATER 1': 'water', 'WATER 1': 'water',
    'Tequila1osama': 'tequila', 'Big Tequila 1': 'tequila', 'Small Tequila 1': 'tequila',
    'Vodka1osama': 'vodka', 'Big Vodka 1': 'vodka', 'Small Vodka 1': 'vodka', 'VODKA FLAVOR 1': 'vodka',
    'WHISKEY': 'whiskey', 'Whiskey1osama': 'whiskey', 'SCOTCH WHISKY BIG 1': 'whiskey', 'SMALL SCOTCH WHISKY 1': 'whiskey',
    'Wine1': 'wine', 'Wine1osama': 'wine', 'Wine osama': 'wine', 'other wine 1': 'wine', 'SAUVIGNON BLANC 1': 'wine', 'WINE CABERNET SAUVIGNON 1': 'wine', 'Wine Champagne 1': 'wine', 'WINE CHARDONAY 1': 'wine', 'WINE PINOT GRIGIO 1': 'wine', 'Wine pinot noir 1': 'wine', 'Wine Rose 1': 'wine', 'Wine Sav Bl 1': 'wine', 'WINE SMALL SIZES 1': 'wine',
    'EXOTIC DRINKS': 'soda',
    'SLUSH PUPPIE 1': 'soda',
    'ORGANIC 1': 'juice-drinks',
    'HYDRATION PACKETS': 'juice-drinks',
    'TORCH 1': 'torch',
    'CAFFEINE POUCHES': 'accessories',
    'CHARGERS': 'accessories',
    'ROLLING PAPER AND CIGAR': 'accessories',
    'MUOSHROOM': 'accessories',
    'CBD': 'accessories',
};

// Ignore these departments (not categories on the website)
const IGNORE_DEPTS = ['Tax', '2 FEE', 'FEES', 'RETURN / REFUND', 'GIFT CARDS', 'No tax', 'Ice', 'va',
    'Cigarettes 1', 'CIGARS  1', 'cigars 1', 'Chewing Tobacco', 'POUCHES TOBACCO 1', 'juul 1', 'Zyn 1', 'SCRATCHER 1',
    'NonAlcohol osama', 'NonAlcohol1'];

// Process all dump files
const dumpFiles = fs.readdirSync('scripts').filter(f => f.startsWith('dump-') && f.endsWith('.txt'));
const allMismatches = [];
let totalChecked = 0;
let totalMatched = 0;
let totalMismatched = 0;
let totalNotFound = 0;

for (const file of dumpFiles) {
    const websiteCategory = file.replace('dump-', '').replace('.txt', '');
    const content = fs.readFileSync(`scripts/${file}`, 'utf8');
    const products = content.split('\n').filter(l => l.trim());
    
    for (const line of products) {
        const parts = line.split('|');
        if (parts.length < 4) continue;
        const name = parts[1].trim();
        const id = parts[3].trim();
        
        const posDept = pricebookLookup[name.toLowerCase()];
        if (!posDept) {
            totalNotFound++;
            continue;
        }
        
        if (IGNORE_DEPTS.includes(posDept)) continue;
        
        const expectedCategory = DEPT_TO_CATEGORY[posDept];
        if (!expectedCategory) {
            // Unknown department mapping
            continue;
        }
        
        totalChecked++;
        
        if (expectedCategory !== websiteCategory) {
            totalMismatched++;
            allMismatches.push({
                name,
                id,
                currentCategory: websiteCategory,
                posDept,
                correctCategory: expectedCategory
            });
        } else {
            totalMatched++;
        }
    }
}

// Summary
console.log('='.repeat(65));
console.log(' POS PRICEBOOK CROSS-REFERENCE RESULTS');
console.log('='.repeat(65));
console.log(`  Products matched to pricebook: ${totalChecked}`);
console.log(`  Correctly categorized:         ${totalMatched}`);
console.log(`  MISMATCHED:                    ${totalMismatched}`);
console.log(`  Not found in pricebook:        ${totalNotFound}`);
console.log('='.repeat(65));

// Group mismatches by current category
const byCategory = {};
for (const m of allMismatches) {
    if (!byCategory[m.currentCategory]) byCategory[m.currentCategory] = [];
    byCategory[m.currentCategory].push(m);
}

const output = [];
output.push(`// AUTO-GENERATED: POS-verified category corrections`);
output.push(`// Total: ${totalMismatched} products to move`);
output.push(`// Generated: ${new Date().toISOString()}\n`);
output.push(`const corrections = [`);

for (const [cat, items] of Object.entries(byCategory).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n${cat.toUpperCase()}: ${items.length} wrong`);
    output.push(`  // === ${cat.toUpperCase()} (${items.length} items to move) ===`);
    
    // Group by target
    const byTarget = {};
    for (const item of items) {
        if (!byTarget[item.correctCategory]) byTarget[item.correctCategory] = [];
        byTarget[item.correctCategory].push(item);
    }
    
    for (const [target, tItems] of Object.entries(byTarget).sort((a, b) => b[1].length - a[1].length)) {
        console.log(`  → ${target}: ${tItems.length} items`);
        for (const item of tItems) {
            console.log(`      "${item.name}" (POS: ${item.posDept})`);
            output.push(`  { id: "${item.id}", from: "${cat}", to: "${target}", name: "${item.name.replace(/"/g, '\\"')}", posDept: "${item.posDept}" },`);
        }
    }
}

output.push(`];\n`);
output.push(`module.exports = corrections;`);

fs.writeFileSync('scripts/pos-verified-corrections.js', output.join('\n'), 'utf8');
console.log(`\n\nSaved ${totalMismatched} corrections to scripts/pos-verified-corrections.js`);
