'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');
const ID = 'abcdef0123456789abcdef01';

// Exercise the real controller without connecting to MongoDB. Model queries cast
// strings, whereas aggregation compares BSON types exactly.
function fixture() {
  let countMatch, aggregateMatch;
  const product = { _id: new mongoose.Types.ObjectId(ID), name: 'Visible fixture' };
  const models = {
    '../models/Product': {
      countDocuments: async match => {
        countMatch = match;
        return !match._id || match._id.$in.some(id => String(id) === ID) ? 1 : 0;
      },
      aggregate: async pipeline => {
        aggregateMatch = pipeline.find(stage => stage.$match).$match;
        return !aggregateMatch._id || aggregateMatch._id.$in.some(id =>
          id instanceof mongoose.Types.ObjectId && id.equals(product._id)) ? [product] : [];
      },
    },
    '../models/Category': { find: () => ({ select: async () => [] }) },
    '../models/SubCategory': {}, '../models/Brand': {}, '../models/User': {},
    '../config/getUser': {}, '../config/getBlurDataURL': async () => '',
  };
  const filename = path.resolve(__dirname, '../src/controllers/product.js');
  const mod = new Module(filename, module);
  mod.filename = filename;
  mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(models, name) ? models[name] : real(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return {
    async get(query) {
      const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
      await mod.exports.getProducts({ query }, res);
      return res;
    },
    countMatch: () => countMatch,
    aggregateMatch: () => aggregateMatch,
  };
}

function assertPublicFilters(match) {
  assert.deepEqual(match.status, { $nin: ['disabled', 'inactive'] });
  assert.deepEqual(match.available, { $gt: 0 });
  assert.deepEqual(match.images, { $exists: true, $ne: [] });
  assert.deepEqual(match.$expr, {
    $not: { $regexMatch: { input: { $arrayElemAt: ['$images.url', 0] }, regex: 'placeholder' } },
  });
}

test('public ID lookup returns matching data as well as total using BSON ObjectIds', async () => {
  const f = fixture();
  const res = await f.get({ ids: ID });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data.length, 1);
  assert.equal(String(res.body.data[0]._id), ID);
  assert.equal(res.body.data[0].isWishlisted, false);
  assert.ok(f.aggregateMatch()._id.$in[0] instanceof mongoose.Types.ObjectId);
  assert.deepEqual(f.countMatch(), f.aggregateMatch());
  assertPublicFilters(f.aggregateMatch());
});

test('supplied invalid-only or wrong-typed IDs fail closed instead of listing the catalog', async () => {
  for (const ids of ['', 'null', 'invalid,,not-an-id', { $ne: ID }, [ID], 42, false, null]) {
    const f = fixture();
    const res = await f.get({ ids });
    assert.equal(res.statusCode, 201, JSON.stringify(ids));
    assert.equal(res.body.total, 0, JSON.stringify(ids));
    assert.deepEqual(res.body.data, [], JSON.stringify(ids));
    assert.deepEqual(f.aggregateMatch()._id, { $in: [] });
    assertPublicFilters(f.aggregateMatch());
  }
});

test('ID batches use at most the first 100 comma-separated entries', async () => {
  const f = fixture();
  const ids = Array.from({ length: 100 }, (_, i) => i.toString(16).padStart(24, '0'));
  const res = await f.get({ ids: [...ids, ID].join(',') });
  assert.equal(res.statusCode, 201);
  assert.equal(f.aggregateMatch()._id.$in.length, 100);
  assert.deepEqual(f.aggregateMatch()._id.$in.map(String), ids);
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.data, []);
});

test('mixed IDs keep only validated BSON IDs, including uppercase hex', async () => {
  const f = fixture();
  const res = await f.get({ ids: `invalid,${ID.toUpperCase()},,0123456789abcdef01234567` });
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data.length, 1);
  assert.deepEqual(f.aggregateMatch()._id.$in.map(String), [ID, '0123456789abcdef01234567']);
  assert.ok(f.aggregateMatch()._id.$in.every(id => id instanceof mongoose.Types.ObjectId));
  assertPublicFilters(f.aggregateMatch());
});

test('valid unknown IDs return empty data and zero total', async () => {
  const f = fixture();
  const res = await f.get({ ids: '0123456789abcdef01234567' });
  assert.equal(res.body.total, 0);
  assert.deepEqual(res.body.data, []);
});

test('omitting IDs preserves normal public catalog filters', async () => {
  const f = fixture();
  const res = await f.get({});
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.total, 1);
  assert.equal(res.body.data.length, 1);
  assert.equal(Object.hasOwn(f.aggregateMatch(), '_id'), false);
  assertPublicFilters(f.aggregateMatch());
});
