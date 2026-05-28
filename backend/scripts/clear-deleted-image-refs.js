/**
 * clear-deleted-image-refs.js
 *
 * Clears Product.images for products whose images were deleted from Cloudinary.
 *
 * Usage:
 *   node scripts/clear-deleted-image-refs.js --list=/backups/delete-public-ids.txt
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

const Product = require('../src/models/Product');

// ─── CLI args ──────────────────────────────────────────────────────

const LIST_ARG = process.argv.find(arg => arg.startsWith('--list='));
const LIST_PATH = LIST_ARG ? LIST_ARG.split('=')[1] : null;

if (!LIST_PATH) {
  console.error('Usage: node scripts/clear-deleted-image-refs.js --list=<file>');
  process.exit(1);
}

// ─── Main ──────────────────────────────────────────────────────────

async function run() {
  const uri = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);
  console.log('MongoDB connected');

  const raw = fs.readFileSync(LIST_PATH, 'utf-8');
  const deleteSet = new Set(raw.split('\n').map(l => l.trim()).filter(Boolean));

  console.log('Public IDs in delete list:', deleteSet.size);

  const products = await Product.find({}).lean();
  let updated = 0;

  for (const p of products) {
    const hasDeleted = (p.images || []).some(img => deleteSet.has(img._id));
    if (hasDeleted) {
      await Product.updateOne(
        { _id: p._id },
        { $set: { images: [] } }
      );
      updated++;
    }
  }

  console.log('Products cleared:', updated);
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
