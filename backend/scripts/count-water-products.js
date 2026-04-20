/**
 * Dump ALL Water products to a text file for analysis 
 */
const fs = require('fs');

async function main() {
    let allProducts = [];
    let page = 1;
    const limit = 100;
    
    while (true) {
        const res = await fetch(`https://balportliquors.com/api/products?category=water&limit=${limit}&page=${page}`);
        const data = await res.json();
        allProducts = allProducts.concat(data.data);
        if (allProducts.length >= data.total) break;
        page++;
    }

    const lines = allProducts.map((p, i) => 
        `${(i+1).toString().padStart(3)}|${p.name}|$${p.priceSale}|${p._id}`
    );
    
    fs.writeFileSync('scripts/water-products-dump.txt', lines.join('\n'), 'utf8');
    console.log(`Wrote ${allProducts.length} products to water-products-dump.txt`);
}

main().catch(e => console.error(e));
