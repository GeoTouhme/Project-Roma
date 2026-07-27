/**
 * Apply an approved 2-level category hierarchy to Project Roma.
 *
 * This script is the Project Roma adaptation of the flat-collection migration
 * delivered earlier. It works with Roma's existing two-collection schema:
 *   - Category (parents, with subCategories: [ObjectId])
 *   - SubCategory (children, with parentCategory: ObjectId)
 *
 * Usage:
 *   node backend/scripts/apply-category-hierarchy.js        # dry-run
 *   node backend/scripts/apply-category-hierarchy.js --apply # commit
 *
 * The script will:
 *   1. Create/update parent categories from HIERARCHY.
 *   2. Create/update subcategories linked to their parents.
 *   3. Add an `order` field to every created/updated document.
 *   4. Optionally remap products if PRODUCT_REMAPS is configured.
 *
 * IMPORTANT:
 *   - The script does NOT delete existing categories/subcategories that are not
 *     part of HIERARCHY.
 *   - Products are only reassigned when an explicit mapping is provided in
 *     PRODUCT_REMAPS.
 *   - MongoDB Atlas M0/M10 free/shared clusters do not support multi-document
 *     transactions, so this script writes documents directly. Run a dry-run
 *     first and review the output before using --apply.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const mongoose = require("mongoose");
const Category = require("../src/models/Category");
const SubCategory = require("../src/models/SubCategory");
const Product = require("../src/models/Product");

const APPLY = process.argv.includes("--apply");

/**
 * Slug collisions: if any existing category/subcategory uses one of these slugs,
 * products will be remapped to the kept slug when PRODUCT_REMAPS is enabled.
 */
const SLUG_REMAPS = {
  "red-blends": "red-blend",
  sodas: "soda",
  "ice-cream": "ice-cream-novelty",
  gummy: "gummy-candy",
};

/**
 * Approved 2-level hierarchy.
 * Parents and subcategories include a display `order`.
 */
