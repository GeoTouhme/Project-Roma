'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
process.env.JWT_SECRET = 'isolated-test-key-never-used-in-production';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
process.env.NODE_ENV = 'test';
const policySettings = { timezone: 'UTC', operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: true, open: '06:00', close: '02:00' })) };
const policyMock = { ...require('../src/utils/checkoutPolicy'), validateCheckout: options => require('../src/utils/checkoutPolicy').validateCheckout({ ...options, date: new Date('2026-10-29T12:00:00Z') }) };
const A = 'a'.repeat(24), B = 'b'.repeat(24), D = 'd'.repeat(24);
function load(file, mocks = {}) {
  const filename = path.resolve(__dirname, '../src', file), mod = new Module(filename, module);
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
  const real = mod.require.bind(mod);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : real(name);
  mod._compile('const console = { log(){}, warn(){}, error(){} };\n' + fs.readFileSync(filename, 'utf8'), filename);
  return mod.exports;
}
function response() { return { statusCode: 200, status(n) { this.statusCode = n; return this; }, json(b) { this.body = b; return this; }, cookie(){}, clearCookie(){} }; }
function query(value) { return { then(resolve,reject) { return Promise.resolve(value).then(resolve,reject); }, select(){ return this; }, populate(){ return this; }, lean(){ return this; } }; }
function cartFixture({ mix = false, available = 20 } = {}) {
  const product = { _id: A, name: 'Eligible', price: 100, priceSale: 100, available, images: [], category: { _id: B, slug: 'wine' }, status: 'active' };
  const other = { ...product, _id: B, name: 'Expensive', price: 1000, priceSale: 1000, category: { _id: A, slug: 'spirits' } };
  const definition = { _id: D, name: 'Two for $1', status: 'active', productIds: [A], quantity: 2, requiredQty: 2, bundlePrice: 1, conditions: [{ field: 'category', operator: 'equals', value: B }] };
  const { productMatchesBundle } = require('../src/utils/mixBundle');
  const calc = load('utils/orderCalculator.js', {
    '../models/Product': { find: () => query([product, other]) },
    '../models/CouponCode': {}, '../models/Deal': { find: f => query(f._id && !mix ? [definition] : []) },
    '../models/MixBundle': { find: () => query(mix ? [definition] : []) },
    '../models/settings': { findOneOrCreate: async () => ({ taxRate: 0, markupRate: 0 }) },
    './mixBundle': { applyMixBundleDeals: async () => 0, productMatchesBundle },
  });
  const bundle = products => ({ pid: D, type: 'bundle', quantity: 1, products });
  return { calculate: calc.calculateOrderTotals, bundle };
}

test('R04 fixed and mix bundles reject substitution, wrong counts, disabled contents, and aggregate overselling', async () => {
  for (const mix of [false,true]) {
    const { calculate, bundle } = cartFixture({ mix });
    await assert.rejects(calculate({ items: [bundle([{ pid: B, quantity: 2 }])] }), /qualify/);
    await assert.rejects(calculate({ items: [bundle([{ pid: A }])] }), /quantity/);
    const valid = await calculate({ items: [bundle([{ pid: A, quantity: 2 }])], fulfillmentType: 'pickup' });
    assert.equal(valid.expectedAmountCents, 100);
    assert.equal(valid.updatedItems[0].products[0].quantity, 2);
    const limited = cartFixture({ mix, available: 2 });
    await assert.rejects(limited.calculate({ items: [limited.bundle([{ pid: A, quantity: 2 }]), limited.bundle([{ pid: A, quantity: 2 }])] }), /inventory/);
  }
});

test('R04 rejects huge, fractional, negative and malformed carts', async () => {
  const { calculate, bundle } = cartFixture();
  for (const quantity of [0,-1,1.5,101,Infinity]) await assert.rejects(calculate({ items: [{ ...bundle([{ pid: A, quantity: 2 }]), quantity }] }), /quantity/);
  for (const items of [[],[null],Array(101).fill({ pid:A })]) await assert.rejects(calculate({ items }));
});

