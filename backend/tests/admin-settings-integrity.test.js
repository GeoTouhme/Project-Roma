'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
function fixture() {
  let saved, writes = 0;
  const filename = path.resolve(__dirname, '../src/controllers/settings.js'), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = name => name === '../models/settings' ? { findOneAndUpdate: async (filter, update) => { writes++; saved = update.$set; return saved; } } : real(name);
  mod._compile(fs.readFileSync(filename, 'utf8'), filename);
  const res = { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
  return { update: body => mod.exports.updateSettings({ body }, res), res, saved: () => saved, writes: () => writes };
}
test('ZIP fee settings normalize whitespace without changing unrelated settings', async () => {
  const f = fixture(); await f.update({ deliveryFeesByZip: [{ zip: ' 92663 ', fee: 4 }] });
  assert.equal(f.res.statusCode, 200);
  assert.deepEqual(f.saved(), { deliveryFeesByZip: [{ zip: '92663', fee: 4 }] });
});
for (const [name, body] of [
  ['duplicate normalized ZIPs', { deliveryFeesByZip: [{ zip: '92663', fee: 4 }, { zip: '92663 ', fee: 5 }] }],
  ['invalid ZIPs', { deliveryFeesByZip: [{ zip: 'abc', fee: 4 }] }],
  ['non-finite delivery fee', { defaultDeliveryFee: NaN }],
  ['non-finite tax', { taxRate: NaN }],
  ['invalid timezone', { timezone: 'Not/A_Timezone' }],
]) test(`settings reject ${name} before any write`, async () => {
  const f = fixture(); await f.update(body);
  assert.equal(f.res.statusCode, 400, JSON.stringify(f.res.body));
  assert.equal(f.writes(), 0);
});