const HIERARCHY = [
  {
    parent: { name: "Wine", slug: "wine", order: 1 },
    subcategories: [
      { name: "Cabernet Sauvignon", slug: "cabernet-sauvignon", order: 1 },
      { name: "Merlot", slug: "merlot", order: 2 },
      { name: "Pinot Noir", slug: "pinot-noir", order: 3 },
      { name: "Red Blend", slug: "red-blend", order: 4 },
      { name: "Other Reds", slug: "other-reds", order: 5 },
      { name: "Zinfandel", slug: "zinfandel", order: 6 },
      { name: "Blush Wine", slug: "blush-wine", order: 7 },
      { name: "Chardonnay", slug: "chardonnay", order: 8 },
      { name: "Pinot Grigio", slug: "pinot-grigio", order: 9 },
      { name: "Sauvignon Blanc", slug: "sauvignon-blanc", order: 10 },
      { name: "Other Whites", slug: "other-whites", order: 11 },
      { name: "Rose", slug: "rose", order: 12 },
      { name: "Champagne", slug: "champagne", order: 13 },
      { name: "Sparkling Wine", slug: "sparkling-wine", order: 14 },
      { name: "Sparkling Rosé", slug: "sparkling-rose", order: 15 },
      { name: "Fruit Wine", slug: "fruit-wine", order: 16 },
    ],
  },
  {
    parent: { name: "Beer", slug: "beer", order: 2 },
    subcategories: [
      { name: "Alcohol-Free", slug: "alcohol-free", order: 1 },
      { name: "Belgian-Style Ale", slug: "belgian-style-ale", order: 2 },
      { name: "Blonde Ale", slug: "blonde-ale", order: 3 },
      { name: "Craft Beer", slug: "craft-beer", order: 4 },
      { name: "Domestic Beer", slug: "domestic-beer", order: 5 },
      { name: "IPA", slug: "ipa", order: 6 },
      { name: "Import Beer", slug: "import-beer", order: 7 },
      { name: "Lager", slug: "lager", order: 8 },
      { name: "Pale Ale", slug: "pale-ale", order: 9 },
      { name: "Pilsner", slug: "pilsner", order: 10 },
      { name: "Specialty Beer", slug: "specialty-beer", order: 11 },
      { name: "Stout & Porter", slug: "stout-porter", order: 12 },
      { name: "Wheat Beer", slug: "wheat-beer", order: 13 },
    ],
  },
  {
    parent: { name: "Whiskey", slug: "whiskey", order: 3 },
    subcategories: [
      { name: "American Whiskey", slug: "american-whiskey", order: 1 },
      { name: "Bourbon", slug: "bourbon", order: 2 },
      { name: "Canadian Whisky", slug: "canadian-whisky", order: 3 },
      { name: "Flavored Whisky", slug: "flavored-whisky", order: 4 },
      { name: "Irish Whiskey", slug: "irish-whiskey", order: 5 },
      { name: "Other Whisky", slug: "other-whisky", order: 6 },
      { name: "Rye Whiskey", slug: "rye-whiskey", order: 7 },
      { name: "Scotch", slug: "scotch", order: 8 },
    ],
  },
  {
    parent: { name: "Vodka", slug: "vodka", order: 4 },
    subcategories: [
      { name: "Vodka", slug: "vodka-plain", order: 1 },
      { name: "Flavored Vodka", slug: "flavored-vodka", order: 2 },
    ],
  },
  {
    parent: { name: "Tequila & Mezcal", slug: "tequila-mezcal", order: 5 },
    subcategories: [
      { name: "Blanco/Silver", slug: "blanco-silver", order: 1 },
      { name: "Reposado", slug: "reposado", order: 2 },
      { name: "Anejo", slug: "anejo", order: 3 },
      { name: "Mezcal", slug: "mezcal", order: 4 },
      { name: "Tequila", slug: "tequila-all", order: 5 },
    ],
  },
  {
    parent: { name: "Rum", slug: "rum", order: 6 },
    subcategories: [
      { name: "Rum", slug: "rum-plain", order: 1 },
      { name: "Flavored Rum", slug: "flavored-rum", order: 2 },
    ],
  },
  {
    parent: { name: "Gin", slug: "gin", order: 7 },
    subcategories: [
      { name: "Gin", slug: "gin-all", order: 1 },
    ],
  },
  {
    parent: { name: "Liqueur & Brandy", slug: "liqueur-brandy", order: 8 },
    subcategories: [
      { name: "Liqueur", slug: "liqueur", order: 1 },
      { name: "Other Liqueurs", slug: "other-liqueurs", order: 2 },
      { name: "Brandy", slug: "brandy", order: 3 },
      { name: "Cognac", slug: "cognac", order: 4 },
    ],
  },
  {
    parent: { name: "Ready-to-Drink & Seltzers", slug: "ready-to-drink-seltzers", order: 9 },
    subcategories: [
      { name: "Hard Seltzer", slug: "hard-seltzer", order: 1 },
      { name: "Hard Lemonade & Tea", slug: "hard-lemonade-tea", order: 2 },
      { name: "Hard Lemonade", slug: "hard-lemonade", order: 3 },
      { name: "Hard Tea", slug: "hard-tea", order: 4 },
      { name: "Hard Soda", slug: "hard-soda", order: 5 },
      { name: "RTD Cocktails", slug: "rtd-cocktails", order: 6 },
      { name: "Hard Kombucha", slug: "hard-kombucha", order: 7 },
      { name: "Hard Malt Beverage", slug: "hard-malt-beverage", order: 8 },
      { name: "Malt Liquor", slug: "malt-liquor", order: 9 },
    ],
  },
  {
    parent: { name: "Mixers & Non-Alcoholic Drinks", slug: "mixers-non-alcoholic-drinks", order: 10 },
    subcategories: [
      { name: "Bar Mixers", slug: "bar-mixers", order: 1 },
      { name: "Mixers & Ice", slug: "mixers-ice", order: 2 },
      { name: "Bottled Water", slug: "bottled-water", order: 3 },
      { name: "Coffee", slug: "coffee", order: 4 },
      { name: "Energy Drinks", slug: "energy-drinks", order: 5 },
      { name: "Flavored Water", slug: "flavored-water", order: 6 },
      { name: "Juice", slug: "juice", order: 7 },
      { name: "Soda", slug: "soda", order: 8 },
      { name: "Sparkling Water", slug: "sparkling-water", order: 9 },
      { name: "Sports Drinks", slug: "sports-drinks", order: 10 },
      { name: "Still Water", slug: "still-water", order: 11 },
      { name: "Tea", slug: "tea", order: 12 },
    ],
  },
  {
    parent: { name: "Snacks & Sweets", slug: "snacks-sweets", order: 11 },
    subcategories: [
      { name: "Candy & Sweets", slug: "candy-sweets", order: 1 },
      { name: "Chocolate", slug: "chocolate", order: 2 },
      { name: "Cookies", slug: "cookies", order: 3 },
      { name: "Cookies & Pastries", slug: "cookies-pastries", order: 4 },
      { name: "Crackers", slug: "crackers", order: 5 },
      { name: "Fruity", slug: "fruity", order: 6 },
      { name: "Gum & Mints", slug: "gum-mints", order: 7 },
      { name: "Gummy Candy", slug: "gummy-candy", order: 8 },
      { name: "Hard Candy", slug: "hard-candy", order: 9 },
      { name: "Cheese Puffs", slug: "cheese-puffs", order: 10 },
      { name: "Chips", slug: "chips", order: 11 },
      { name: "Chips & Crackers", slug: "chips-crackers", order: 12 },
      { name: "Healthy Snacks", slug: "healthy-snacks", order: 13 },
      { name: "Ice Cream & Novelty", slug: "ice-cream-novelty", order: 14 },
      { name: "Novelty", slug: "novelty", order: 15 },
      { name: "Jerky", slug: "jerky", order: 16 },
      { name: "Nuts & Seeds", slug: "nuts-seeds", order: 17 },
      { name: "Pretzels", slug: "pretzels", order: 18 },
      { name: "Salsa & Dips", slug: "salsa-dips", order: 19 },
      { name: "Salty Snacks", slug: "salty-snacks", order: 20 },
      { name: "Snack Mixes", slug: "snack-mixes", order: 21 },
      { name: "Sweets", slug: "sweets", order: 22 },
    ],
  },
  {
    parent: { name: "Food & Grocery", slug: "food-grocery", order: 12 },
    subcategories: [
      { name: "Bakery", slug: "bakery", order: 1 },
      { name: "Canned Pasta", slug: "canned-pasta", order: 2 },
      { name: "Canned Veggies", slug: "canned-veggies", order: 3 },
      { name: "Condiments", slug: "condiments", order: 4 },
      { name: "Dressing", slug: "dressing", order: 5 },
      { name: "Pantry", slug: "pantry", order: 6 },
      { name: "Baking", slug: "baking", order: 7 },
      { name: "Pickles", slug: "pickles", order: 8 },
      { name: "Rice", slug: "rice", order: 9 },
      { name: "Sauces", slug: "sauces", order: 10 },
      { name: "Soup", slug: "soup", order: 11 },
      { name: "Spreads", slug: "spreads", order: 12 },
      { name: "Frozen", slug: "frozen", order: 13 },
      { name: "Milk", slug: "milk", order: 14 },
      { name: "Flavored Milk", slug: "flavored-milk", order: 15 },
    ],
  },
  {
    parent: { name: "Household & Personal Care", slug: "household-personal-care", order: 13 },
    subcategories: [
      { name: "Household", slug: "household", order: 1 },
      { name: "Home Essentials", slug: "home-essentials", order: 2 },
      { name: "Personal Care", slug: "personal-care", order: 3 },
      { name: "Deodorant", slug: "deodorant", order: 4 },
      { name: "Oral Health", slug: "oral-health", order: 5 },
      { name: "Medicine", slug: "medicine", order: 6 },
      { name: "Vitamins", slug: "vitamins", order: 7 },
    ],
  },
];

