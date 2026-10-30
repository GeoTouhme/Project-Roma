'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');

// Opt-in fixture suite. The hardcoded replica-set AND database names prevent
// accidentally running writes against the application's standalone live database.
test('isolated MongoDB inventory transactions preserve galleries and roll back commit failures', { skip: process.env.ROMA_INTEGRITY_MONGO !== '1' }, async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/roma_admin_integrity_fixture?replicaSet=romaIntegrity', { serverSelectionTimeoutMS: 5000 });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  assert.equal(hello.setName, 'romaIntegrity');
  assert.equal(mongoose.connection.name, 'roma_admin_integrity_fixture');
  const Product = require('../src/models/Product');
  const Category = require('../src/models/Category');
  const SubCategory = require('../src/models/SubCategory');
  const filename = path.resolve(__dirname, '../src/controllers/product.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = name => name === '../config/getUser' ? { getAdmin: async () => ({ role: 'admin' }) } : real(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, setHeader() {}, send(body) { this.body = body; return this; } });
  const importCSV = async text => { const res = response(); await mod.exports.importInventoryCSV({ file: { buffer: Buffer.from(text) } }, res); return res; };
  let originalUpdate;
  try {
    await mongoose.connection.dropDatabase();
    await Promise.all([Product.init(), Category.init(), SubCategory.init()]);
    const category = await Category.create({ name: 'Fixture Wine', slug: 'fixture-wine', status: 'Active', metaTitle: 'Fixture', metaDescription: 'Fixture', description: 'Fixture', cover: { _id: 'cover', url: '/api/images/fixture.jpg', blurDataURL: 'blur' } });
    const images = [{ _id: 'one', url: '/api/images/one.jpg', blurDataURL: 'blur' }, { _id: 'two', url: '/api/images/two.jpg', blurDataURL: 'blur' }];
    await Product.create([
      { name: 'First', sku: '00001', slug: 'first', category: category._id, priceSale: 10, price: 12, available: 8, status: 'active', images, description: 'Line one\nLine two, "quoted"', isBestSeller: true },
      { name: 'Second', sku: '00002', slug: 'second', category: category._id, priceSale: 20, available: 9, status: 'active', images },
    ]);
    const before = await Product.findOne({ sku: '00001' }).lean();
    const exported = response(); await mod.exports.exportInventoryCSV({}, exported);
    const roundtrip = await importCSV(exported.body);
    assert.equal(roundtrip.body.success, true, JSON.stringify(roundtrip.body));
    const after = await Product.findOne({ sku: '00001' }).lean();
    assert.deepEqual(after.images, before.images);
    assert.equal(after.description, before.description);
    const partial = await importCSV('UPC,Stock\n00001,3');
    assert.equal(partial.body.success, true, JSON.stringify(partial.body));
    const stocked = await Product.findOne({ sku: '00001' }).lean();
    assert.equal(stocked.available, 3);
    assert.equal(stocked.isBestSeller, true);
    assert.deepEqual(stocked.images, before.images);
    const filtered = response();
    await mod.exports.getProductsByAdmin({ query: { category: String(category._id), limit: '1', page: '2', status: 'low stock' } }, filtered);
    assert.equal(filtered.body.total, 2);
    assert.equal(filtered.body.data.length, 1, 'ObjectId category filtering must work in aggregation on later pages');
    const noMatches = response();
    await mod.exports.getProductsByAdmin({ query: { status: 'out of stock' } }, noMatches);
    assert.equal(noMatches.body.total, 0);
    assert.equal(noMatches.body.data.length, 0);
    const invalid = await importCSV('UPC,Stock\n00001,2\n00002,1.5');
    assert.equal(invalid.statusCode, 400);
    assert.equal((await Product.findOne({ sku: '00001' })).available, 3);
    originalUpdate = Product.findByIdAndUpdate;
    let calls = 0;
    Product.findByIdAndUpdate = function (...args) { if (++calls === 2) throw new Error('Injected second-write failure'); return originalUpdate.apply(this, args); };
    const failed = await importCSV('UPC,Stock\n00001,1\n00002,1');
    assert.equal(failed.body.success, false);
    assert.equal(failed.body.data.updated, 0);
    assert.equal((await Product.findOne({ sku: '00001' })).available, 3, 'first write must roll back');
    assert.equal((await Product.findOne({ sku: '00002' })).available, 9);
  } finally {
    if (originalUpdate) Product.findByIdAndUpdate = originalUpdate;
    if (mongoose.connection.name === 'roma_admin_integrity_fixture' && hello.setName === 'romaIntegrity') await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
