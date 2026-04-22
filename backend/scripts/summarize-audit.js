const fs = require('fs');

const report = fs.readFileSync('scripts/category-audit-report.txt', 'utf8');
const lines = report.split('\n');

let currentCategory = null;
const misclassified = {};
let totalConfirmed = 0;

for (const line of lines) {
    const catMatch = line.match(/CATEGORY: (.+?) \((\d+) total, (\d+) suspicious\)/);
    if (catMatch) {
        currentCategory = catMatch[1].toLowerCase();
        continue;
    }
    
    // Only count lines where a DIFFERENT category is suggested (not UNKNOWN)
    const itemMatch = line.match(/^\s+\[(\S+)\s*\]\s+(.+?)\s+\(([a-f0-9]+)\)/);
    if (itemMatch && currentCategory) {
        const suggestedCat = itemMatch[1];
        const name = itemMatch[2];
        const id = itemMatch[3];
        
        if (suggestedCat !== 'UNKNOWN') {
            if (!misclassified[currentCategory]) {
                misclassified[currentCategory] = { confirmed: [], total: 0 };
            }
            misclassified[currentCategory].confirmed.push({ name, id, suggestedCat });
            totalConfirmed++;
        }
    }
}

console.log('='.repeat(60));
console.log(' CONFIRMED MISCLASSIFICATIONS SUMMARY');
console.log('='.repeat(60));
console.log(`\n Total confirmed wrong items: ${totalConfirmed}\n`);

const sorted = Object.entries(misclassified).sort((a, b) => b[1].confirmed.length - a[1].confirmed.length);

for (const [cat, data] of sorted) {
    console.log(`\n${cat.toUpperCase()}: ${data.confirmed.length} confirmed wrong`);
    
    // Group by suggested category
    const groups = {};
    for (const item of data.confirmed) {
        if (!groups[item.suggestedCat]) groups[item.suggestedCat] = [];
        groups[item.suggestedCat].push(item);
    }
    
    for (const [target, items] of Object.entries(groups).sort((a,b) => b[1].length - a[1].length)) {
        console.log(`  → ${target}: ${items.length} items`);
        for (const item of items.slice(0, 3)) {
            console.log(`      "${item.name}"`);
        }
        if (items.length > 3) console.log(`      ... and ${items.length - 3} more`);
    }
}