test('R05 revoked, deleted, disabled, unverified sessions and current roles are enforced', async () => {
  let user = { _id: A, isVerified: true, role: 'user', authSessionId: 'c'.repeat(64) };
  const { authenticateSession } = load('utils/authSession.js', { '../models/User': { findById: () => query(user) } });
  const claims = { _id:A, sid: 'c'.repeat(64), role: 'admin' };
  assert.equal((await authenticateSession(claims)).role, 'user');
  for (const replacement of [null, { ...user, authSessionId: 'd'.repeat(64) }, { ...user, isVerified:false }, { ...user, status:'disabled' }]) {
    user = replacement; await assert.rejects(authenticateSession(claims));
  }
  await assert.rejects(authenticateSession({ _id:A }));
});

test('R13 generic JSON never exposes explicitly selected credential fields', () => {
  const User = require('../src/models/User');
  const user = new User({ firstName:'Test', lastName:'Customer', email:'test@example.test', role:'user', password:'secretsecret', otp:'123456', mfaSecret:'ciphertext', mfaTempSecret:'pending', authSessionId:'c'.repeat(64), refreshTokenHash:'hash', passwordResetTokenHash:'hash' });
  const json = user.toJSON();
  for (const field of ['password','otp','mfaSecret','mfaTempSecret','authSessionId','refreshTokenHash','passwordResetTokenHash']) assert.equal(json[field], undefined);
  assert.equal(json.firstName, 'Test');
});

test('R14 legacy role toggle rejects ordinary admins before any target lookup', async () => {
  let reads=0;
  const controller = load('controllers/admin.js', { '../models/User': { findById: () => { reads++; throw new Error('must not read'); } }, '../models/Order': {} });
  const res = response(); await controller.UpdateRoleByAdmin({ user:{ role:'admin' }, params:{ id:B } },res);
  assert.equal(res.statusCode,403); assert.equal(reads,0);
});

test('R15 image decoding rejects HTML/SVG, extension and MIME spoofing; strips trailing active content', async () => {
  const sharp = require('sharp'); const { sanitizeImage } = require('../src/utils/safeImage');
  const png = await sharp({ create: { width:2, height:2, channels:3, background:'#fff' } }).png().toBuffer();
  for (const [buffer,name,mime] of [[Buffer.from('<svg><script>alert(1)</script></svg>'),'x.png','image/png'], [png,'x.html','image/png'], [png,'x.jpg','image/jpeg'], [png,'x.png','image/svg+xml']]) await assert.rejects(sanitizeImage(buffer,name,mime));
  const safe = await sanitizeImage(Buffer.concat([png,Buffer.from('<script>private-fixture</script>')]),'test.png','image/png');
  assert.equal((await sharp(safe).metadata()).format,'webp');
  assert.equal(safe.includes(Buffer.from('private-fixture')), false);
  const big = await sharp({ create: { width:8193,height:1,channels:3,background:'#fff' } }).png().toBuffer();
  await assert.rejects(sanitizeImage(big,'big.png','image/png'));
});

test('R18 checkout hash ignores presentation but binds products, quantities, amount and currency', () => {
  const { checkoutHash } = require('../src/utils/checkoutBinding');
  const cart = { expectedAmountCents: 1000, fulfillmentType:'pickup', updatedItems:[{ pid:A, quantity:1, price:10 }] };
  const first=checkoutHash(cart,'usd');
  assert.equal(first,checkoutHash({ ...cart, updatedItems:[{ ...cart.updatedItems[0], name:'other' }] },'usd'));
  assert.notEqual(first,checkoutHash(cart,'eur'));
  assert.notEqual(first,checkoutHash({ ...cart, expectedAmountCents:999 },'usd'));
  assert.notEqual(first,checkoutHash({ ...cart, updatedItems:[{ pid:B,quantity:1,price:10 }] },'usd'));
});

