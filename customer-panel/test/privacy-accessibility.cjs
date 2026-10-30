// Entirely synthetic browser check: every API and external request is intercepted.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.env.STOREFRONT_BUILD || path.join(__dirname, '../build'));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.webp':'image/webp', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[], checks=[];
  async function context(gpc=false, accepted=false) {
    const ctx=await browser.newContext({viewport:{width:390,height:844}}), traffic={analytics:0,external:0,writes:0};
    await ctx.addInitScript(({gpc,accepted})=>{Object.defineProperty(navigator,'globalPrivacyControl',{value:gpc,configurable:true});if(accepted)localStorage.setItem('cookieConsentRecord',JSON.stringify({version:'analytics-2026-10-29-v1',analytics:true,updatedAt:new Date().toISOString()}));},{gpc,accepted});
    await ctx.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.pathname.startsWith('/api/')){
        if(url.pathname==='/api/track-view'){traffic.analytics++; return route.fulfill({status:200,json:{success:true}});}
        if(!['GET','HEAD'].includes(request.method()))traffic.writes++;
        let data={success:true,data:[],count:0,isOpen:true,schedule:[],message:''};
        if(url.pathname.includes('/filters'))data={success:true,data:{categories:[],brands:[],sizes:[],colors:[],genders:[],priceRange:{min:0,max:100}}};
        return route.fulfill({status:200,json:data});
      }
      if(url.origin!==origin){traffic.external++;return route.abort();}
      return route.continue();
    });
    const page=await ctx.newPage();page.on('pageerror',error=>errors.push(error.message));return{ctx,page,traffic};
  }
  try {
    const {ctx,page,traffic}=await context();await page.goto(origin+'/products');
    const dialog=page.getByRole('dialog',{name:'Age confirmation'});await dialog.waitFor();
    assert(await page.locator('[data-age-gate-background]').evaluate(el=>el.inert));
    for(let i=0;i<15;i++){await page.keyboard.press('Tab');assert(await dialog.evaluate(el=>el.contains(document.activeElement)));}
    await dialog.getByRole('link',{name:'Privacy Policy',exact:true}).click();await page.waitForURL('**/privacy-policy');
    assert.equal(await dialog.count(),0);assert.equal(await page.getByRole('main').count(),1);
    assert.equal(await page.locator('[data-age-gate-background]').evaluate(el=>el.inert),false);
    checks.push('age dialog traps focus and legal pages remain reachable before confirmation');
    const banner=page.getByRole('region',{name:'Cookie consent banner'});await banner.waitFor();
    assert.equal(traffic.analytics,0);assert.equal(await page.locator('script[src*="googletagmanager"]').count(),0);
    await banner.getByRole('button',{name:'Essential Only',exact:true}).click();
    await page.getByRole('button',{name:'Privacy choices',exact:true}).click();await banner.getByRole('button',{name:'Accept All',exact:true}).click();
    await page.waitForFunction(()=>localStorage.getItem('visitor_session_id'));assert(traffic.analytics>0);
    await page.getByRole('button',{name:'Privacy choices',exact:true}).click();await banner.getByRole('button',{name:'Essential Only',exact:true}).click();
    const count=traffic.analytics;await page.goto(origin+'/terms-and-conditions');await page.getByRole('main').waitFor();assert.equal(traffic.analytics,count);
    assert.equal(await page.evaluate(()=>localStorage.getItem('visitor_session_id')),null);
    checks.push('essential-only blocks analytics; opt in enables it; withdrawal removes identifiers and suppresses later pages');
    await page.goto(origin+'/privacy-requests');await page.getByRole('heading',{name:'Privacy requests',exact:true}).waitFor();
    assert.equal(await page.getByRole('dialog').count(),0);assert.equal(traffic.writes,0);
    checks.push('privacy request contact page is accessible without login or age confirmation');
    for (const [route,title] of [['/privacy-policy','Privacy Policy'],['/terms-and-conditions','Terms and Conditions'],['/accessibility','Accessibility Statement'],['/delivery-and-refund-policy','Delivery, Refund and Cancellation Policy']]) {
      await page.goto(origin+route);await page.getByRole('heading',{level:1,name:title,exact:true}).waitFor();
      assert.equal(await page.getByRole('dialog').count(),0);
      const text=await page.locator('main').innerText();assert(!/INTERNAL DRAFT|NOT FOR PUBLICATION|\[Confirm|\[Approve|\[registered|Proposed acceptance/.test(text));assert(text.includes('October 29, 2026'));
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
      assert.equal(await page.locator('footer a[href="/delivery-and-refund-policy"]').count(),1);
    }
    checks.push('all four public policies have dated text, no editorial placeholders, mobile layout and footer links');
    await ctx.close();
    const g=await context(true,true);await g.page.goto(origin+'/privacy-policy');await g.page.getByRole('button',{name:'Privacy choices',exact:true}).click();
    assert(await g.page.getByRole('button',{name:'Accept All',exact:true}).isDisabled());assert.equal(g.traffic.analytics,0);await g.ctx.close();
    checks.push('GPC overrides previously saved opt in');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks,pageErrors:errors},null,2));
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;server.close();});
