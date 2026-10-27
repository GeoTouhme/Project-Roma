// Run against production-built assets. Catalog/API responses are never mocked.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const assetServer = process.env.STOREFRONT_URL || 'http://127.0.0.1:4300';
const base = process.env.STOREFRONT_ORIGIN || assetServer;
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [], warnings = [], apiResponses = [], blockedWrites = [], checks = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('ageVerified', 'true');
      localStorage.setItem('cookieConsent', 'essential_only');
    });
    // Prevent analytics/form writes while retaining real read-only API traffic.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedWrites.push(url.pathname);
        return route.abort();
      }
      // Preserve the production origin for real API CORS checks; only static assets
      // come from the candidate Nginx. No API response is synthesized or replaced.
      if (base !== assetServer && url.origin === new URL(base).origin && !url.pathname.startsWith('/api/')) {
        const response = await route.fetch({ url: assetServer + url.pathname + url.search });
        return route.fulfill({ response });
      }
      // Hold real catalog requests briefly to make the loading-state regression deterministic.
      if (request.method() === 'GET' && url.pathname.startsWith('/api/home/products/')) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      return route.continue();
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ message: error.message, stack: error.stack }));
    page.on('console', message => {
      if (['error', 'warning'].includes(message.type())) warnings.push(message.text().slice(0, 600));
    });
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') && response.request().method() === 'GET') {
        apiResponses.push({ path: url.pathname, status: response.status() });
      }
    });
    const session = await context.newCDPSession(page);
    await session.send('Network.enable');
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 700, downloadThroughput: 5e6, uploadThroughput: 5e6 });
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('.react-loading-skeleton').first().waitFor({ state: 'attached', timeout: 15000 });
    checks.push('homepage loading skeleton renders');
    await page.locator('.product_item.bg-white:visible').first().waitFor({ state: 'visible', timeout: 45000 });
    await page.getByRole('heading', { name: 'Explore Our Best Sellers' }).waitFor();
    const count = await page.locator('.product_item.bg-white:visible').count();
    assert(count > 0);
    checks.push('desktop homepage renders real catalog products');
    await session.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('.product_item.bg-white:visible').first().waitFor({ timeout: 45000 });
    checks.push('mobile homepage renders real catalog products');
    for (const path of ['/products', '/deals', '/login', '/forgot-password']) {
      await page.goto(base + path, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2000);
      assert((await page.locator('#root').innerText()).trim().length > 0, path + ' rendered empty');
      if (path === '/products') await page.locator('.product_item.bg-white:visible').first().waitFor({ timeout: 45000 });
      if (path === '/forgot-password') await page.getByLabel('Email', { exact: true }).waitFor();
      checks.push(path + ' renders');
    }
    assert(apiResponses.some(response => response.path.includes('/home/products/') && response.status === 200));
    assert.deepEqual(errors, [], 'Uncaught browser JavaScript errors');
    const result = { base, checks, productCards: count, uncaughtErrors: errors, apiResponses, blockedWrites, consoleWarnings: warnings, apiResponsesMocked: false };
    if (process.env.BROWSER_RESULT_FILE) fs.writeFileSync(process.env.BROWSER_RESULT_FILE, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ checks, productCards: count, uncaughtErrors: errors.length, realApiResponses: apiResponses.length, apiResponsesMocked: false }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
