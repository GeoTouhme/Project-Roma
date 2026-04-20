/**
 * ============================================================
 *  FIX WATER CATEGORY — Migration Script
 *  Bal-Port Liquors — Project Roma
 * ============================================================
 *  
 *  This script moves misclassified products OUT of the "WATER"
 *  category into their correct categories.
 *
 *  Usage (on the server, inside the backend container or with
 *  access to MongoDB):
 *
 *    DRY RUN (default — no changes):
 *      MONGODB_URI=mongodb://mongodb:27017/liquor_shop node scripts/fix-water-category.js
 *
 *    LIVE RUN (actually updates the DB):
 *      MONGODB_URI=mongodb://mongodb:27017/liquor_shop DRY_RUN=false node scripts/fix-water-category.js
 *
 * ============================================================
 */

const mongoose = require('mongoose');
require('dotenv').config();

// ─── Category & SubCategory IDs ──────────────────────────────
const CATEGORIES = {
  WATER:            { cat: '69bc41216f0fa539b06ef9c5', sub: '69bc41216f0fa539b06ef9c6' },
  CANDY:            { cat: '69bc457f6f0fa539b06efbb7', sub: '69bc457f6f0fa539b06efbb8' },
  GUM_MINTS:        { cat: '69bd4c23013d204dfbd805db', sub: '69bd4c23013d204dfbd805dc' },
  ENERGY_DRINKS:    { cat: '69bc41246f0fa539b06ef9c9', sub: '69bc41246f0fa539b06ef9ca' },
  JUICE_DRINKS:     { cat: '69bd4c23013d204dfbd805df', sub: '69bd4c23013d204dfbd805e0' },
  JUICE:            { cat: '69bc41416f0fa539b06ef9d9', sub: '69bc41416f0fa539b06ef9da' },
  BEER:             { cat: '69bc42556f0fa539b06efa4f', sub: '69bc42556f0fa539b06efa50' },
  COCKTAILS:        { cat: '69bd4c23013d204dfbd805e3', sub: '69bd4c23013d204dfbd805e4' },
  WINE:             { cat: '69bc40df6f0fa539b06ef992', sub: '69bc40df6f0fa539b06ef993' },
  LIQUEUR_SPIRITS:  { cat: '69bd4c23013d204dfbd805e5', sub: '69bd4c23013d204dfbd805e6' },
  SNACKS:           { cat: '69bc42216f0fa539b06efa36', sub: '69bc42216f0fa539b06efa37' },
  SODA:             { cat: '69bc40b96f0fa539b06ef96d', sub: '69bc40b96f0fa539b06ef96e' },
  GROCERY:          { cat: '69bc40bc6f0fa539b06ef971', sub: '69bc40bc6f0fa539b06ef972' },
  PHARMACY:         { cat: '69bd4c23013d204dfbd805e1', sub: '69bd4c23013d204dfbd805e2' },
  ACCESSORIES:      { cat: '69bc40f46f0fa539b06ef9a7', sub: '69bc40f46f0fa539b06ef9a8' },
  TEQUILA:          { cat: '69bc40b76f0fa539b06ef96a', sub: '69bc40b76f0fa539b06ef96b' },
};

