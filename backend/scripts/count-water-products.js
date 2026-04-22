const fs = require('fs');

const CATEGORIES_TO_CHECK = [
    'gum-mints',
    'soda',
    'energy-drinks',
    'whiskey',
    'tequila',
    'vodka',
    'beer',
    'wine',
    'snacks',
    'candy',
    'rum',
    'cocktails-seltzers',
    'grocery',
    'accessories',
    'pharmacy-care',
    'juice-drinks',
    'tea-coffee',
    'ice-cream',
    'liqueur-spirits',
];

async function fetchAll(slug) {
    let all = [];
    let page = 1;
    while (true) {
        const res = await fetch(`https://balportliquors.com/api/products?category=${slug}&limit=100&page=${page}`);
        const data = await res.json();
        all = all.concat(data.data);
        if (all.length >= data.total) break;
        page++;
    }
    return all;
}

async function main() {
    for (const slug of CATEGORIES_TO_CHECK) {
        console.log(`\nFetching ${slug}...`);
        const products = await fetchAll(slug);
        const lines = products.map((p, i) =>
            `${(i + 1).toString().padStart(3)}|${p.name}|$${p.priceSale}|${p._id}`
        );
        const filename = `scripts/dump-${slug}.txt`;
        fs.writeFileSync(filename, lines.join('\n'), 'utf8');
        console.log(`  → ${products.length} products → ${filename}`);
    }
    console.log('\nDone! All category dumps saved.');
}

main().catch(console.error);
