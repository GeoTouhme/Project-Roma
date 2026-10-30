'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const mongoose = require('mongoose');
const Product = require('../src/models/Product');
const CAT = 'a'.repeat(24), SUB = 'b'.repeat(24), ID = 'c'.repeat(24);
const gallery = [
  { _id: 'first', url: '/api/images/one.jpg', blurDataURL: 'blur', fallbackUrl: '/api/images/one-original.jpg' },
  { _id: 'second', url: '/api/images/two.jpg', blurDataURL: 'blur' },
];
function query(value) {
  return { session() { return this; }, select() { return this; }, populate() { return this; }, lean() { return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); } };
}
function fixture(seed = [{ _id: ID, sku: '0000123', name: 'Fixture', slug: 'fixture', category: CAT,
  price: 12, priceSale: 10, available: 7, status: 'active', description: 'First line\nSecond, "quoted" line', images: gallery,
  isBestSeller: true, isTopCollection: true, saleEndsAt: new Date('2030-01-01T00:00:00Z') }]) {
  let documents = structuredClone(seed), writes = 0, assetDeletes = 0;
  const session = {};
  const fakeProduct = function (data) { return new Product(data); };
  Object.assign(fakeProduct, {
    find: () => query(documents.map(p => ({ ...p, category: { _id: CAT, name: 'Wine' } }))),
    findOne: filter => query(documents.find(p => Object.entries(filter).every(([k, v]) => String(p[k]) === String(v))) || null),
    findByIdAndUpdate: async (id, data) => { writes++; const p = documents.find(p => String(p._id) === String(id)); Object.assign(p, data.$set || data); return p; },
    findOneAndUpdate: async (filter, data) => { writes++; const p = documents.find(p => p.slug === filter.slug); if (p) Object.assign(p, data.$set || data); return p || null; },
    create: async data => { writes++; const list = Array.isArray(data) ? data : [data]; documents.push(...list); return Array.isArray(data) ? list : data; },
    deleteOne: async filter => { const before = documents.length; documents = documents.filter(p => p.slug !== filter.slug); writes++; return { deletedCount: before - documents.length }; },
  });
  const models = {
    '../models/Product': fakeProduct,
    '../models/Category': { find: () => query([{ _id: CAT, name: 'Wine' }]), findById: () => query({ _id: CAT, name: 'Wine' }) },
    '../models/SubCategory': { find: () => query([{ _id: SUB, name: 'Red', parentCategory: CAT }]), findById: () => query({ _id: SUB, parentCategory: CAT }) },
    '../models/User': {}, '../models/Brand': {}, '../services/cloudinary.service': { deleteImage: async () => { assetDeletes++; } },
    '../config/getUser': { getAdmin: async () => ({ role: 'admin' }) },
    '../config/getBlurDataURL': async () => 'fixture-blur',
    mongoose: { ...mongoose, connection: { transaction: async work => {
      const before = structuredClone(documents);
      try { return await work(session); } catch (error) { documents = before; throw error; }
    } } },
  };
  const filename = path.resolve(__dirname, '../src/controllers/product.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(models, name) ? models[name] : real(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  function response() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; }, setHeader() {}, send(body) { this.body = body; return this; } }; }
  return { controller: mod.exports, response, documents: () => documents, writes: () => writes, assetDeletes: () => assetDeletes };
}
async function importText(f, text) {
  const res = f.response();
  await f.controller.importInventoryCSV({ file: { buffer: Buffer.from(text) } }, res);
  return res;
}

test('inventory export/import round-trip preserves multiline descriptions and complete image metadata', async () => {
  const f = fixture(), before = structuredClone(f.documents()[0]);
  const exported = f.response(); await f.controller.exportInventoryCSV({}, exported);
  const res = await importText(f, exported.body);
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.equal(res.body.data.errors.length, 0);
  assert.equal(f.documents()[0].description, before.description);
  assert.deepEqual(f.documents()[0].images, before.images);
  assert.equal(f.documents()[0].sku, '0000123');
});

test('invalid later CSV rows reject the entire import before any writes', async () => {
  const f = fixture(), before = structuredClone(f.documents());
  const res = await importText(f, 'UPC,Stock\n0000123,3\n0000123,not-a-number');
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(f.writes(), 0);
  assert.deepEqual(f.documents(), before);
});

test('unterminated quoted CSV is rejected without writes', async () => {
  const f = fixture();
  const res = await importText(f, 'UPC,Description\n0000123,"unterminated');
  assert.equal(res.statusCode, 400);
  assert.equal(f.writes(), 0);
});

test('gallery replacement requires an explicit Replace Images flag and export includes the full gallery', async () => {
  const f = fixture();
  const exported = f.response(); await f.controller.exportInventoryCSV({}, exported);
  assert.match(exported.body.split('\n')[0], /Images JSON,Replace Images/);
  const res = await importText(f, 'UPC,Image URL,Replace Images\n0000123,/api/images/replacement.jpg,true');
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.equal(f.documents()[0].images.length, 1);
  assert.equal(f.documents()[0].images[0].url, '/api/images/replacement.jpg');
});

test('partial product updates preserve omitted merchandising and image fields', async () => {
  const f = fixture(), before = structuredClone(f.documents()[0]);
  const res = f.response();
  await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body: { category: CAT } }, res);
  assert.equal(res.body.success, true);
  assert.equal(f.documents()[0].isBestSeller, true);
  assert.equal(f.documents()[0].isTopCollection, true);
  assert.deepEqual(f.documents()[0].saleEndsAt, before.saleEndsAt);
  assert.deepEqual(f.documents()[0].images, before.images);
});

