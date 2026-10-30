'use strict';
const fs = require('fs'), assert = require('assert/strict'), path = require('path');
const root = path.resolve(__dirname, '..');
for (const file of ['storeIdentity.json', 'policyVersions.json']) {
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root,'backend/src/config',file))), JSON.parse(fs.readFileSync(path.join(root,'customer-panel/src/config',file))), `${file} differs between apps`);
}
const crypto = require('crypto');
const versions = require('../backend/src/config/policyVersions.json');
for (const [key, relative] of Object.entries({terms:'customer-panel/src/pages/Terms/Terms.jsx', privacy:'customer-panel/src/pages/Privacy/Privacy.jsx', delivery:'customer-panel/src/pages/DeliveryRefund/DeliveryRefund.jsx', accessibility:'customer-panel/src/pages/Accessibility/Accessibility.jsx'})) {
  assert.equal(versions[key], crypto.createHash('sha256').update(fs.readFileSync(path.join(root,relative))).digest('hex'), `${key} changed: review and regenerate the policy version manifest`);
}
console.log('Shared store identity and policy versions match.');