// ─── Product-to-Category mapping by exact product ID ─────────
// Each entry: productId => target category key
const PRODUCT_MOVES = {
  // ──────────────────────────────────────────────────────────
  // CANDY (watermelon candies, sour candy, fruit snacks)
  // ──────────────────────────────────────────────────────────
  '69bc66526f0fa539b06f0c66': 'CANDY',        // Lucas Mueces Watermelon
  '69bc506b6f0fa539b06f0127': 'CANDY',        // AIR HEAD WATERMELON
  '69bc504f6f0fa539b06f0118': 'CANDY',        // Air Heads Watermelon (0.55 oz)
  '69bc4f6c6f0fa539b06f00ab': 'CANDY',        // MIKE AND IKE SOUR WATERMELON 4.25 oz
  '69bc4edb6f0fa539b06f006c': 'CANDY',        // SOUR PATCH WATERMELO 2 OZ
  '69bc4ed56f0fa539b06f0069': 'CANDY',        // SOUR PATCH KID WATERMELON 8OZ
  '69bc4c6c6f0fa539b06eff2d': 'CANDY',        // HARIBO WATERMELON
  '69bc4beb6f0fa539b06efee2': 'CANDY',        // TROLLI GUMMY SOUR BRITE CRAWLERS FRUIT
  '69bc4b8d6f0fa539b06efeb0': 'CANDY',        // Baby Bottle Pop Watermelon (1.1 oz)
  '69bc4b1a6f0fa539b06efe79': 'CANDY',        // STRBRST FAVE REDS 2.07 OZ
  '69bc48e36f0fa539b06efd64': 'CANDY',        // WAREHEAD SOUR WATERMELON SQUEZE CANDY
  '69bc45c56f0fa539b06efbda': 'CANDY',        // WILLY WALLABG WATERMELON
  '69bc42856f0fa539b06efa65': 'CANDY',        // GUSHERS WATERMELON & SOUR APPLE
  '69bc42c06f0fa539b06efa84': 'CANDY',        // Crazy sandia WATERMELON
  '69bc5f7f6f0fa539b06f08d0': 'CANDY',        // SOUR TOOTH WATERMELOM SLICES
  '69bc52d26f0fa539b06f0259': 'CANDY',        // NERDS CHERRY WATERMELON
  '69bc604a6f0fa539b06f093d': 'CANDY',        // POP ROCKS WATERMELON
  '69bc607a6f0fa539b06f0957': 'CANDY',        // Skwinkles Salsagheti Watermelon
  '69bc5e7d6f0fa539b06f084b': 'CANDY',        // All the Candy Arizona Sour Watermelon Fruit Snacks
  '69bc5e526f0fa539b06f0834': 'CANDY',        // Arizona Fruit Snacks Mixed Fruit

  // ──────────────────────────────────────────────────────────
  // GUM & MINTS
  // ──────────────────────────────────────────────────────────
  '69bc50946f0fa539b06f013c': 'GUM_MINTS',    // TRIDENT WATERMELON TWIST
  '69bc45876f0fa539b06efbbb': 'GUM_MINTS',    // EXTRA WATERMELON 35STICKS
  '69bc45776f0fa539b06efbb2': 'GUM_MINTS',    // 5 GUM WATERMELON
  '69bc452f6f0fa539b06efb91': 'GUM_MINTS',    // EXTRA SWEET WATERMEL

  // ──────────────────────────────────────────────────────────
  // ENERGY DRINKS
  // ──────────────────────────────────────────────────────────
  '69bc65aa6f0fa539b06f0c13': 'ENERGY_DRINKS',  // CELSIUS WATERMELON
  '69bc65a66f0fa539b06f0c11': 'ENERGY_DRINKS',  // CELSIUS WATERMELON LEMONADE
  '69bc65a36f0fa539b06f0c10': 'ENERGY_DRINKS',  // CELSIUS WATERMELON 12OZ
  '69bc654c6f0fa539b06f0be4': 'ENERGY_DRINKS',  // AI ENERGY WATERMELON 12/12 CAN
  '69bc623a6f0fa539b06f0a47': 'ENERGY_DRINKS',  // GHOST BLUE RASPBERRY
  '69bc61d76f0fa539b06f0a10': 'ENERGY_DRINKS',  // GHOST ENERGY WARHEADS SOUR WATERMELON
  '69bc4f1b6f0fa539b06f0088': 'ENERGY_DRINKS',  // Monster WATERMELON
  '69bc5e336f0fa539b06f0824': 'ENERGY_DRINKS',  // RED BULL RED WATERMELON
  '69bc5e326f0fa539b06f0823': 'ENERGY_DRINKS',  // Red Bull Red Edition Watermelon 8.4 Oz
  '69bc5def6f0fa539b06f0806': 'ENERGY_DRINKS',  // REDBULL RED WATERMELON
  '69bc5ded6f0fa539b06f0805': 'ENERGY_DRINKS',  // REDBULL RED EDITION (WATERMELON)
  '69bc5deb6f0fa539b06f0804': 'ENERGY_DRINKS',  // Red Bull Variety Pack 12 Cans
  '69bc5ddf6f0fa539b06f07fc': 'ENERGY_DRINKS',  // Red Bull Amber Edition Strawberry Apricot

  // ──────────────────────────────────────────────────────────
  // JUICE & DRINKS (sparkling ice, la croix, coconut water,
  //   spindrift, ocean bomb, bubly, vitamin water, etc.)
  // ──────────────────────────────────────────────────────────
  '69bc66096f0fa539b06f0c3e': 'JUICE_DRINKS', // OCEANBOMB ORANGE
  '69bc66086f0fa539b06f0c3d': 'JUICE_DRINKS', // OCEAN BOMB MELON FLAVOR
  '69bc65fe6f0fa539b06f0c38': 'JUICE_DRINKS', // VITA COCOC ORANGE CREME
  '69bc65fd6f0fa539b06f0c37': 'JUICE_DRINKS', // vita coco can with pulp
  '69bc65fb6f0fa539b06f0c36': 'JUICE_DRINKS', // VITA COCO WATER WITH PRESSED COCONUT
  '69bc65f96f0fa539b06f0c35': 'JUICE_DRINKS', // Vita Coco 100% Pure
  '69bc65476f0fa539b06f0be1': 'JUICE_DRINKS', // MELA WATERMELON WATER + CHILI MANGO
  '69bc650f6f0fa539b06f0bd2': 'JUICE_DRINKS', // WET HYDRATION WATERMELON LIME
  '69bc64ea6f0fa539b06f0bc8': 'JUICE_DRINKS', // MELA WATERMELON WATER + PASSION FRUIT
  '69bc64e66f0fa539b06f0bc6': 'JUICE_DRINKS', // MELA WATERMELON WATER
  '69bc64d66f0fa539b06f0bbd': 'JUICE_DRINKS', // HARNLESS HARVET COCO WATER 16 OZ
  '69bc64cd6f0fa539b06f0bb8': 'JUICE_DRINKS', // Bodyarmor Sport Water  (sports drink)
  '69bc649e6f0fa539b06f0b9b': 'JUICE_DRINKS', // SPINDRIFT LIME SPARKLING WATER 12 OZ
  '69bc649c6f0fa539b06f0b9a': 'JUICE_DRINKS', // Spindrift
  '69bc649b6f0fa539b06f0b99': 'JUICE_DRINKS', // Spindrift GRAPEFRUIT
  '69bc64626f0fa539b06f0b7b': 'JUICE_DRINKS', // C2O COCONUT WATER PULP
  '69bc64606f0fa539b06f0b7a': 'JUICE_DRINKS', // C2O COCONUT WATER PURE
  '69bc63526f0fa539b06f0ae5': 'JUICE_DRINKS', // HARMLESS SMOOTHIE
  '69bc634a6f0fa539b06f0ae0': 'JUICE_DRINKS', // Recess Black Cherry NA CBD
  '69bc62166f0fa539b06f0a33': 'JUICE_DRINKS', // HARMLESS ORGANIC COCONUT WATER WITH WATERMELON
  '69bc62146f0fa539b06f0a32': 'JUICE_DRINKS', // HARMLESS ORGANIC SPARKLING COCONUT WATER
  '69bc62126f0fa539b06f0a31': 'JUICE_DRINKS', // HARMLES HARVET 10 OZ
  '69bc62116f0fa539b06f0a30': 'JUICE_DRINKS', // HARNLESS H COCO WATR WITH PULP 16 OZ
  '69bc63ae6f0fa539b06f0b1c': 'JUICE_DRINKS', // OLIPOP WATERMELON LIME  (prebiotic soda/drink)
  '69bc5eaf6f0fa539b06f086a': 'JUICE_DRINKS', // YERBA MADRE WATERMELODY
  '69bc5e5c6f0fa539b06f0838': 'JUICE_DRINKS', // ARIZONA WATERMELON
  '69bc5e4b6f0fa539b06f0831': 'JUICE_DRINKS', // Arizona Watermelon Bottle (20 oz)
  '69bc5e486f0fa539b06f082f': 'JUICE_DRINKS', // AriZona Fruit Juice Cocktail Watermelon
  '69bc5ca06f0fa539b06f076b': 'JUICE_DRINKS', // TARA WATERMELON
  '69bc465c6f0fa539b06efc2b': 'JUICE_DRINKS', // simply waternelon
  '69bc46096f0fa539b06efc00': 'JUICE_DRINKS', // PARROT WATERMELON
  '69bc46016f0fa539b06efbfb': 'JUICE_DRINKS', // PARROT ALOE VERA DRINK WATERMELON
  '69bc45fa6f0fa539b06efbf6': 'JUICE_DRINKS', // Parrot Coconut Water (16.4 oz)
  '69bc42b76f0fa539b06efa7f': 'JUICE_DRINKS', // SPARKLING ICE ORANGE ZERO
  '69bc42b56f0fa539b06efa7e': 'JUICE_DRINKS', // SPARKLING ICE STRAWBERRY ZERO
  '69bc42b46f0fa539b06efa7d': 'JUICE_DRINKS', // SPARKLING ICE GRAP RASPRY 17OZ
  '69bc42b16f0fa539b06efa7c': 'JUICE_DRINKS', // Sparkling Ice Black Cherry
  '69bc42af6f0fa539b06efa7b': 'JUICE_DRINKS', // Sparkling Ice - Strawberry Watermelon
  '69bc42ab6f0fa539b06efa7a': 'JUICE_DRINKS', // Sparkling Ice Cherry Limeade
  '69bc42a96f0fa539b06efa79': 'JUICE_DRINKS', // ICE SPARKLING LEMONADE 17 OZ
  '69bc42a76f0fa539b06efa78': 'JUICE_DRINKS', // Sparkling Ice Coconut Pineapple
  '69bc42a56f0fa539b06efa77': 'JUICE_DRINKS', // SPARKLING ICE LEMON LIME ZERO
  '69bc42a46f0fa539b06efa76': 'JUICE_DRINKS', // Sparkling Ice:Pink Grapefruit
  '69bc42a26f0fa539b06efa75': 'JUICE_DRINKS', // Sparkling Ice Kiwi Strawberry
  '69bc42a06f0fa539b06efa74': 'JUICE_DRINKS', // Sparkling Ice Orange Mango
  '69bc429e6f0fa539b06efa73': 'JUICE_DRINKS', // Sparkling Ice Black Raspberry
  '69bc50486f0fa539b06f0114': 'JUICE_DRINKS', // La Croix:Natural Berry 12 Oz
  '69bc50476f0fa539b06f0113': 'JUICE_DRINKS', // La Croix:Natural Lemon 12 Oz
  '69bc42176f0fa539b06efa2d': 'JUICE_DRINKS', // La Croix:Grapefruit Pamplemousse 12 Oz c
  '69bc42156f0fa539b06efa2c': 'JUICE_DRINKS', // La Croix:Grapefruit Pamplemousse
  '69bc417c6f0fa539b06ef9f5': 'JUICE_DRINKS', // BUBLY BLACKBERRY
  '69bc417a6f0fa539b06ef9f4': 'JUICE_DRINKS', // BUBLY LIME
  '69bc63f56f0fa539b06f0b43': 'JUICE_DRINKS', // hawaii
  // Vitamin Water — it's a flavored drink, not plain water
  '69bc61926f0fa539b06f09ec': 'JUICE_DRINKS', // VITAMIN WATER BLUEBERRY POMEGRANATE XXX
  '69bc618f6f0fa539b06f09eb': 'JUICE_DRINKS', // VITAMIN WATER TROPICAL CITRUS ENERGY
  '69bc618d6f0fa539b06f09ea': 'JUICE_DRINKS', // VITAMINWATER KIWI-STRAWBERRY
  '69bc618b6f0fa539b06f09e9': 'JUICE_DRINKS', // Glaceau Vitamin Water Essential Orange
  '69bc61876f0fa539b06f09e7': 'JUICE_DRINKS', // VITAMIN WATER DRAGONFRUIT
  '69bc61846f0fa539b06f09e5': 'JUICE_DRINKS', // Vitaminwater Refresh Tropical Mango
  '69bc61816f0fa539b06f09e4': 'JUICE_DRINKS', // Glaceau Vitamin Water Dragonfruit (32 oz)
  '69bc617f6f0fa539b06f09e3': 'JUICE_DRINKS', // Glaceau Vitamin Water Zero Rise Orange
  '69bc617d6f0fa539b06f09e2': 'JUICE_DRINKS', // Glaceau Vitamin Water Zero Squeezed Lemonade
  '69bc617b6f0fa539b06f09e1': 'JUICE_DRINKS', // Glaceau Vitamin Water Zero XXX
  '69bc65536f0fa539b06f0be8': 'JUICE_DRINKS', // AIR HEADS SODA WATERMELON  (it's a soda/drink)

  // ──────────────────────────────────────────────────────────
  // SODA (club soda, tonic water, mixers)
  // ──────────────────────────────────────────────────────────
  '69bc52bb6f0fa539b06f024e': 'SODA',         // SCHWEPPES CLUB SODA
  '69bc62a46f0fa539b06f0a84': 'SODA',         // FEVER TREE PINK GRAPEFRUIT
  '69bc5bfb6f0fa539b06f070f': 'SODA',         // Jarritos Mineragua Sparkling Water

  // ──────────────────────────────────────────────────────────
  // BEER / COCKTAILS & SELTZERS (alcoholic beverages)
  // ──────────────────────────────────────────────────────────
  '69bc65ca6f0fa539b06f0c22': 'COCKTAILS',    // Four Loko Watermelon Singles
  '69bc65b76f0fa539b06f0c1b': 'COCKTAILS',    // MONACO WATERMELON CRUSH
  '69bc64786f0fa539b06f0b87': 'COCKTAILS',    // BuzzBallz Watermelon Smash
  '69bc63fa6f0fa539b06f0b47': 'COCKTAILS',    // BEATBOX FRESH WATERMELON
  '69bc446d6f0fa539b06efb32': 'BEER',         // BUD LT WATERMELON RITA
  '69bc44396f0fa539b06efb20': 'BEER',         // RITA WATERMELON 25OZ
  '69bc44356f0fa539b06efb1e': 'BEER',         // NATTY RUSH WATERMELON
  '69bc5b6f6f0fa539b06f06c0': 'LIQUEUR_SPIRITS', // 99 WATERMELON (99 brand schnapps)
  // White Claw — hard seltzers
  '69bc5f216f0fa539b06f08a0': 'COCKTAILS',    // WHITE CLAW WATERMELON 19.20 OZ
  '69bc5f206f0fa539b06f089f': 'COCKTAILS',    // White Claw Black Cherry 19oz
  '69bc5f196f0fa539b06f089c': 'COCKTAILS',    // White Claw Surf Variety Pack 12oz  
  '69bc5f146f0fa539b06f0899': 'COCKTAILS',    // White Claw Watermelon Cans 12oz
  '69bc5f0e6f0fa539b06f0896': 'COCKTAILS',    // White Claw Variety Pack #2 12oz
  '69bc5f046f0fa539b06f0892': 'COCKTAILS',    // White Claw Raspberry 12oz
  '69bc5ef16f0fa539b06f0889': 'COCKTAILS',    // White Claw Ruby Grapefruit 6pk
  '69bc5edc6f0fa539b06f0881': 'COCKTAILS',    // White Claw Mango 12oz
  // Topo Chico Hard Seltzer (the $19.99+ ones)
  '69bc44f76f0fa539b06efb76': 'COCKTAILS',    // TOPO CHICO TROPICAL MANGO $19.99
  '69bc44f66f0fa539b06efb75': 'COCKTAILS',    // TOPO CHICO RASPBERRY WITH LEMON $19.99
  '69bc44f46f0fa539b06efb74': 'COCKTAILS',    // TAPO CHICO TANGERINE $19.99
  '69bc44f36f0fa539b06efb73': 'COCKTAILS',    // TOPO CHICO LIME WITH MINT $19.99
  '69bc44f16f0fa539b06efb72': 'COCKTAILS',    // TOPO CHICO BLUE BERRY $19.99
  '69bc44e96f0fa539b06efb6e': 'COCKTAILS',    // TOPO CHICO VARIETY PACK C24 12OZ 12P $25.99
  '69bc621d6f0fa539b06f0a37': 'COCKTAILS',    // TOPO CHICO MARGARITA VARIETY
  '69bc621b6f0fa539b06f0a36': 'COCKTAILS',    // TOPO CHICO STRAWBERRY GUAVA B24 12OZ $23.99
  '69bc62196f0fa539b06f0a35': 'COCKTAILS',    // TOPO CHICO RANCH WATER 24 OZ
  '69bc62186f0fa539b06f0a34': 'COCKTAILS',    // TOPO CHICO RANCH WATER C24 12OZ 12P $25.99
  '69bc62266f0fa539b06f0a3c': 'COCKTAILS',    // FROZEN WATERMELON ($24.99 — likely alcoholic frozen drink)

  // ──────────────────────────────────────────────────────────
  // WINE
  // ──────────────────────────────────────────────────────────
  '69bc59fb6f0fa539b06f0601': 'WINE',         // STELLA ROSA WATERMELON 750ML
  '69bc40fd6f0fa539b06ef9ac': 'WINE',         // PERRIER JOUET BRUT 750 mm ($85.99 champagne)
  '69bc64356f0fa539b06f0b60': 'WINE',         // PERRIER JOUET 750 ($159.99 champagne)

  // ──────────────────────────────────────────────────────────
  // SNACKS
  // ──────────────────────────────────────────────────────────
  '69bc48366f0fa539b06efd1f': 'SNACKS',       // Lay's sweet southern heat
  '69bc59616f0fa539b06f05a8': 'SNACKS',       // snak club watermelon 5 oz

  // ──────────────────────────────────────────────────────────
  // GROCERY
  // ──────────────────────────────────────────────────────────
  '69bc44d26f0fa539b06efb62': 'GROCERY',      // KRAFT EASY MAC 2.05 OZ

  // ──────────────────────────────────────────────────────────
  // PHARMACY & CARE
  // ──────────────────────────────────────────────────────────
  '69bc5d356f0fa539b06f07b2': 'PHARMACY',     // Aveeno Daily Moisturizing Lotion
  '69bc5d296f0fa539b06f07ab': 'PHARMACY',     // Mclane Company Lil Drug Midol
  '69bc5d026f0fa539b06f0796': 'PHARMACY',     // Vicks Dayquil Cold Flu
  '69bc5cff6f0fa539b06f0794': 'PHARMACY',     // Vicks Cold Flu Nighttime
  '69bc5cc56f0fa539b06f0775': 'PHARMACY',     // Pepto-Bismol Maximum Strength

  // ──────────────────────────────────────────────────────────
  // ACCESSORIES (non-consumable)
  // ──────────────────────────────────────────────────────────
  '69bc60e26f0fa539b06f0992': 'ACCESSORIES',  // WATER BAKLLOONS 100 PACK

  // ──────────────────────────────────────────────────────────
  // VAPE / E-CIG → ACCESSORIES (or TORCH if that's vape)
  // ──────────────────────────────────────────────────────────
  '69bc64286f0fa539b06f0b5a': 'ACCESSORIES',  // WATERMELON ICE (likely vape flavor)
};


