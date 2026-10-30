'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const fs = require('node:fs');
const path = require('node:path');
const ID = '507f1f77bcf86cd799439011';
const OTHER = '507f1f77bcf86cd799439012';
function load(name, mocks) {
  const filename = path.resolve(__dirname, `../src/controllers/${name}.js`);
  const mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = dep => dep in mocks ? mocks[dep] : dep === '../utils/validators' ? real(dep) : {};
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}
function response() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } }; }
function ordersFixture() {
  const rows = Array.from({ length: 35 }, (_, i) => ({ _id: String(i), status: i < 15 ? 'shipped' : 'pending', fulfillmentType: 'pickup' }));
  const calls = [];
  const matches = filter => rows.filter(row => Object.entries(filter).every(([key, value]) => row[key] === value));
  const Orders = {
    schema: require('../src/models/Order').schema,
    countDocuments: async filter => { calls.push(['count', filter]); return matches(filter).length; },
    aggregate: async pipeline => { calls.push(['aggregate', pipeline]); return matches(pipeline[0].$match).slice(pipeline[2].$skip, pipeline[2].$skip + pipeline[3].$limit); },
  };
  return { controller: load('order', { '../models/Order': Orders }), calls };
}
test('order status filtering happens before count and pagination, including empty pages and all statuses', async () => {
  const f = ordersFixture();
  for (const [status, page, total, length] of [['pending', 1, 20, 10], ['pending', 2, 20, 10], ['pending', 3, 20, 0], ['shipped', 2, 15, 5], ['delivered', 1, 0, 0]]) {
    const res = response();
    await f.controller.getOrdersByAdmin({ query: { status, page, limit: 10, fulfillmentType: 'pickup' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.total, total, `${status} total`);
    assert.equal(res.body.count, Math.ceil(total / 10));
    assert.equal(res.body.data.length, length);
    assert.ok(res.body.data.every(row => row.status === status));
    assert.equal(f.calls.at(-2)[1].status, status);
    assert.deepEqual(f.calls.at(-1)[1][0].$match, f.calls.at(-2)[1]);
  }
});
function dealFixture({ status = 'active', displayOnHome = true, unavailable = 1, existingCount = 1 } = {}) {
  const productQueries = [], writes = [];
  const stored = { _id: ID, status, displayOnHome, productIds: [ID], name: 'Original' };
  const controller = load('deal', {
    '../models/Deal': {
      findById: async () => stored,
      findByIdAndUpdate: async (id, update, options) => { writes.push({ update, options }); return { ...stored, ...update.$set }; },
      create: async data => { writes.push(data); return data; },
    },
    '../models/Product': { countDocuments: async query => { productQueries.push(query); return query.$or ? unavailable : existingCount; } },
  });
  return { controller, productQueries, writes, stored };
}
test('deactivation and homepage hiding allow unchanged unavailable or deleted products', async () => {
  for (const body of [{ status: 'inactive', productIds: [ID] }, { status: 'active', displayOnHome: false, productIds: [ID] }, { status: 'inactive' }, { displayOnHome: false }]) {
    const f = dealFixture({ existingCount: 0 }); const res = response();
    await f.controller.updateDeal({ params: { id: ID }, body }, res);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(f.productQueries.length, 0);
    assert.equal(f.writes.length, 1);
    assert.deepEqual(f.writes[0].update.$set, body);
  }
});
test('activation and homepage enabling validate existing unavailable products even without productIds', async () => {
  for (const body of [{ status: 'active' }, { displayOnHome: true }, { status: 'active', displayOnHome: false }]) {
    const f = dealFixture({ status: 'inactive', displayOnHome: false }); const res = response();
    await f.controller.updateDeal({ params: { id: ID }, body }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(f.writes.length, 0);
  }
});
test('deal creation persists explicit inactive status and defaults to active', async () => {
  for (const status of ['inactive', 'active', undefined]) {
    const f = dealFixture({ unavailable: 0 }); const res = response();
    await f.controller.createDeal({ body: { name: 'Deal', productIds: [ID], quantity: 1, bundlePrice: 5, ...(status === undefined ? {} : { status }) } }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(f.writes[0].status, status || 'active');
  }
});
for (const operation of ['createDeal', 'updateDeal']) test(`${operation} rejects invalid status before writing`, async () => {
  for (const status of ['', 'disabled', null, {}, ['active']]) {
    const f = dealFixture({ unavailable: 0 }); const res = response();
    await f.controller[operation]({ params: { id: ID }, body: { name: 'Deal', productIds: [ID], status } }, res);
    assert.equal(res.statusCode, 400, JSON.stringify(status));
    assert.equal(f.writes.length, 0);
  }
});
module.exports = { load, response, ID, OTHER };
