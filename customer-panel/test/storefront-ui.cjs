// Read-only browser checks for the storefront shell against real catalog data.
// Run with PLAYWRIGHT_MODULE and STOREFRONT_URL pointing at an isolated candidate.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.STOREFRONT_URL || 'http://127.0.0.1:4300';
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const checks = [], errors = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('ageVerified', 'true');
      localStorage.setItem('cookieConsent', 'essential_only');
    });
    const readOnlyTraffic = route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      // /api/search uses POST for a verified read-only catalog query.
      const readOnlySearch = path === '/api/search' && request.method() === 'POST';
      if (path.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !readOnlySearch) return route.abort();
      return route.continue();
    };
    await context.route('**/*', readOnlyTraffic);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(base + '/products', { waitUntil: 'networkidle' });
      await page.locator('.product_item').first().waitFor({ timeout: 45000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `document overflow at ${width}`);
      assert(await page.getByRole('searchbox', { name: 'Search products' }).isVisible(), `search missing at ${width}`);
      const navigation = page.getByRole('navigation', { name: width < 768 ? 'Mobile navigation' : 'Main navigation', exact: true });
      assert(await navigation.isVisible(), `navigation missing at ${width}`);
      for (const name of width < 768 ? ['Home', 'Shop', 'Deals', 'Account', 'Cart'] : ['Home', 'Shop', 'Deals']) {
        assert(await navigation.getByRole('link', { name, exact: true }).isVisible(), `${name} missing at ${width}`);
      }
      const controls = await page.locator('.product_item button').evaluateAll(buttons => buttons.map(button => ({ name: button.getAttribute('aria-label'), width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height })));
      assert(controls.every(button => button.width >= 44 && button.height >= 44), `undersized product action at ${width}: ${JSON.stringify(controls.filter(button => button.width < 44 || button.height < 44))}`);
      assert.equal(await page.locator('.product_grid_title h6').first().evaluate(el => getComputedStyle(el).webkitLineClamp), '2');
      checks.push(`catalog, search, navigation, touch targets and two-line titles at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('searchbox', { name: 'Search products' }).fill('wine');
    await page.locator('#product-suggestions a').first().waitFor();
    await page.locator('#product-suggestions a').first().focus();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#product-suggestions').count(), 0);
    assert(await page.getByRole('searchbox', { name: 'Search products' }).evaluate(el => document.activeElement === el));
    checks.push('keyboard search suggestions close with Escape and restore input focus');
    await page.locator('.product_item .product_grid_cart_btn').first().click();
    await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).getByRole('link', { name: 'Cart', exact: true }).click();
    await page.waitForURL('**/cart');
    assert.equal(await page.getByRole('navigation', { name: 'Mobile navigation', exact: true }).count(), 0);
    assert.equal(await page.locator('.container .bg-white.rounded-xl').count() > 0, true);
    checks.push('local add-to-cart navigation preserves purchase-action space; API writes remain blocked');
    const consentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await consentContext.addInitScript(() => localStorage.setItem('ageVerified', 'true'));
    await consentContext.route('**/*', readOnlyTraffic);
    const consentPage = await consentContext.newPage();
    consentPage.on('pageerror', error => errors.push(error.message));
    await consentPage.goto(base + '/products', { waitUntil: 'networkidle' });
    const cookie = consentPage.getByRole('region', { name: 'Cookie consent banner' });
    await cookie.waitFor();
    const cookieCard = await cookie.locator(':scope > div').boundingBox();
    const bottomNav = await consentPage.getByRole('navigation', { name: 'Mobile navigation', exact: true }).boundingBox();
    assert(cookieCard.y + cookieCard.height <= bottomNav.y, 'cookie consent covers mobile navigation');
    for (const name of ['Essential Only', 'Accept All']) {
      const rect = await cookie.getByRole('button', { name }).boundingBox();
      assert(rect.height >= 44, `cookie action ${name} is below 44px`);
    }
    await cookie.getByRole('button', { name: 'Essential Only' }).click();
    assert.equal(await consentPage.evaluate(() => localStorage.getItem('cookieConsent')), 'essential_only');
    checks.push('cookie controls clear mobile navigation and persist essential-only choice');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks, pageErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