// ─── Main ────────────────────────────────────────────────────
async function main() {
  const DRY_RUN = process.env.DRY_RUN !== 'false';
  const uri = process.env.MONGODB_URI || 'mongodb://mongodb:27017/liquor_shop';

  console.log('═══════════════════════════════════════════════════════');
  console.log('  FIX WATER CATEGORY — Migration Script');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Mode:     ${DRY_RUN ? '🔍 DRY RUN (no changes)' : '🔴 LIVE RUN (will update DB!)'}`);
  console.log(`  MongoDB:  ${uri.replace(/\/\/.*@/, '//***@')}`);
  console.log('═══════════════════════════════════════════════════════\n');

  await mongoose.connect(uri);
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;

  // Verify Water category exists
  const waterCat = await db.collection('categories').findOne({ 
    _id: new mongoose.Types.ObjectId(CATEGORIES.WATER.cat) 
  });
  if (!waterCat) {
    console.log('❌ WATER category not found in DB! Aborting.');
    await mongoose.disconnect();
    return;
  }

  // Count current Water products
  const beforeCount = await db.collection('products').countDocuments({ 
    category: new mongoose.Types.ObjectId(CATEGORIES.WATER.cat) 
  });
  console.log(`📊 Products currently in WATER: ${beforeCount}\n`);

  // Process each move
  const totalMoves = Object.keys(PRODUCT_MOVES).length;
  let successCount = 0;
  let errorCount = 0;
  let notFoundCount = 0;
  const moveSummary = {};

  for (const [productId, targetKey] of Object.entries(PRODUCT_MOVES)) {
    const target = CATEGORIES[targetKey];
    if (!target) {
      console.log(`  ⚠️  Unknown category key: ${targetKey} for product ${productId}`);
      errorCount++;
      continue;
    }

    // Find the product
    const product = await db.collection('products').findOne({ 
      _id: new mongoose.Types.ObjectId(productId) 
    });

    if (!product) {
      console.log(`  ⚠️  Product NOT FOUND: ${productId}`);
      notFoundCount++;
      continue;
    }

    // Check if it's actually in the Water category
    const currentCatId = product.category?.toString();
    if (currentCatId !== CATEGORIES.WATER.cat) {
      console.log(`  ⏭️  SKIP "${product.name}" — already in ${currentCatId} (not Water)`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`  📋 WOULD MOVE: "${product.name}" → ${targetKey}`);
    } else {
      await db.collection('products').updateOne(
        { _id: new mongoose.Types.ObjectId(productId) },
        { 
          $set: { 
            category: new mongoose.Types.ObjectId(target.cat),
            subCategory: new mongoose.Types.ObjectId(target.sub),
          } 
        }
      );
      console.log(`  ✅ MOVED: "${product.name}" → ${targetKey}`);
    }

    successCount++;
    moveSummary[targetKey] = (moveSummary[targetKey] || 0) + 1;
  }

  // Summary
  const afterCount = DRY_RUN 
    ? beforeCount - successCount 
    : await db.collection('products').countDocuments({ 
        category: new mongoose.Types.ObjectId(CATEGORIES.WATER.cat) 
      });

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  MIGRATION SUMMARY');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  Mode:           ${DRY_RUN ? '🔍 DRY RUN' : '🔴 LIVE'}`);
  console.log(`  Before:         ${beforeCount} products in WATER`);
  console.log(`  Moved/To Move:  ${successCount} products`);
  console.log(`  After:          ${afterCount} products in WATER`);
  console.log(`  Not Found:      ${notFoundCount}`);
  console.log(`  Errors:         ${errorCount}`);
  console.log('');
  console.log('  Breakdown by target category:');
  for (const [cat, count] of Object.entries(moveSummary).sort((a, b) => b[1] - a[1])) {
    console.log(`    → ${cat.padEnd(20)} ${count} products`);
  }
  console.log('═══════════════════════════════════════════════════════');

  if (DRY_RUN) {
    console.log('\n💡 To apply changes, run with: DRY_RUN=false');
  }

  await mongoose.disconnect();
  console.log('\n✅ Done. Disconnected from MongoDB.');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