test('product edits reject negative prices and incompatible subcategories without writes', async () => {
  for (const body of [{ priceSale: -1 }, { available: 1.5 }, { isBestSeller: 'false' }, { category: 'd'.repeat(24), subCategory: SUB }]) {
    const f = fixture(), res = f.response();
    await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify({ body, response: res.body }));
    assert.equal(f.writes(), 0);
  }
});

test('category-only reassignment clears a subcategory that belongs to the previous parent', async () => {
  const f = fixture(); f.documents()[0].subCategory = SUB;
  const res = f.response();
  await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body: { category: 'd'.repeat(24) } }, res);
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.equal(f.documents()[0].subCategory, null);
});

test('explicit empty image arrays are persisted and missing products return 404', async () => {
  const f = fixture(), res = f.response();
  await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body: { images: [] } }, res);
  assert.equal(res.body.success, true);
  assert.deepEqual(f.documents()[0].images, []);
  const missing = f.response();
  await f.controller.updateProductByAdmin({ params: { slug: 'missing' }, body: { available: 1 } }, missing);
  assert.equal(missing.statusCode, 404);
});

for (const text of ['UPC,Stock\n0000123,-1', 'UPC,Stock\n0000123,2units', 'UPC,Price\n0000123,Infinity', 'UPC,Category\n0000123,Unknown', 'UPC,Best Seller\n0000123,sometimes', 'UPC,Stock,Stock\n0000123,1,2', 'UPC,Stock\n0000123,1,extra']) {
  test(`CSV rejects invalid field or shape: ${JSON.stringify(text)}`, async () => {
    const f = fixture(), res = await importText(f, text);
    assert.equal(res.statusCode, 400, JSON.stringify(res.body));
    assert.equal(f.writes(), 0);
  });
}

test('stock-only CSV preserves all unrelated product data', async () => {
  const f = fixture(), before = structuredClone(f.documents()[0]);
  const res = await importText(f, 'UPC,Stock\n0000123,0');
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.deepEqual(f.documents()[0], { ...before, available: 0 });
});

test('round-trip preserves significant whitespace and CRLF inside descriptions', async () => {
  const f = fixture(); f.documents()[0].description = '  First line\r\nSecond line  ';
  const exported = f.response(); await f.controller.exportInventoryCSV({}, exported);
  const res = await importText(f, exported.body);
  assert.equal(res.body.success, true, JSON.stringify(res.body));
  assert.equal(f.documents()[0].description, '  First line\r\nSecond line  ');
});

test('product creation rejects invalid financial values before persistence', async () => {
  const f = fixture(), res = f.response();
  await f.controller.createProductByAdmin({ body: { name: 'New', slug: 'new', sku: '00999', category: CAT, priceSale: -2, available: 1, images: gallery } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(f.writes(), 0);
});

test('deleting a product removes its record without physically deleting possibly shared assets', async () => {
  const f = fixture(), res = f.response();
  await f.controller.deletedProductByAdmin({ params: { slug: 'fixture' } }, res);
  assert.equal(res.body.success, true);
  assert.equal(f.documents().length, 0);
  assert.equal(f.assetDeletes(), 0);
});

test('uploaded image metadata without a gallery ID can be saved on a product', async () => {
  const f = fixture(), res = f.response();
  const uploaded = { url: '/api/images/uploaded.webp', public_id: 'uploaded.webp', blurDataURL: 'upload-blur', fallbackUrl: null };
  await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body: { images: [...gallery, uploaded] } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const saved = f.documents()[0].images;
  assert.deepEqual(saved.slice(0, 2), gallery);
  assert.equal(saved[2]._id, uploaded.public_id);
  assert.equal(saved[2].url, uploaded.url);
  assert.equal(saved[2].blurDataURL, uploaded.blurDataURL);
});

test('new URL-only gallery images receive distinct IDs while existing IDs are retained', async () => {
  const f = fixture(), res = f.response();
  await f.controller.updateProductByAdmin({ params: { slug: 'fixture' }, body: { images: [gallery[0], { url: '/api/images/new-one.webp' }, { url: '/api/images/new-two.webp' }] } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const saved = f.documents()[0].images;
  assert.equal(saved[0]._id, gallery[0]._id);
  assert.ok(saved[1]._id);
  assert.ok(saved[2]._id);
  assert.notEqual(saved[1]._id, saved[2]._id);
});

test('product creation assigns IDs to uploaded images', async () => {
  const f = fixture(), res = f.response();
  await f.controller.createProductByAdmin({ body: { name: 'New', slug: 'new', code: 'new', sku: '00999', category: CAT, price: 12, priceSale: 0, available: 1, images: [{ url: '/api/images/uploaded.webp', public_id: 'uploaded.webp' }] } }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const saved = f.documents().find(p => p.slug === 'new');
  assert.equal(saved.images[0]._id, 'uploaded.webp');
});
