'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

async function capturePipeline(handler) {
  let pipeline;
  const filename = path.resolve(process.env.ROMA_BACKEND_ROOT || path.join(__dirname, '..'), 'src/controllers/home.js');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const realRequire = mod.require.bind(mod);
  mod.require = name => {
    if (name === '../models/Product') return { aggregate: async stages => { pipeline = stages; return []; } };
    if (['../models/User', '../models/Category', '../models/Brand'].includes(name)) return {};
    return realRequire(name);
  };
  mod._compile(fs.readFileSync(process.env.ROMA_HOME_SOURCE || filename, 'utf8'), filename);
  const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  await mod.exports[handler]({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  return pipeline;
}

for (const [handler, flag] of [
  ['getBestSellerProducts', 'isBestSeller'],
  ['getFeaturedProducts', 'isTopCollection'],
]) {
  test(`${handler} accepts admin-selected products from every category`, async () => {
    const stages = await capturePipeline(handler);
    const matches = stages.filter(stage => stage.$match).map(stage => stage.$match);
    assert.ok(matches.some(match => match[flag] === true));
    assert.ok(matches.every(match => !Object.hasOwn(match, 'category')), 'Hardcoded alcohol-only filter hides Sparkling Water');
    assert.ok(matches.some(match => match.available?.$gt === 0));
    assert.ok(matches.some(match => match.status?.$nin.includes('inactive') && match.status.$nin.includes('disabled')));
  });

  test(`${handler} filters real images before limiting the result`, async () => {
    const stages = await capturePipeline(handler);
    const imageStage = stages.findIndex(stage => stage.$addFields?.image);
    const limitStage = stages.findIndex(stage => stage.$limit);
    assert.ok(stages[imageStage].$addFields.image.$arrayElemAt[0].$filter, 'Choose a real image rather than the first placeholder');
    assert.ok(stages.some((stage, index) => index > imageStage && index < limitStage && stage.$match?.['image.url']), 'Filter products without a real image before taking eight');
    assert.equal(stages[limitStage].$limit, 8);
  });

  if (process.env.ROMA_HOME_MONGO_TEST === '1') {
    test(`${handler} MongoDB execution includes non-alcohol products and rejects hidden fixtures`, async () => {
      const mongoose = require('mongoose');
      const connection = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
      try {
        const stages = await capturePipeline(handler);
        const base = {
          category: new mongoose.Types.ObjectId('6a7a1234ef6b7be599400f31'),
          status: 'active', available: 10, [flag]: true, reviews: [], sold: 0,
          images: [{ url: '/api/images/product.jpg', blurDataURL: 'blur' }],
        };
        const fixtures = [
          { ...base, _id: 'sparkling-water', name: 'Sparkling Water' },
          { ...base, _id: 'alcohol', category: new mongoose.Types.ObjectId('69bc40df6f0fa539b06ef992') },
          { ...base, _id: 'secondary-image', images: [{ url: '/placeholder.jpg' }, ...base.images] },
          { ...base, _id: 'unselected', [flag]: false },
          { ...base, _id: 'inactive', status: 'inactive' },
          { ...base, _id: 'disabled', status: 'disabled' },
          { ...base, _id: 'out-of-stock', available: 0 },
          { ...base, _id: 'empty-images', images: [] },
          { ...base, _id: 'null-images', images: null },
          ...['', '/placeholder.jpg', 'https://res.cloudinary.com/old.jpg', 'https://google.com/url?x.jpg', '/not-an-image.html'].map((url, i) => ({ ...base, _id: `bad-image-${i}`, images: [{ url }] })),
        ];
        // $documents executes fixtures in memory; no inserts/updates to production.
        const result = await connection.db.aggregate([{ $documents: fixtures }, ...stages]).toArray();
        assert.deepEqual(result.map(p => p._id).sort(), ['alcohol', 'secondary-image', 'sparkling-water']);
        assert.ok(result.every(p => p.image.url === '/api/images/product.jpg'));
        console.log(`${handler}: MongoDB fixture execution passed without database writes`);
      } finally {
        await connection.close();
      }
    });
  }
}