test('R08 signature rejection and durable failure return non-2xx; retries do not reapply processed events', async () => {
  let event, saved, applies=0, durableFailure=false;
  const events={ async updateOne(filter,change) {
    if(durableFailure) throw new Error('database down');
    if(change.$setOnInsert && !saved) saved={ _id:filter._id,...change.$setOnInsert };
    if(change.$set) Object.assign(saved,change.$set);
  }, async findById(){ return saved; } };
  const controller=load('controllers/stripeWebhook.js', { stripe: () => ({ webhooks: { constructEvent(){ if(!event)throw new Error('bad signature');return event; } } }), '../models/StripeEvent':events,'../models/Order':{async updateOne(){applies++;}} });
  let res=response();await controller.handleStripeWebhook({ headers:{} },res);assert.equal(res.statusCode,400);
  event={ id:'evt_mock',livemode:false,type:'payment_intent.succeeded',data:{object:{id:'pi_mock'}} };
  durableFailure=true;res=response();await controller.handleStripeWebhook({headers:{}},res);assert.equal(res.statusCode,503);assert.equal(applies,0);
  durableFailure=false;
  for(let i=0;i<2;i++){ res=response();await controller.handleStripeWebhook({headers:{}},res);assert.equal(res.statusCode,200); }
  assert.equal(applies,1);assert.ok(saved.processedAt);
});

test('R08 refunds use cumulative max and payment success never resets fulfillment', async () => {
  const writes=[];const { applyEvent }=load('controllers/stripeWebhook.js',{stripe:()=>({}), '../models/StripeEvent':{}, '../models/Order':{async updateOne(filter,change){writes.push({filter,change});}}});
  await applyEvent({type:'charge.refunded',paymentId:'pi_mock',amountRefunded:5,fullyRefunded:false});
  await applyEvent({type:'payment_intent.succeeded',paymentId:'pi_mock'});
  assert.deepEqual(writes[0].change,{$max:{refundedAmount:5}});
  assert.equal(writes[1].change.$set.status,undefined);
});

test('R22 retired report and analyzer cannot collect or export raw logs', async () => {
  const report=require('../src/jobs/dailyLogReport'); assert.deepEqual(await report.runDailyReport(),{disabled:true});
  await assert.rejects(require('../src/utils/logAnalyzer').fetchBackendLogs());
});

test('R09 concurrent cancellation has one winner, counts bundle units, and uses stable refund idempotency', async () => {
  let state={ _id:D,status:'pending',items:[{type:'bundle',quantity:3,products:[{pid:A,quantity:2},{pid:B,quantity:1}]}],user:{_id:A},paymentMethod:'Stripe',paymentId:'pi_mock',total:9,orderNo:'TEST' };
  const stock=[],refunds=[];
  const controller=load('controllers/order.js',{
    '../models/Order':{
      async findById(){return structuredClone(state);},
      async findOneAndUpdate(filter,change){if(!filter.status.$in.includes(state.status)||state.cancellationStartedAt)return null;Object.assign(state,change.$set);return structuredClone(state);},
      async findByIdAndUpdate(id,change){Object.assign(state,change.$set);},
    },
    '../models/Product':{async updateOne(filter,change){stock.push({filter,change});}},
    '../models/Notification':{async create(){return {}; }},
    '../utils/socketManager':{emitToAdmins(){}},
    stripe:()=>({refunds:{async list(){return {data:[]};},async create(payload,options){refunds.push({payload,options});return{id:'re_mock',status:'succeeded'};}}}),
  });
  const req={params:{id:D},body:{reason:'fixture'},user:{_id:A}};
  const responses=[response(),response()];
  await Promise.all(responses.map(res=>controller.cancelOrderByCustomer(req,res)));
  assert.deepEqual(responses.map(x=>x.statusCode).sort(),[200,400]);
  assert.equal(stock.length,2);assert.equal(stock[0].change.$inc.available,6);assert.equal(stock[1].change.$inc.available,3);
  assert.equal(refunds.length,1);assert.equal(refunds[0].options.idempotencyKey,`roma-cancel-refund-${D}`);
  assert.equal(state.status,'cancelled');assert.equal(state.cancellationEffectsPending,false);
});

