const fs = require('fs');

const slug = process.argv[2];
if (!slug) {
    console.log('Usage: node dump-category.js <slug>');
    process.exit(1);
}

async function main() {
    let all = [];
    let page = 1;
    while (true) {
        const res = await fetch(`https://balportliquors.com/api/products?category=${slug}&limit=100&page=${page}`);
        const data = await res.json();
        all = all.concat(data.data);
        console.log(`  Page ${page}: got ${data.data.length} (total so far: ${all.length}/${data.total})`);
        if (all.length >= data.total) break;
        page++;
    }
    const lines = all.map((p, i) =>
        `${(i + 1).toString().padStart(3)}|${p.name}|$${p.priceSale}|${p._id}`
    );
    const filename = `scripts/dump-${slug}.txt`;
    fs.writeFileSync(filename, lines.join('\n'), 'utf8');
    console.log(`\nDone: ${all.length} products → ${filename}`);
}

main().catch(console.error);
