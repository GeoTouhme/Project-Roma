'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Category = require('../src/models/Category');
const SubCategory = require('../src/models/SubCategory');
const Product = require('../src/models/Product');
const controller = require('../src/controllers/subcategory');
const DB = 'roma_subcategory_integrity_fixture';
const cover = { _id: 'fixture', url: '/api/images/fixture.png', blurDataURL: 'fixture' };
const data = slug => ({ name: slug, slug, metaTitle: slug, description: slug, metaDescription: slug, status: 'active', cover });
const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
async function call(method, body = {}, slug = 'child', query = {}) {
  const res = response();
  await controller[method]({ body, params: { slug }, query }, res);
  return res;
}
before(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${DB}?replicaSet=rsSubcategory`, { serverSelectionTimeoutMS: 10000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'rsSubcategory');
  assert.equal(mongoose.connection.name, DB);
  await Promise.all([Category.init(), SubCategory.init(), Product.init()]);
});
beforeEach(async () => {
  assert.equal(mongoose.connection.name, DB);
  assert.equal((await mongoose.connection.db.admin().command({ hello: 1 })).setName, 'rsSubcategory');
  await Promise.all([Category.deleteMany({}), SubCategory.deleteMany({}), Product.deleteMany({})]);
});
after(async () => { await mongoose.disconnect(); });
async function parents() { return [await Category.create(data('parent-a')), await Category.create(data('parent-b'))]; }
async function child(parent) {
  const doc = await SubCategory.create({ ...data('child'), parentCategory: parent._id });
  await Category.updateOne({ _id: parent._id }, { $addToSet: { subCategories: doc._id } });
  return doc;
}
test('update reparents and preserves old parent membership on rollback', async () => {
  const [a, b] = await parents(); const doc = await child(a);
  const original = Category.findByIdAndUpdate; let writes = 0;
  Category.findByIdAndUpdate = (...args) => { if (++writes === 2) throw new Error('injected destination failure'); return original.apply(Category, args); };
  try {
    const res = await call('updateSubCategoriesBySlug', { cover, name: 'changed', parentCategory: String(b._id) });
    assert.equal(res.statusCode, 400);
    assert.equal(String((await SubCategory.findById(doc._id)).parentCategory), String(a._id));
    assert.equal((await SubCategory.findById(doc._id)).name, 'child');
    assert.deepEqual((await Category.findById(a._id)).subCategories.map(String), [String(doc._id)]);
  } finally { Category.findByIdAndUpdate = original; }
  const res = await call('updateSubCategoriesBySlug', { cover, name: 'changed', parentCategory: String(b._id) });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(String((await SubCategory.findById(doc._id)).parentCategory), String(b._id));
  assert.equal((await Category.findById(a._id)).subCategories.length, 0);
  assert.deepEqual((await Category.findById(b._id)).subCategories.map(String), [String(doc._id)]);
});
test('update keeps omitted parent and rejects nonexistent parents and missing child', async () => {
  const [a] = await parents(); const doc = await child(a);
  assert.equal((await call('updateSubCategoriesBySlug', { cover, name: 'renamed' })).statusCode, 201);
  assert.equal(String((await SubCategory.findById(doc._id)).parentCategory), String(a._id));
  for (const parentCategory of ['', null, String(new mongoose.Types.ObjectId())]) {
    assert.equal((await call('updateSubCategoriesBySlug', { cover, name: 'bad', parentCategory })).statusCode, 400);
    assert.equal((await SubCategory.findById(doc._id)).name, 'renamed');
  }
  assert.equal((await call('updateSubCategoriesBySlug', { cover }, 'missing')).statusCode, 404);
});
test('reparent refuses products referencing the subcategory', async () => {
  const [a, b] = await parents(); const doc = await child(a);
  await Product.create({ slug: 'fixture-product', sku: 'fixture', priceSale: 1, available: 1, category: a._id, subCategory: doc._id });
  assert.equal((await call('updateSubCategoriesBySlug', { cover, parentCategory: String(b._id) })).statusCode, 409);
  assert.equal(String((await SubCategory.findById(doc._id)).parentCategory), String(a._id));
  assert.equal((await Category.findById(b._id)).subCategories.length, 0);
  assert.equal((await call('updateSubCategoriesBySlug', { cover, name: 'safe rename' })).statusCode, 201);
});
test('delete refuses product references and reports missing child', async () => {
  const [a] = await parents(); const doc = await child(a);
  await Product.create({ slug: 'fixture-product', sku: 'fixture', priceSale: 1, available: 1, category: a._id, subCategory: doc._id });
  assert.equal((await call('deleteSubCategoriesBySlug')).statusCode, 409);
  assert.ok(await SubCategory.findById(doc._id));
  assert.deepEqual((await Category.findById(a._id)).subCategories.map(String), [String(doc._id)]);
  assert.equal((await call('deleteSubCategoriesBySlug', {}, 'missing')).statusCode, 404);
});
test('delete rolls back on parent failure then commits both removals', async () => {
  const [a] = await parents(); const doc = await child(a);
  const original = Category.findByIdAndUpdate;
  Category.findByIdAndUpdate = () => { throw new Error('injected parent failure'); };
  try {
    assert.equal((await call('deleteSubCategoriesBySlug')).statusCode, 400);
    assert.ok(await SubCategory.findById(doc._id));
    assert.equal((await Category.findById(a._id)).subCategories.length, 1);
  } finally { Category.findByIdAndUpdate = original; }
  assert.equal((await call('deleteSubCategoriesBySlug')).statusCode, 201);
  assert.equal(await SubCategory.findById(doc._id), null);
  assert.equal((await Category.findById(a._id)).subCategories.length, 0);
});
test('page count uses filtered numeric total including empty and later pages', async () => {
  const [a, b] = await parents();
  for (let n = 0; n < 3; n++) await SubCategory.create({ ...data(`child-${n}`), parentCategory: a._id });
  await SubCategory.create({ ...data('other'), parentCategory: b._id });
  const res = await call('getAllSubCategories', {}, '', { limit: '2', page: '2', parentCategory: String(a._id) });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.count, 2);
  assert.equal(res.body.data.length, 1);
  const empty = await call('getAllSubCategories', {}, '', { search: 'absent' });
  assert.equal(empty.body.count, 0);
  assert.equal(empty.body.data.length, 0);
});
test('transaction unavailability never falls back to partial writes', async () => {
  const [a, b] = await parents(); const doc = await child(a);
  const original = mongoose.connection.transaction;
  mongoose.connection.transaction = async () => { throw new Error('Transaction numbers are only allowed on a replica set member or mongos'); };
  try {
    assert.equal((await call('createSubCategory', { ...data('new'), parentCategory: String(a._id) })).statusCode, 400);
    assert.equal((await call('updateSubCategoriesBySlug', { cover, name: 'bad', parentCategory: String(b._id) })).statusCode, 400);
    assert.equal((await call('deleteSubCategoriesBySlug')).statusCode, 400);
    assert.equal(await SubCategory.countDocuments(), 1);
    assert.equal((await SubCategory.findById(doc._id)).name, 'child');
    assert.deepEqual((await Category.findById(a._id)).subCategories.map(String), [String(doc._id)]);
    assert.equal((await Category.findById(b._id)).subCategories.length, 0);
  } finally { mongoose.connection.transaction = original; }
});
test('create commits child and parent membership together', async () => {
  const [p] = await parents();
  const res = await call('createSubCategory', { ...data('child'), parentCategory: String(p._id), productCount: 99 });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const doc = await SubCategory.findOne({ slug: 'child' });
  assert.equal(doc.productCount, 0);
  assert.deepEqual((await Category.findById(p._id)).subCategories.map(String), [String(doc._id)]);
});
test('create rejects missing or nonexistent parent without saving child', async () => {
  for (const parentCategory of [undefined, '', String(new mongoose.Types.ObjectId())]) {
    const res = await call('createSubCategory', { ...data('child'), parentCategory });
    assert.equal(res.statusCode, 400);
    assert.equal(await SubCategory.countDocuments(), 0);
  }
});
test('create rolls back child when parent membership write fails', async () => {
  const [p] = await parents();
  const original = Category.findByIdAndUpdate;
  Category.findByIdAndUpdate = () => { throw new Error('injected parent write failure'); };
  try {
    const res = await call('createSubCategory', { ...data('child'), parentCategory: String(p._id) });
    assert.equal(res.statusCode, 400);
    assert.equal(await SubCategory.countDocuments(), 0);
  } finally { Category.findByIdAndUpdate = original; }
});
