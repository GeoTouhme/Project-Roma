const fs = require('fs');

// Define what keywords belong in each category
const CATEGORY_KEYWORDS = {
    'beer': ['beer', 'ale', 'lager', 'stout', 'ipa', 'porter', 'pilsner', 'hef', 'bud', 'coors', 'miller', 'corona', 'modelo', 'heineken', 'stella', 'guiness', 'guinness', 'pacifico', 'dos equis', 'tecate', 'negra', 'michelob', 'busch', 'pbr', 'pabst', 'keystone', 'natty', 'natural light', 'rolling rock', 'samuel adams', 'blue moon', 'sierra nevada', 'lagunitas', 'dogfish', 'yuengling', 'craft brew', 'sapporo', 'kirin', 'asahi', 'tsingtao', 'peroni', 'moretti', 'carlsberg', 'fosters', 'victoria', 'bohemia', 'montejo', 'carta blanca', 'sol ', '805 ', 'schlenkerla', 'smokebeer'],
    'wine': ['wine', 'cabernet', 'merlot', 'chardonnay', 'pinot', 'sauvignon', 'shiraz', 'syrah', 'riesling', 'moscato', 'prosecco', 'champagne', 'brut', 'rose', 'rosé', 'zinfandel', 'malbec', 'sangria', 'port ', 'bordeaux', 'burgundy', 'chianti', 'barolo', 'rioja', 'tempranillo', 'cava', 'sparkling', 'barefoot', 'stella rosa', 'apothic', 'josh ', 'la marca', 'yellowtail', 'cupcake', 'woodbridge', 'kendall', 'sutter', 'beringer', 'robert mondavi', 'black box', 'bota box', 'franzia', 'carlo rossi', 'bogle', 'decoy', 'meiomi', 'kim crawford'],
    'vodka': ['vodka', 'smirnoff', 'absolut', 'grey goose', 'ketel one', 'titos', "tito's", 'belvedere', 'ciroc', 'stolichnaya', 'stoli', 'skyy', 'svedka', 'pinnacle', 'new amsterdam vodka', 'deep eddy'],
    'tequila': ['tequila', 'mezcal', 'patron', 'casamigos', 'don julio', 'clase azul', 'espolon', 'hornitos', 'herradura', 'jose cuervo', 'milagro', 'olmeca', 'corralejo', 'cazadores', 'sauza', 'avion', 'teremana', 'cincoro', 'lobos', 'codigo', '1800 ', 'agave'],
    'whiskey': ['whiskey', 'whisky', 'bourbon', 'scotch', 'rye ', 'jack daniel', 'jim beam', 'maker', 'bulleit', 'crown royal', 'jameson', 'johnnie walker', 'glenfiddich', 'glenlivet', 'macallan', 'woodford', 'buffalo trace', 'wild turkey', 'evan williams', 'fireball', 'knob creek', 'basil hayden', 'angel', 'bushmills', 'tullamore', 'redbreast', 'laphroaig', 'lagavulin', 'oban', 'highland park', 'monkey shoulder', 'dewars', 'gentleman jack', 'old forester', 'elijah craig', 'four roses', 'weller', 'blanton', 'eagle rare', 'hennessy', 'proper twelve'],
    'rum': ['rum', 'bacardi', 'captain morgan', 'malibu', 'kraken', 'havana club', 'mount gay', 'appleton', 'myers', 'sailor jerry', 'ron '],
    'gin': ['gin ', ' gin', 'tanqueray', 'bombay', 'hendrick', 'beefeater', 'botanist', 'monkey 47', 'fords gin', 'roku', 'aviation', 'new amsterdam gin', 'sapphire'],
    'soda': ['coca-cola', 'coke', 'pepsi', 'sprite', 'fanta', '7up', '7-up', 'dr pepper', 'mountain dew', 'root beer', 'ginger ale', 'tonic', 'club soda', 'seltzer water', 'schweppes', 'canada dry', 'a&w', 'crush', 'sunkist soda', 'jarritos', 'bundaberg'],
    'water': ['water', 'h2o', 'aquafina', 'dasani', 'fiji', 'evian', 'essentia', 'smartwater', 'voss', 'perrier water', 'san pellegrino water', 'poland spring', 'crystal geyser', 'arrowhead', 'deer park', 'ice mountain', 'ozarka', 'zephyrhills'],
    'energy-drinks': ['energy', 'red bull', 'monster', 'celsius', 'bang', 'reign', 'rockstar', 'c4 ', 'ghost ', 'nos ', 'bucked up', '3d energy', 'alani nu', 'prime ', 'gfuel', 'xyience', 'raze', 'zoa'],
    'snacks': ['chips', 'pretzels', 'popcorn', 'nuts', 'jerky', 'trail mix', 'crackers', 'granola', 'protein bar', 'slim jim', 'corn nuts', 'pringles', 'doritos', 'cheetos', 'fritos', 'ruffles', "lay's", 'lays', 'tostitos', 'sun chips', 'kettle', 'cheez-it', 'goldfish', 'wheat thins', 'triscuit', 'ritz', 'jack link', 'david', 'pistachio', 'peanut', 'almond', 'cashew', 'sunflower', 'bugles', 'funyun', 'combos', 'chex mix', 'gardetto', 'takis', 'munchies', 'smartfood'],
    'candy': ['candy', 'chocolate', 'gummy', 'gummies', 'sour patch', 'skittles', 'starburst', 'twizzlers', 'reese', 'snickers', 'kit kat', 'butterfinger', 'm&m', 'haribo', 'swedish fish', 'mike and ike', 'nerds', 'airhead', 'jolly rancher', 'lemonhead', 'red vines', 'peach rings', 'sour belt', 'trolli', 'pop rocks', 'ring pop', 'blow pop', 'dum dum', 'tootsie', 'laffy taffy'],
    'gum-mints': ['gum', 'mint', 'trident', 'orbit', 'extra ', '5 gum', 'dentyne', 'hubba bubba', 'big red', 'doublemint', 'juicy fruit', 'wrigley', 'mentos', 'altoid', 'tic tac', 'breathsaver', 'ice breaker'],
    'pharmacy-care': ['advil', 'tylenol', 'aspirin', 'ibuprofen', 'pepto', 'tums', 'dayquil', 'nyquil', 'mucinex', 'benadryl', 'zyrtec', 'claritin', 'motrin', 'excedrin', 'aleve', 'midol', 'vicks', 'robitussin', 'band-aid', 'neosporin', 'hydrocortisone', 'calamine', 'visine', 'toothbrush', 'toothpaste', 'deodorant', 'shampoo', 'conditioner', 'lotion', 'sunscreen', 'hand sanitizer', 'soap', 'condom', 'trojan', 'tampon', 'pad ', 'listerine', 'mouthwash', 'floss', 'razor', 'shaving', 'body wash', 'colgate', 'speed stick', 'old spice', 'axe ', 'dove'],
    'grocery': ['bread', 'milk', 'butter', 'cheese', 'egg', 'flour', 'sugar', 'salt', 'pepper', 'oil', 'vinegar', 'sauce', 'ketchup', 'mustard', 'mayo', 'ranch', 'bbq', 'salsa', 'pasta', 'rice', 'bean', 'soup', 'cereal', 'oatmeal', 'pancake', 'syrup', 'honey', 'jam', 'jelly', 'peanut butter', 'nutella', 'coffee', 'tea', 'cream', 'tide', 'gain', 'dawn', 'windex', 'lysol', 'clorox', 'ziploc', 'glad', 'reynolds', 'kraft', 'heinz'],
    'accessories': ['lighter', 'zippo', 'rolling paper', 'pipe', 'ashtray', 'cigar cutter', 'wine opener', 'bottle opener', 'corkscrew', 'ice bucket', 'cooler', 'cup', 'glass', 'shot glass', 'flask', 'coaster', 'napkin', 'straw', 'toothpick', 'plate', 'bowl', 'utensil', 'battery', 'duracell', 'charger', 'phone', 'headphone', 'tape', 'glue', 'scissor'],
    'cocktails-seltzers': ['seltzer', 'hard seltzer', 'white claw', 'truly', 'high noon', 'bud light seltzer', 'topo chico hard', 'vizzy', 'press', 'bon & viv', 'corona seltzer', 'arctic chill', 'smirnoff ice', 'mike\'s hard', "mike's hard", 'twisted tea', 'four loko', 'buzzballz', 'daily\'s', 'cutwater', 'on the rocks', 'negroni', 'margarita', 'paloma', 'mule', 'mojito', 'daiquiri', 'pina colada', 'bloody mary', 'aperol', 'campari'],
    'juice-drinks': ['juice', 'lemonade', 'tea ', 'iced tea', 'gatorade', 'powerade', 'body armor', 'vitamin water', 'coconut water', 'aloe', 'v8', 'ocean spray', 'tropicana', 'minute maid', 'simply', 'naked juice', 'bolthouse', 'welch', 'capri sun', 'kool-aid', 'arizona', 'snapple', 'lipton', 'brisk'],
    'tea-coffee': ['tea', 'coffee', 'espresso', 'latte', 'cappuccino', 'mocha', 'cold brew', 'starbucks', 'monster java', 'dunkin', 'nescafe', 'folgers', 'maxwell house', 'green mountain', 'keurig', 'k-cup', 'matcha', 'chai', 'herbal tea', 'oolong', 'black tea', 'green tea', 'chamomile'],
    'ice-cream': ['ice cream', 'gelato', 'sorbet', 'frozen yogurt', 'popsicle', 'haagen-dazs', 'ben & jerry', 'baskin', 'klondike', 'drumstick', 'magnum', 'outshine', 'talenti', 'breyers'],
    'liqueur-spirits': ['liqueur', 'amaretto', 'baileys', 'kahlua', 'grand marnier', 'cointreau', 'triple sec', 'sambuca', 'chartreuse', 'absinthe', 'schnapps', 'disaronno', 'frangelico', 'drambuie', 'pernod', 'st. germain', 'aperol', 'campari', 'fernet', 'jagermeister', 'fireball', 'hennessy', 'cognac', 'brandy', 'remy martin', 'courvoisier', 'martell'],
};

