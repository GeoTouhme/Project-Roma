const test = require('node:test'), assert = require('node:assert/strict'), mongoose = require('mongoose');
test('privacy exports, request deduplication, holds and TTL verification use a disposable isolated database', { skip: process.env.ROMA_P0_ISOLATED_CONTAINER !== '1', timeout:60000 }, async () => {
  for(let tries=0;;tries++) { try { await mongoose.connect('mongodb://127.0.0.1:27017/roma_p0_checkout_fixture',{serverSelectionTimeoutMS:1000}); break; } catch(error) { if(tries>=15)throw error; } }
  try {
    assert.equal(mongoose.connection.name,'roma_p0_checkout_fixture'); assert.match((await mongoose.connection.db.admin().command({serverStatus:1})).host,/^roma-p0-fixture(?:$|:)/);
    const Users=require('../src/models/User'), Orders=require('../src/models/Order'), Checkouts=require('../src/models/Checkout'), Reviews=require('../src/models/Review'), Newsletter=require('../src/models/Newsletter'), Coupon=require('../src/models/CouponCode'), PageView=require('../src/models/PageView'), Requests=require('../src/models/PrivacyRequest'), Notifications=require('../src/models/Notification');
    await Promise.all([Users,Orders,Checkouts,Reviews,Newsletter,Coupon,PageView,Requests,Notifications].map(m=>m.init()));
    const owner=await Users.create({firstName:'Privacy',lastName:'Fixture',email:'privacy@example.test',password:'synthetic-password',role:'user',isVerified:true,authSessionId:'secret-fixture-session'});
    const foreign=await Users.create({firstName:'Foreign',lastName:'Fixture',email:'foreign@example.test',password:'synthetic-password',role:'user',isVerified:true});
    const order=await Orders.create({paymentMethod:'Stripe',orderNo:'PRIVACY-1',subTotal:10,total:10,totalItems:1,shipping:0,user:{_id:owner._id,firstName:'Privacy',lastName:'Fixture',email:owner.email,phone:'0000000000',address:'Synthetic address'},items:[],staffNotes:'INTERNAL STAFF NOTE'});
    await Orders.create({paymentMethod:'Stripe',orderNo:'FOREIGN-1',subTotal:99,total:99,totalItems:1,shipping:0,user:{_id:foreign._id,firstName:'Foreign',lastName:'Fixture',email:foreign.email,phone:'0000000000'},items:[]});
    await Checkouts.create({_id:'privacy-checkout',owner:owner._id,cartHash:'fixture',version:2,requestSnapshot:{user:{email:owner.email},items:[],clientIp:'127.0.0.1'},bindingSnapshot:{private:'INTERNAL CLAIM'},totalsSnapshot:{},recoveryState:'manual_review'});
    await Reviews.create({user:owner._id,product:new mongoose.Types.ObjectId(),review:'Fixture review',rating:5,isPurchased:false});
    await Newsletter.create({email:owner.email});
    await Coupon.create({name:'Fixture',code:'PRIVACY',discount:1,type:'fixed',usageHistory:[{user:owner._id,email:owner.email,name:'Privacy Fixture',total:10},{user:foreign._id,email:foreign.email,name:'Foreign Fixture',total:99}]});
    await PageView.create({owner:owner._id,productSlug:'fixture-product',consentVersion:'fixture',ip:'legacy-ip',userAgent:'legacy-agent',sessionId:'legacy-session'});
    await Notifications.create({opened:false,title:'Order fixture',orderId:String(order._id),city:'Fixture city',paymentMethod:'Stripe'});
    const controller=require('../src/controllers/privacy'), service=require('../src/services/privacyOperations');
    const response=()=>({statusCode:200,status(s){this.statusCode=s;return this;},json(body){this.body=body;return this;},set(){return this;}});
    await Promise.all(Array.from({length:3},async()=>{const res=response();await controller.submit({user:{_id:owner._id},body:{type:'delete'}},res);assert.equal(res.statusCode,202);}));
    assert.equal(await Requests.countDocuments({owner:owner._id,type:'delete'}),1);
    const request=await Requests.findOne({owner:owner._id});
    let res=response(); await controller.review({params:{id:String(request._id)},user:{_id:foreign._id},body:{status:'held',legalHold:true,response:'Under review',staffNote:'INTERNAL HOLD NOTE'}},res);assert.equal(res.statusCode,200);
    res=response();await controller.review({params:{id:String(request._id)},user:{_id:foreign._id},body:{status:'resolved',legalHold:false,response:'Done',staffNote:'',resolutionEvidence:'fixture'}},res);assert.equal(res.statusCode,409);
    const exported=await service.exportAccount(owner._id), text=JSON.stringify(exported);
    assert.equal(exported.orders.length,1);assert.equal(exported.reviews.length,1);assert.equal(exported.newsletter.length,1);assert.equal(exported.analytics.length,1);assert.equal(exported.notifications.length,1);assert.equal(exported.coupons[0].usage.length,1);
    for(const value of [foreign.email,'FOREIGN-1','secret-fixture-session','synthetic-password','INTERNAL STAFF NOTE','INTERNAL HOLD NOTE','INTERNAL CLAIM','legacy-ip','legacy-agent','legacy-session'])assert.equal(text.includes(value),false,value);
    assert.ok(exported.checkouts[0].checkout.user.email);
    const report=await service.retentionReport();assert.equal(report.cleanupEnabled,false);assert.equal(report.analyticsTtlVerified,true);assert.ok(report.holds>=1);assert.ok(report.unresolvedPayments>=1);
    res=response(); await controller.listOwn({user:{_id:foreign._id}},res);assert.equal(res.body.data.length,0);
    assert.equal(await Users.countDocuments({_id:owner._id}),1);assert.equal(await Orders.countDocuments({'user._id':owner._id}),1);
  } finally { await mongoose.disconnect(); }
});