/**
 * Optional mapping from existing category slugs to new subcategory slugs.
 * Configure this before running with --apply if you want products reassigned.
 *
 * Example:
 *   'candy': 'candy-sweets',
 *   'gum-mints': 'gum-mints',
 */
const PRODUCT_REMAPS = {
  // Add mappings here when ready.
};

const DUMMY_BLUR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8/+F9PQAI8wNPvd7POQAAAABJRU5ErkJggg==";

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function normalizeSlug(slug) {
  return SLUG_REMAPS[slug] || slug;
}

function placeholderCover(slug) {
  return {
    _id: `placeholder-${slug}`,
    url: `https://placehold.co/600x400?text=${encodeURIComponent(slug)}`,
    blurDataURL: DUMMY_BLUR,
  };
}

async function applyHierarchy() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not defined in backend/.env");
  }

  let uri = process.env.MONGODB_URI;
  if (process.env.DB_NAME) {
    const url = new URL(process.env.MONGODB_URI);
    // MongoDB SRV URIs have no pathname; standard URIs do.
    url.pathname = process.env.DB_NAME;
    uri = url.toString();
  }

  await mongoose.connect(uri);
  console.log(`✓ Connected to ${mongoose.connection.db.databaseName}`);

  // MongoDB Atlas M0/M10 free/shared clusters do not support multi-document
  // transactions. We run without a session and track applied IDs for manual
  // rollback if needed.
  const applied = { parents: [], subCategories: [] };

  try {
    const now = new Date();
    const summary = {
      parentsCreated: 0,
      parentsUpdated: 0,
      subCategoriesCreated: 0,
      subCategoriesUpdated: 0,
      productsRemapped: 0,
      warnings: [],
    };

    // 1. Create/update parents.
    const parentIdsBySlug = {};
    for (const group of HIERARCHY) {
      const parent = group.parent;
      const existing = await Category.findOne({ slug: parent.slug }).lean();

      const update = {
        name: parent.name,
        slug: parent.slug,
        status: "active",
        metaTitle: parent.name,
        metaDescription: `Shop ${parent.name} at Balport`,
        description: `${parent.name} category`,
        cover: placeholderCover(parent.slug),
        order: parent.order,
        updatedAt: now,
      };

      let doc;
      if (existing) {
        doc = await Category.findOneAndUpdate(
          { _id: existing._id },
          update,
          { new: true }
        );
        summary.parentsUpdated++;
      } else {
        doc = await Category.create({
          ...update,
          subCategories: [],
          createdAt: now,
        });
        summary.parentsCreated++;
        applied.parents.push(doc._id.toString());
      }

      parentIdsBySlug[parent.slug] = doc._id;
      console.log(`✓ Parent ${existing ? "updated" : "created"}: ${parent.name}`);
    }

    // 2. Create/update subcategories and link to parents.
    for (const group of HIERARCHY) {
      const parentId = parentIdsBySlug[group.parent.slug];
      const subCategoryIds = [];

      for (const sub of group.subcategories) {
        const canonicalSlug = normalizeSlug(sub.slug);
        const existing = await SubCategory.findOne({
          slug: canonicalSlug,
          parentCategory: parentId,
        }).lean();

        const update = {
          name: sub.name,
          slug: canonicalSlug,
          status: "active",
          metaTitle: sub.name,
          metaDescription: `Shop ${sub.name} at Balport`,
          description: `${sub.name} subcategory`,
          cover: placeholderCover(canonicalSlug),
          parentCategory: parentId,
          order: sub.order,
          updatedAt: now,
        };

        let doc;
        if (existing) {
          doc = await SubCategory.findOneAndUpdate(
            { _id: existing._id },
            update,
            { new: true }
          );
          summary.subCategoriesUpdated++;
        } else {
          doc = await SubCategory.create({ ...update, createdAt: now });
          summary.subCategoriesCreated++;
          applied.subCategories.push(doc._id.toString());
        }

        subCategoryIds.push(doc._id);
        console.log(`  ✓ Subcategory ${existing ? "updated" : "created"}: ${sub.name}`);
      }

      // Ensure parent references exactly this set of subcategories.
      await Category.updateOne(
        { _id: parentId },
        { $set: { subCategories: subCategoryIds, updatedAt: now } }
      );
    }

    // 3. Remap products if PRODUCT_REMAPS is configured.
    if (Object.keys(PRODUCT_REMAPS).length > 0) {
      for (const [oldCategorySlug, newSubCategorySlug] of Object.entries(PRODUCT_REMAPS)) {
        const newSub = await SubCategory.findOne({ slug: newSubCategorySlug }).lean();
        if (!newSub) {
          summary.warnings.push(`No target subcategory found for mapping ${oldCategorySlug} -> ${newSubCategorySlug}`);
          continue;
        }

        const oldCategory = await Category.findOne({ slug: oldCategorySlug }).lean();
        if (!oldCategory) {
          summary.warnings.push(`No source category found for mapping ${oldCategorySlug}`);
          continue;
        }

        const result = await Product.updateMany(
          { category: oldCategory._id },
          {
            $set: {
              category: newSub.parentCategory,
              subCategory: newSub._id,
              updatedAt: now,
            },
          }
        );

        summary.productsRemapped += result.modifiedCount;
        console.log(`✓ Remapped ${result.modifiedCount} products: ${oldCategorySlug} -> ${newSubCategorySlug}`);
      }
    } else {
      summary.warnings.push(
        "PRODUCT_REMAPS is empty: existing products keep their current category assignments."
      );
    }

    // 4. Report products that still reference categories outside the new hierarchy.
    const hierarchyCategoryIds = new Set(Object.values(parentIdsBySlug).map((id) => id.toString()));
    const orphanedProducts = await Product.countDocuments({
      category: { $nin: Array.from(hierarchyCategoryIds).map((id) => new mongoose.Types.ObjectId(id)) },
    });

    if (orphanedProducts > 0) {
      summary.warnings.push(
        `${orphanedProducts} products still reference categories not in the approved hierarchy.`
      );
    }

    if (!APPLY) {
      console.log("\n⚠ Dry-run complete. No changes were saved. Re-run with --apply to commit.");
      return;
    }

    console.log("\n✓ Changes applied to MongoDB.");

    console.log("\nMigration summary:");
    console.log(`  Parents created: ${summary.parentsCreated}`);
    console.log(`  Parents updated: ${summary.parentsUpdated}`);
    console.log(`  Subcategories created: ${summary.subCategoriesCreated}`);
    console.log(`  Subcategories updated: ${summary.subCategoriesUpdated}`);
    console.log(`  Products remapped: ${summary.productsRemapped}`);
    console.log(`\nApplied IDs (for rollback):`);
    console.log(`  Parents: ${applied.parents.join(", ") || "none"}`);
    console.log(`  SubCategories: ${applied.subCategories.join(", ") || "none"}`);
    if (summary.warnings.length) {
      console.log("\nWarnings:");
      summary.warnings.forEach((w) => console.log(`  - ${w}`));
    }
  } catch (error) {
    console.error("\nMigration failed:", error.message);
    process.exitCode = 1;
    throw error;
  } finally {
    await mongoose.disconnect();
    console.log("✓ MongoDB connection closed.");
  }
}

applyHierarchy().catch((err) => {
  console.error(err);
  process.exit(1);
});
