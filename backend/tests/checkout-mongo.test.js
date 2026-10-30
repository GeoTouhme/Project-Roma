'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const fs = require('node:fs');
const mongoose = require('mongoose');

// Run only inside a disposable, network-isolated namespace with the specifically
// named Mongo fixture host. Never accept an application URI or production secrets.
test('P0 checkout snapshots, concurrent recovery, real signed webhooks and refunds work against isolated MongoDB', {
  skip: process.env.ROMA_P0_ISOLATED_CONTAINER !== '1', timeout: 60000,
}, async () => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture'; process.env.NODE_ENV = 'test';
  for (let tries = 0; ; tries++) {
    try { await mongoose.connect('mongodb://127.0.0.1:27017/roma_p0_checkout_fixture', { serverSelectionTimeoutMS: 1000 }); break; }
    catch (error) { if (tries >= 15) throw error; }
  }
  try {
    assert.equal(mongoose.connection.name, 'roma_p0_checkout_fixture');
    const server = await mongoose.connection.db.admin().command({ serverStatus: 1 });
    assert.match(server.host, /^roma-p0-fixture(?:$|:)/);
    const Category = require('../src/models/Category'), Products = require('../src/models/Product'), Users = require('../src/models/User');
    const Orders = require('../src/models/Order'), Checkouts = require('../src/models/Checkout'), Settings = require('../src/models/settings'), Events = require('../src/models/StripeEvent');
    await Promise.all([Category.init(), Products.init(), Users.init(), Orders.init(), Checkouts.init(), Settings.init(), Events.init()]);
    const cover = { _id: 'fixture', url: '/api/images/fixture.webp', blurDataURL: 'fixture' };
    const category = await Category.create({ name: 'Fixture alcohol', slug: 'fixture-alcohol', restrictionType: 'alcohol', metaTitle: 'Fixture', description: 'Fixture', metaDescription: 'Fixture', status: 'active', cover });
    const product = await Products.create({ name: 'Fixture product', slug: 'fixture-product', sku: 'fixture-product', category: category._id, price: 10, priceSale: 8, saleEndsAt: new Date('2026-01-01'), available: 10, sold: 0, status: 'active', images: [cover] });
    const owner = await Users.create({ firstName: 'Test', lastName: 'Recipient', email: 'fixture@example.test', password: 'synthetic-password', role: 'user', isVerified: true });
    await Settings.create({ key: 'storeConfig', timezone: 'UTC', taxRate: 0, markupRate: 0, deliveryProvider: 'store', operatingHours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, day: ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dayOfWeek], isOpen: true, open: '06:00', close: '02:00' })) });
    const actualPolicy = require('../src/utils/checkoutPolicy');
    const policy = { ...actualPolicy, validateCheckout: opts => actualPolicy.validateCheckout({ ...opts, date: new Date('2026-10-29T12:00:00Z') }) };
    const intents = new Map(), refunds = new Map(); let intentCount = 0, refundCount = 0;
    const sdk = require('stripe')('sk_test_fixture');
    const fakeStripe = { webhooks: sdk.webhooks, paymentIntents: {
      async create(options, request) {
        let intent = [...intents.values()].find(p => p.key === request.idempotencyKey);
        if (!intent) { intentCount++; intent = { id: `pi_fixture${intentCount}`, ...options, status: 'requires_payment_method', latest_charge: { paid: true, refunded: false, amount_refunded: 0, disputed: false }, key: request.idempotencyKey, client_secret: 'synthetic' }; intents.set(intent.id,intent); }
        return intent;
      }, async retrieve(id) { assert.ok(intents.has(id)); return intents.get(id); },
    }, refunds: {
      async list({ payment_intent }) { return { data: [...refunds.values()].filter(r => r.payment_intent === payment_intent) }; },
      async retrieve(id) { return refunds.get(id); },
      async create(options, request) { const prior = [...refunds.values()].find(r => r.key === request.idempotencyKey); if (prior) return prior; refundCount++; const refund = { id: `re_fixture${refundCount}`, status: 'succeeded', ...options, key: request.idempotencyKey }; refunds.set(refund.id,refund); return refund; },
    } };
    function load(file, mocks = {}) {
      const filename = path.resolve(__dirname,'../src',file), mod = new Module(filename,module);
      mod.filename=filename;mod.paths=Module._nodeModulePaths(path.dirname(filename));const real=mod.require.bind(mod);
      mod.require=key=>Object.hasOwn(mocks,key)?mocks[key]:real(key);
      mod._compile('const console={log(){},warn(){},error(){}};\n'+fs.readFileSync(filename,'utf8'),filename);return mod.exports;
    }
    const orderController=load('controllers/order.js',{ stripe:()=>fakeStripe,'../utils/checkoutPolicy':policy,'../utils/mailer':async()=>{},'../utils/socketManager':{emitToAdmins(){}} });
    const recovery=load('services/checkoutRecovery.js',{stripe:()=>fakeStripe,'../controllers/order':orderController});
    const payments=load('controllers/payment-intents.js',{stripe:function(){return fakeStripe;},'../utils/checkoutPolicy':policy});
    const webhook=load('controllers/stripeWebhook.js',{stripe:()=>fakeStripe,'../services/checkoutRecovery':recovery});
    const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}});
    async function start(key) {
      const res=response();await payments.payment_intents({user:{_id:owner._id,email:owner.email},body:{items:[{pid:product._id.toString(),quantity:1}],user:{firstName:'Test',lastName:'Recipient',phone:'0000000000'},fulfillmentType:'pickup',ageAcknowledged:true,termsAccepted:true,policyVersions:require('../src/config/policyVersions.json'),idempotencyKey:key}},res);
      assert.equal(res.statusCode,200,JSON.stringify(res.body));return res.body;
    }
    await Settings.updateOne({key:'storeConfig'},{$set:{defaultDeliveryFee:8,deliveryFeesByZip:[{zip:'92663',fee:5}]}});
    const deliveryUser={firstName:'Test',lastName:'Recipient',phone:'0000000000',address:'1 Synthetic Street',city:'Newport Beach',state:'CA',country:'US',zip:'92663'};
    let quote=response();await orderController.getDeliveryQuote({user:{_id:owner._id,email:owner.email},body:{user:deliveryUser,items:[{pid:String(product._id),quantity:1}]}},quote);
    assert.equal(quote.statusCode,200);assert.equal(quote.body.deliveryFee,5);assert.equal(quote.body.data.fee,500);
    const deliveryPayment=response();await payments.payment_intents({user:{_id:owner._id,email:owner.email},body:{user:deliveryUser,items:[{pid:String(product._id),quantity:1}],fulfillmentType:'delivery',ageAcknowledged:true,termsAccepted:true,policyVersions:require('../src/config/policyVersions.json'),idempotencyKey:'quote-amount-fixture'}},deliveryPayment);
    assert.equal(deliveryPayment.statusCode,200);assert.equal(intents.get(deliveryPayment.body.paymentId).amount,1500);
    const first=await start('mongo-first-attempt');intents.get(first.paymentId).status='succeeded';
    await Products.updateOne({_id:product._id},{$set:{price:99,priceSale:99}});
    await Promise.all(Array.from({length:5},()=>recovery.recoverCheckout({checkoutId:first.checkoutId,ownerId:owner._id})));
    assert.equal(await Orders.countDocuments({paymentId:first.paymentId}),1);
    let saved=await Orders.findOne({paymentId:first.paymentId});assert.equal(saved.total,10);assert.equal(saved.user.firstName,'Test');assert.equal(saved.containsAlcohol,true);assert.ok(saved.ageAcknowledgedAt);assert.ok(saved.policyAcceptance.acceptedAt);assert.equal(saved.policyAcceptance.versions.terms,require('../src/config/policyVersions.json').terms);
    assert.equal((await Products.findById(product._id)).available,9);
    assert.equal((await Checkouts.findById(first.checkoutId)).recoveryState,'completed');
    assert.equal(refundCount,0);
    const second=await start('mongo-second-attempt');intents.get(second.paymentId).status='succeeded';
    const payload=JSON.stringify({id:'evt_fixture',livemode:false,type:'payment_intent.succeeded',data:{object:intents.get(second.paymentId)}});
    const signature=sdk.webhooks.generateTestHeaderString({payload,secret:'whsec_fixture'});
    let res=response();await webhook.handleStripeWebhook({headers:{'stripe-signature':signature},rawBody:Buffer.from(payload+' ')},res);assert.equal(res.statusCode,400);
    for(let retry=0;retry<2;retry++){res=response();await webhook.handleStripeWebhook({headers:{'stripe-signature':signature},rawBody:Buffer.from(payload)},res);assert.equal(res.statusCode,200);}
    assert.equal(await Orders.countDocuments({paymentId:second.paymentId}),1);assert.equal((await Products.findById(product._id)).available,8);assert.ok((await Events.findById('evt_fixture')).processedAt);
    const third=await start('mongo-stock-race');intents.get(third.paymentId).status='succeeded';await Products.updateOne({_id:product._id},{$set:{available:0}});
    assert.equal((await recovery.recoverCheckout({checkoutId:third.checkoutId,ownerId:owner._id})).state,'refunded');
    assert.equal((await recovery.recoverCheckout({checkoutId:third.checkoutId,ownerId:owner._id})).state,'refunded');
    assert.equal(await Orders.countDocuments({paymentId:third.paymentId}),0);assert.equal(refundCount,1);assert.equal((await Checkouts.findById(third.checkoutId)).refundId,'re_fixture1');
    await Products.updateOne({_id:product._id},{$set:{available:1}});
    const fourth=await start('mongo-early-refund');intents.get(fourth.paymentId).status='succeeded';
    await Events.create({_id:'evt_early_refund',type:'charge.refunded',paymentId:fourth.paymentId,amountRefunded:99,fullyRefunded:true});
    assert.equal((await recovery.recoverCheckout({checkoutId:fourth.checkoutId,ownerId:owner._id})).state,'refunded');
    assert.equal(await Orders.countDocuments({paymentId:fourth.paymentId}),0);assert.equal((await Products.findById(product._id)).available,1);

  } finally { await mongoose.disconnect(); }
});
