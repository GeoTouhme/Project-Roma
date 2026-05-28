/**
 * list-public-ids.js
 *
 * Lists Cloudinary public_ids from Product.images, filtered by category.
 *
 * Usage:
 *   node scripts/list-public-ids.js --categories=whiskey,tequila --out=/backups/keep-public-ids.txt
 *   node scripts/list-public-ids.js --exclude-categories=whiskey,tequila --out=/backups/delete-public-ids.txt
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

// ─── CLI args ──────────────────────────────────────────────────────

const OUT_ARG = process.argv.find(arg => arg.startsWith('--out='));
const OUT_PATH = OUT_ARG ? OUT_ARG.split('=')[1] : null;

const CATEGORIES_ARG = process.argv.find(arg => arg.startsWith('--categories='));
const CATEGORIES = CATEGORIES_ARG ? CATEGORIES_ARG.split('=')[1].split(',') : null;

const EXCLUDE_ARG = process.argv.find(arg => arg.startsWith('--exclude-categories='));
const EXCLUDE_CATEGORIES = EXCLUDE_ARG ? EXCLUDE_ARG.split('=')[1].split(',') : null;

if (!OUT_PATH) {
  console.error('Usage: node scripts/list-public-ids.js --out=<file> [--categories=a,b | --exclude-categories=a,b]');
  process.exit(1);
}

if (!CATEGORIES && !EXCLUDE_CATEGORIES) {
  console.error('Error: provide either --categories= or --exclude-categories=');
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  let categoryIds = [];
  let categoryNames = [];

  if (CATEGORIES) {
    const cats = await Category.find({ name: { $in: CATEGORIES.map(c => new RegExp(`^${c}$`, 'i')) } }).lean();
    categoryIds = cats.map(c => c._id.toString());
    categoryNames = cats.map(c => c.name);
    console.log('Including categories:', categoryNames.join(', '));
  } else if (EXCLUDE_CATEGORIES) {
    const cats = await Category.find({ name: { $in: EXCLUDE_CATEGORIES.map(c => new RegExp(`^${c}$`, 'i')) } }).lean();
    const excludeIds = cats.map(c => c._id.toString());
    const allCats = await Category.find().lean();
    categoryIds = allCats.filter(c => !excludeIds.includes(c._id.toString())).map(c => c._id.toString());
    categoryNames = allCats.filter(c => !excludeIds.includes(c._id.toString())).map(c => c.name);
    console.log('Excluding categories:', EXCLUDE_CATEGORIES.join(', '));
  }

  const products = await Product.find({ category: { $in: categoryIds } }).lean();
  console.log('Products matched:', products.length);

  const publicIds = new Set();
  for (const p of products) {
    for (const img of p.images || []) {
      if (img._id) publicIds.add(img._id);
    }
  }

  const list = Array.from(publicIds).sort();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, list.join('\n') + '\n');

  console.log('Public IDs written:', list.length, '→', OUT_PATH);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
