const test = require('node:test'), assert = require('node:assert/strict');
const { activeSalePrice } = require('../src/utils/salePricing');
const { policyAcceptance, versions } = require('../src/utils/policyAcceptance');
const { validateException } = require('../src/controllers/deliveryReview');
const { validateReview } = require('../src/controllers/privacy');
const { retentionConfiguration } = require('../src/services/privacyOperations');
const { privateHash, referrerOrigin, deviceSummary } = require('../src/utils/privacyData');
test('sale prices must be positive, below regular price and unexpired; malformed expiry fails closed', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  for (const saleEndsAt of ['2026-10-28', 'invalid', '2026-10-29T12:00:00Z']) assert.equal(activeSalePrice({price:10,priceSale:8,saleEndsAt},now),0);
  assert.equal(activeSalePrice({price:10,priceSale:8,saleEndsAt:'2026-10-30'},now),8);
  assert.equal(activeSalePrice({price:10,priceSale:8},now),8);
  for(const sale of [-1,0,10,11]) assert.equal(activeSalePrice({price:10,priceSale:sale},now),0);
});
test('acceptance is explicit and bound to both current documents', () => {
  for(const body of [{},{termsAccepted:'true',policyVersions:versions},{termsAccepted:true,policyVersions:{...versions,terms:'old'}},{termsAccepted:true,policyVersions:{...versions,delivery:'old'}}]) assert.throws(()=>policyAcceptance(body));
  const date = new Date(); assert.deepEqual(policyAcceptance({termsAccepted:true,policyVersions:versions},date),{versions,acceptedAt:date,source:'checkout'});
});
test('delivery exceptions cannot revive terminal or unpaid orders; returns require receipt', () => {
  const order={status:'shipped',paymentStatus:'succeeded',fulfillmentType:'delivery'};
  assert.equal(validateException(order,{type:'failed',reason:'Recipient unavailable'}),undefined);
  assert.equal(validateException(order,{type:'returned',reason:'Goods returned',goodsReceived:true}),undefined);
  assert.ok(validateException(order,{type:'returned',reason:'Unknown'}));
  for(const status of ['refunded','cancelled','denied','disputed','delivered','returned']) assert.ok(validateException({...order,status},{type:'failed',reason:'test'}));
  assert.ok(validateException({...order,paymentStatus:'pending'},{type:'failed',reason:'test'}));
});
test('deletion completion is blocked and closed privacy requests need evidence', () => {
  const body={status:'resolved',legalHold:false,response:'Reviewed',staffNote:'',resolutionEvidence:'ticket-1'};
  assert.ok(validateReview(body,{type:'delete'})); assert.ok(validateReview({...body,legalHold:true},{type:'access'}));
  assert.ok(validateReview({...body,resolutionEvidence:''},{type:'access'})); assert.equal(validateReview(body,{type:'access'}),undefined);
});
test('retention has no destructive default, invalid and incomplete policies are not approved', () => {
  assert.equal(retentionConfiguration({}).cleanupEnabled,false); assert.equal(retentionConfiguration({}).approved,false);
  assert.throws(()=>retentionConfiguration({DATA_RETENTION_POLICY_JSON:'[]'}));
  const config={version:'v1',approvedBy:'fixture',approvedAt:'2026-10-29',days:Object.fromEntries(['orders','accounts','checkouts','analytics','logs','backups'].map(k=>[k,90]))};
  const result=retentionConfiguration({DATA_RETENTION_POLICY_JSON:JSON.stringify(config)}); assert.equal(result.approved,true);assert.equal(result.cleanupEnabled,false);
});
test('privacy metadata drops URL credentials/query/fragments and raw user agent; hashes vary by purpose/day', () => {
  assert.equal(referrerOrigin('https://store.example/path?token=secret#data'),'https://store.example');
  assert.equal(referrerOrigin('javascript:alert(1)'),'');
  assert.deepEqual(deviceSummary('Mozilla iPhone Mobile Safari/123'),{deviceType:'mobile',browserFamily:'Safari'});
  const prior=process.env.PRIVACY_HASH_SECRET;process.env.PRIVACY_HASH_SECRET='fixture-only';
  try { assert.notEqual(privateHash('127.0.0.1','analytics','2026-10-29'),privateHash('127.0.0.1','analytics','2026-10-30')); assert.equal(privateHash('127.0.0.1').length,64); }
  finally { if(prior===undefined)delete process.env.PRIVACY_HASH_SECRET;else process.env.PRIVACY_HASH_SECRET=prior; }
});

test('analytics refuses missing consent and GPC before any database write, and strips raw identifiers on opt in', async () => {
  const fs=require('node:fs'),Module=require('node:module'),path=require('node:path'),writes=[];
  const filename=path.resolve(__dirname,'../src/controllers/analytics.js'),mod=new Module(filename,module);mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const real=mod.require.bind(mod);
  mod.require=key=>key==='../models/PageView'?{async create(value){writes.push(value);}}:real(key);mod._compile(fs.readFileSync(filename,'utf8'),filename);
  const body={productSlug:'fixture-product',pageType:'product',analyticsConsent:true,consentVersion:'analytics-2026-10-29-v1'};
  const run=async(body,gpc)=>{const res={statusCode:200,status(n){this.statusCode=n;return this;},end(){return this;},json(value){this.body=value;return this;}};await mod.exports.trackView({body,realIp:'127.0.0.1',get(name){return name==='Sec-GPC'?gpc:name==='Referer'?'https://example.test/private?secret=fixture':name==='User-Agent'?'Mozilla iPhone Mobile Safari/123':'';}},res);return res;};
  for(const input of [{...body,analyticsConsent:false},{...body,analyticsConsent:'true'},{...body,consentVersion:'old'},{...body,productSlug:'/checkout/return'}])assert.equal((await run(input)).statusCode,204);
  assert.equal((await run(body,'1')).statusCode,204);assert.equal(writes.length,0);assert.equal((await run(body)).statusCode,200);assert.equal(writes.length,1);
  assert.equal(writes[0].ip,undefined);assert.equal(writes[0].userAgent,undefined);assert.equal(writes[0].referrer,'https://example.test');assert.equal(writes[0].deviceType,'mobile');
});

test('both storefront HTML entry templates omit unconditional analytics and external font loaders', () => {
  const fs=require('node:fs'),path=require('node:path');
  for(const relative of ['customer-panel/index.html','customer-panel/public/index.html']) {
    const file=path.resolve(__dirname,'../..',relative);assert.doesNotMatch(fs.readFileSync(file,'utf8'),/googletagmanager|google-analytics|fonts.googleapis/);
  }
});