test('R19 ownerless and foreign-owned order reads fail closed', async () => {
  let order={user:{}};
  const controller=load('controllers/order.js',{'../models/Order':{async findById(){return order;}}});
  for(const owner of [undefined,B,A]){
    order={user:{_id:owner}};const res=response();
    await controller.getOrderById({params:{id:D},user:{_id:A}},res);
    assert.equal(res.statusCode,owner===A?200:403);
  }
});

test('R11 MFA key rollover preserves enrollments with an independent encryption key', () => {
  const cipher=require('../src/utils/mfaCipher');
  const old=process.env.MFA_SECRET_KEY, previous=process.env.MFA_PREVIOUS_SECRET_KEY;
  try {
    process.env.MFA_SECRET_KEY='old-test-encryption-key';
    const before=cipher.encryptMfaSecret('SYNTHETICTOTP');
    process.env.MFA_SECRET_KEY='independent-new-test-encryption-key';
    process.env.MFA_PREVIOUS_SECRET_KEY='old-test-encryption-key';
    assert.equal(cipher.decryptMfaSecret(before),'SYNTHETICTOTP');
    const after=cipher.encryptMfaSecret(cipher.decryptMfaSecret(before));
    delete process.env.MFA_PREVIOUS_SECRET_KEY;
    assert.equal(cipher.decryptMfaSecret(after),'SYNTHETICTOTP');
    assert.throws(()=>cipher.decryptMfaSecret(before));
  } finally {
    if(old===undefined)delete process.env.MFA_SECRET_KEY;else process.env.MFA_SECRET_KEY=old;
    if(previous===undefined)delete process.env.MFA_PREVIOUS_SECRET_KEY;else process.env.MFA_PREVIOUS_SECRET_KEY=previous;
  }
});

test('R18 intent creation binds owner and canonical cart; caller keys cannot share another owner namespace', async () => {
  const calls=[];const writes=[];
  const totals={expectedAmountCents:1000,fulfillmentType:'pickup',updatedItems:[{pid:A,quantity:1,price:10}],products:[{category:{slug:'wine'}}]};
  const controller=load('controllers/payment-intents.js',{
    stripe:function(){return{paymentIntents:{async create(options,request){calls.push({options,request});return{id:'pi_mock',client_secret:'synthetic_secret'};}}};},
    '../models/Checkout':{async updateOne(filter,change){writes.push({filter,change});}},
    '../utils/orderCalculator':{async calculateOrderTotals(){return totals;}},
    '../models/settings':{async findOneOrCreate(){return policySettings;}}, '../utils/checkoutPolicy':policyMock,
  });
  for(const owner of [A,B]){
    const res=response();await controller.payment_intents({user:{_id:owner},body:{items:[],fulfillmentType:'pickup',ageAcknowledged:true,termsAccepted:true,policyVersions:require('../src/config/policyVersions.json'),user:{firstName:'Test',lastName:'Recipient',phone:'0000000000'},idempotencyKey:'same-client-key'}},res);
    assert.equal(res.statusCode,200);
  }
  assert.equal(calls[0].options.metadata.ownerId,A);assert.equal(calls[1].options.metadata.ownerId,B);
  assert.notEqual(calls[0].request.idempotencyKey,calls[1].request.idempotencyKey);
  assert.equal(writes[0].change.$setOnInsert.owner,A);
});

test('R18 existing paid-order responses require immutable owner identity before exposing identifiers', async () => {
  const controller=load('controllers/order.js',{'../models/Order':{async findOne(){return{_id:D,orderNo:'PRIVATE',user:{_id:B}};}}});
  const res=response();await controller.createOrder({user:{_id:A},body:{paymentMethod:'Stripe',paymentId:'pi_mock',items:[{pid:A,quantity:1}],fulfillmentType:'pickup'}},res);
  assert.equal(res.statusCode,403);assert.equal(res.body.orderId,undefined);assert.equal(res.body.orderNo,undefined);
});