const DUMPS = fs.readdirSync('scripts').filter(f => f.startsWith('dump-') && f.endsWith('.txt'));

let totalMisclassified = 0;
const report = [];

for (const file of DUMPS) {
    const slug = file.replace('dump-', '').replace('.txt', '');
    const content = fs.readFileSync(`scripts/${file}`, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    const myKeywords = CATEGORY_KEYWORDS[slug] || [];
    const suspicious = [];
    
    for (const line of lines) {
        const parts = line.split('|');
        if (parts.length < 4) continue;
        const name = parts[1].toLowerCase();
        const id = parts[3].trim();
        
        // Check if this product name matches ANY keyword for this category
        const belongsHere = myKeywords.some(k => name.includes(k.toLowerCase()));
        
        if (!belongsHere) {
            // Check which category it SHOULD be in
            let bestMatch = null;
            for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
                if (cat === slug) continue;
                if (kws.some(k => name.includes(k.toLowerCase()))) {
                    bestMatch = cat;
                    break;
                }
            }
            suspicious.push({ name: parts[1], id, suggestedCat: bestMatch || 'UNKNOWN' });
        }
    }
    
    if (suspicious.length > 0) {
        totalMisclassified += suspicious.length;
        report.push(`\n${'='.repeat(60)}`);
        report.push(`CATEGORY: ${slug.toUpperCase()} (${lines.length} total, ${suspicious.length} suspicious)`);
        report.push(`${'='.repeat(60)}`);
        for (const s of suspicious) {
            report.push(`  [${s.suggestedCat.padEnd(20)}] ${s.name} (${s.id})`);
        }
    } else {
        report.push(`\n✅ ${slug.toUpperCase()} (${lines.length} products) — looks clean`);
    }
}

report.unshift(`\n${'='.repeat(60)}`);
report.unshift(`TOTAL SUSPICIOUS: ${totalMisclassified} across all categories`);
report.unshift(`${'='.repeat(60)}`);

const output = report.join('\n');
console.log(output);
fs.writeFileSync('scripts/category-audit-report.txt', output, 'utf8');
console.log('\n\nReport saved to scripts/category-audit-report.txt');
