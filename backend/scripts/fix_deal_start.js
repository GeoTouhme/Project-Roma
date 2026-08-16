const mongoose = require('mongoose');
async function main() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
  await mongoose.connect(uri);
  const Deal = require('/home/geo/projects/Project-Roma/backend/src/models/Deal');
  const result = await Deal.updateOne(
    { _id: '6a81a320fa3a7ddc27786931' },
    { $set: { startAt: new Date().toISOString() } }
  );
  console.log('Updated:', result);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
