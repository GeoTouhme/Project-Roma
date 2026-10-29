// Read-only production acceptance: localStorage changes only; no API writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/tmp/roma-browser-tests/node_modules/playwright');
const assert = require('node:assert/strict');
const origin = process.env.STOREFRONT_ORIGIN || 'https://balportliquors.com';
const previewProxy = process.env.PREVIEW_READ_PROXY === '1' && origin.startsWith('http://127.0.0.1:');
const id = '6a78dc08c9338c2d3e71fb52';
const stale = { id, name: 'CONUNDRUM WHITE', price: null, priceSale: 0, salePrice: 0, quantity: 2, slug: 'conundrum-white', image: '' };
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const results = [];
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('ageVerified', 'true');
      localStorage.setItem('cookieConsent', 'essential_only');
    });
    let hold = null;
    let fail = false;
    let lookups = 0;
    let summaries = 0;
    const jsErrors = [];
    await context.route('**/api/**', async route => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname === '/api/orders/cart-summary') summaries++;
      if (req.method() === 'GET' && url.pathname === '/api/products' && url.searchParams.has('ids')) {
        lookups++;
        if (hold) await hold;
        if (fail) return route.abort('failed');
      }
      if (previewProxy && ['GET', 'HEAD'].includes(req.method())) {
        // Preview-only transport of REAL backend responses; never fixtures or
        // production CORS changes, and never forward a write through this proxy.
        const headers = { ...req.headers() };
        delete headers.origin;
        delete headers.host;
        try {
          const response = await route.fetch({ url: `http://127.0.0.1:5001${url.pathname}${url.search}`, headers });
          return await route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' } });
        } catch (error) {
          // Navigation/teardown may cancel background recommendation requests.
          // Never suppress an actual proxy/backend failure.
          if (!/Route is already handled|Request context disposed|Target.*closed/.test(error.message)) throw error;
          return;
        }
      }
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method()) || (req.method() === 'POST' && url.pathname === '/api/search')) return route.continue();
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => jsErrors.push(error.message));
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    const seed = async items => {
      await page.evaluate(items => {
        localStorage.setItem('cartItems', JSON.stringify(items));
        localStorage.removeItem('isAuthenticated');
      }, items);
      await page.goto(`${origin}/cart`, { waitUntil: 'domcontentloaded' });
    };
    const line = page.locator('.font-bold.text-primary');
    const assertNoZero = async () => {
      assert(!/\$0\.00/.test(await line.allTextContents().then(x => x.join(' '))), 'zero-price cart line');
    };
    let release;
    hold = new Promise(resolve => { release = resolve; });
    await seed([stale]);
    await page.getByText('Updating prices…', { exact: true }).first().waitFor();
    await assertNoZero();
    assert(await page.getByRole('button', { name: 'Proceed to checkout' }).last().isDisabled());
    hold = null; release();
    await page.waitForFunction(() => document.querySelector('.font-bold.text-primary')?.textContent.includes('$47.98'));
    const restored = await page.evaluate(() => JSON.parse(localStorage.getItem('cartItems')));
    assert.equal(restored[0].priceSale, 23.99);
    assert.equal(restored[0].price, null);
    assert.equal(restored[0].quantity, 2);
    results.push({ scenario: 'stale anonymous cart', line: await line.allTextContents(), priceSale: restored[0].priceSale });
    const beforeQuantity = lookups;
    await page.getByRole('button', { name: 'Increase quantity' }).click();
    await page.waitForFunction(() => document.querySelector('.font-bold.text-primary')?.textContent.includes('$71.97'));
    assert.equal(lookups, beforeQuantity, 'quantity-only change made another lookup');
    results.push({ scenario: 'quantity-only change', lookupCountUnchanged: true });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('.font-bold.text-primary')?.textContent.includes('$71.97'));
    assert(lookups > beforeQuantity, 'reload trusted persisted pricing');
    results.push({ scenario: 'refresh restoration', freshLookup: true, line: await line.allTextContents() });
    await seed([stale, { ...stale, id: '000000000000000000000001', name: 'Deleted product fixture', quantity: 1 }]);
    await page.getByRole('button', { name: 'Retry prices' }).waitFor();
    assert(await page.getByText('Deleted product fixture', { exact: true }).isVisible());
    assert(await page.getByRole('button', { name: 'Proceed to checkout' }).last().isDisabled());
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('cartItems')))).length, 2);
    await assertNoZero();
    assert((await page.locator('.fixed.bottom-0 p.text-xl').allTextContents()).includes('Price unavailable'));
    results.push({ scenario: 'nonexistent ID', retained: true, checkoutBlocked: true, totalUnavailable: true });
    fail = true;
    await seed([stale]);
    await page.getByRole('button', { name: 'Retry prices' }).waitFor();
    await assertNoZero();
    assert(await page.getByRole('button', { name: 'Proceed to checkout' }).last().isDisabled());
    results.push({ scenario: 'induced network failure', priceUnavailable: true, retained: true });
    fail = false;
    await page.getByRole('button', { name: 'Retry prices' }).click();
    await page.waitForFunction(() => document.querySelector('.font-bold.text-primary')?.textContent.includes('$47.98'));
    results.push({ scenario: 'retry recovery', line: await line.allTextContents() });
    assert.equal(summaries, 0, 'anonymous cart called protected summary');
    assert.deepEqual(jsErrors, []);
    console.log(JSON.stringify({ ok: true, origin, previewProxy, results, productLookups: lookups, protectedSummaryCalls: summaries, jsErrors }, null, 2));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: error.message, results }, null, 2));
    process.exitCode = 1;
  } finally {
    await context?.unrouteAll({ behavior: 'ignoreErrors' });
    await browser.close();
  }
})();
