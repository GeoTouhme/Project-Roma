'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
function fixture({ found = true, productReferences = false, subReferences = false } = {}) {
  let deletes = 0;
  const doc = found ? { _id: 'a'.repeat(24), cover: {}, subCategories: [] } : null;
  const models = {
    '../models/Category': { findOne: async () => doc, findOneAndUpdate: async () => null, findOneAndDelete: async () => { deletes++; return doc; } },
    '../models/SubCategory': { exists: async () => subReferences },
    '../models/Product': { exists: async () => productReferences },
    '../models/User': {}, '../services/cloudinary.service': {},
  };
  const filename = path.resolve(__dirname, '../src/controllers/category.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod); mod.require = name => Object.hasOwn(models, name) ? models[name] : real(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const response = () => ({ statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } });
  return { controller: mod.exports, response, deletes: () => deletes };
}
for (const refs of [{ productReferences: true }, { subReferences: true }]) test(`category deletion refuses referenced entities: ${JSON.stringify(refs)}`, async () => {
  const f = fixture(refs), res = f.response();
  await f.controller.deleteCategoryBySlug({ params: { slug: 'fixture' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(f.deletes(), 0);
});
test('missing category edits report 404 rather than success', async () => {
  const f = fixture({ found: false }), res = f.response();
  await f.controller.updateCategoryBySlug({ params: { slug: 'missing' }, body: { cover: { url: '/api/images/fixture.jpg', blurDataURL: 'fixture' }, name: 'Name' } }, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.success, false);
});