test('R08 an order records the verified settled payment even when the success webhook arrived first', async () => {
  const totals={expectedAmountCents:1000,orderTotal:10,grandTotal:10,discount:0,tax:0,markupTotal:0,sanitizedTip:0,deliveryFee:0,fulfillmentType:'pickup',
    updatedItems:[{pid:A,quantity:1,price:10,priceSale:10,total:10}],products:[{_id:A,name:'Fixture',price:10,available:2,category:{slug:'wine'}}]};
  const {checkoutHash}=require('../src/utils/checkoutBinding');let saved;
  const orders={async updateOne(){return{matchedCount:0};},async findOne(){return null;},async create(value){saved={_id:D,...value};return saved;}};
  const early=load('controllers/stripeWebhook.js',{stripe:()=>({}),'../models/Order':orders,'../models/StripeEvent':{}});
  await early.applyEvent({type:'payment_intent.succeeded',paymentId:'pi_fixture'});
  const controller=load('controllers/order.js',{
    '../models/Order':orders,'../models/Product':{async findOneAndUpdate(){return{_id:A};}},
    '../models/Checkout':{async exists(){return true;},async findOneAndUpdate(){return{_id:D};},async updateOne(){}},
    '../models/User':{async findByIdAndUpdate(){}},'../models/Notification':{async create(){return[{_id:B}];}},
    '../models/settings':{async findOneOrCreate(){return policySettings;}},'../utils/checkoutPolicy':policyMock,
    '../utils/orderCalculator':{async calculateOrderTotals(){return totals;}},'../utils/mailer':async()=>{},'../utils/socketManager':{emitToAdmins(){}},
    fs:{readFileSync:()=>'<div>{{items}}</div>'},
    stripe:()=>({paymentIntents:{async retrieve(){return{id:'pi_fixture',status:'succeeded',currency:'usd',amount:1000,metadata:{ownerId:A,checkoutId:D,cartHash:checkoutHash(totals,'usd')}};}}}),
  });
  const res=response();await controller.createOrder({user:{_id:A,email:'fixture@example.test'},body:{items:[{pid:A,quantity:1}],paymentMethod:'Stripe',paymentId:'pi_fixture',fulfillmentType:'pickup',ageAcknowledged:true,termsAccepted:true,policyVersions:require('../src/config/policyVersions.json'),user:{firstName:'Test',lastName:'Fixture',phone:'0000000000'}}},res);
  assert.equal(res.statusCode,201);assert.equal(saved.paymentStatus,'succeeded');assert.equal(saved.status,'pending');
});


test('pending cancellation refunds remain durable and retry confirms the same refund without a second payment call', async () => {
  let state={_id:D,status:'pending',items:[],user:{_id:A},paymentMethod:'Stripe',paymentId:'pi_mock',total:9,orderNo:'TEST'}, creates=0, refund={id:'re_pending',status:'pending',amount:900,metadata:{orderId:D}};
  const controller=load('controllers/order.js',{
    '../models/Order':{async findById(){return structuredClone(state);},async findOneAndUpdate(filter,change){Object.assign(state,change.$set);return structuredClone(state);},async findByIdAndUpdate(id,change){Object.assign(state,change.$set);},async updateOne(filter,change){Object.assign(state,change.$set);}},
    '../models/Product':{async updateOne(){}},'../models/Notification':{async create(){return{};}},'../utils/socketManager':{emitToAdmins(){}},
    stripe:()=>({refunds:{async list(){return{data:[]};},async retrieve(id){assert.equal(id,refund.id);return refund;},async create(){creates++;return refund;}}}),
  });
  const req={params:{id:D},body:{reason:'Fixture'},user:{_id:A}};
  let res=response();await controller.cancelOrderByCustomer(req,res);assert.equal(res.statusCode,200);assert.equal(state.cancellationEffectsPending,true);assert.equal(state.refundId,'re_pending');assert.equal(state.refundStatus,'pending');
  res=response();await controller.retryCancellation(req,res);assert.equal(res.statusCode,503);assert.equal(state.cancellationEffectsPending,true);assert.equal(creates,1);
  refund.status='succeeded';res=response();await controller.retryCancellation(req,res);assert.equal(res.statusCode,200);assert.equal(state.cancellationEffectsPending,false);assert.equal(state.paymentStatus,'refunded');assert.equal(creates,1);
});
