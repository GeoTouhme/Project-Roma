const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();

const SPARE_DIR = process.env.SPARE_DIR || '/home/geo/projects/Project-Roma/image-fallback/spare';
const DRY_RUN = process.env.DRY_RUN === 'true';

async function main() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/liquor_shop';
  await mongoose.connect(mongoUri);
  const Product = mongoose.connection.collection('products');

  const files = fs.readdirSync(SPARE_DIR).filter(f => fs.statSync(path.join(SPARE_DIR, f)).isFile());
  const candidates = files.filter(f => /_0\.[a-zA-Z0-9]+$/i.test(f));

  let deleted = 0;
  let kept = 0;
  const logLines = [];

  for (const filename of candidates) {
    const sku = filename.replace(/_0\.[a-zA-Z0-9]+$/i, '');
    const ext = path.extname(filename);
    const whiteFilename = `${sku}_0_white${ext}`;
    const filePath = path.join(SPARE_DIR, filename);

    const product = await Product.findOne({ sku });
    const hasWhiteInStorage = fs.existsSync(path.join(process.env.IMAGE_FALLBACK_DIR || '/home/geo/projects/Project-Roma/image-fallback/storage/images', whiteFilename));

    if (product && hasWhiteInStorage) {
      if (!DRY_RUN) {
        fs.unlinkSync(filePath);
      }
      deleted++;
      logLines.push(JSON.stringify({ filename, sku, action: DRY_RUN ? 'would-delete' : 'deleted', reason: 'white version exists in storage and is referenced' }));
    } else {
      kept++;
      logLines.push(JSON.stringify({ filename, sku, action: 'kept', reason: `product=${!!product}, whiteExists=${hasWhiteInStorage}` }));
    }
  }

  const logPath = path.join(SPARE_DIR, `delete-spare-duplicates${DRY_RUN ? '-dryrun' : ''}-${Date.now()}.jsonl`);
  fs.writeFileSync(logPath, logLines.join('\n'));

  await mongoose.disconnect();

  console.log(`Candidates checked: ${candidates.length}`);
  console.log(`${DRY_RUN ? 'Would delete' : 'Deleted'}: ${deleted}`);
  console.log(`Kept: ${kept}`);
  console.log(`Log: ${logPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
