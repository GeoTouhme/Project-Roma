// Read-only responsive layout regression against an actual storefront build.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.STOREFRONT_URL || 'http://127.0.0.1:3000';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      localStorage.setItem('ageVerified', 'true');
      localStorage.setItem('cookieConsent', 'essential_only');
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return route.abort();
      // Loopback previews of the production bundle retain its public API URL.
      // Proxy real read responses only in the test context, not in production.
      if (process.env.HERO_PREVIEW_READ_PROXY === '1' && url.pathname.startsWith('/api/') && url.origin !== new URL(base).origin) {
        const response = await route.fetch({
          url: new URL(url.pathname + url.search, base).href,
          headers: { ...request.headers(), origin: 'https://balportliquors.com' },
        });
        return route.fulfill({ response, headers: { ...response.headers(), 'access-control-allow-origin': new URL(base).origin, 'access-control-allow-credentials': 'true' } });
      }
      return route.continue();
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [390, 640, 767, 768, 1280, 1920]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.goto(base, { waitUntil: 'domcontentloaded' });
      const image = page.locator('.hero img').first();
      await image.waitFor();
      await image.evaluate(image => image.decode());
      const dimensions = await image.evaluate(image => {
        const rect = image.getBoundingClientRect();
        const style = getComputedStyle(image);
        return { width: rect.width, height: rect.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, maxHeight: style.maxHeight, aspectRatio: style.aspectRatio, overflow: document.documentElement.scrollWidth > innerWidth };
      });
      console.log(JSON.stringify({ viewport: width, ...dimensions }));
      if (process.env.HERO_SCREENSHOT_DIR && [390, 1920].includes(width)) {
        await page.screenshot({ path: `${process.env.HERO_SCREENSHOT_DIR}/hero-${width}.png`, fullPage: false });
      }
      assert.equal(dimensions.overflow, false, `horizontal overflow at ${width}px`);
      assert.equal(dimensions.width, width, `hero is not full width at ${width}px`);
      if (width < 768) {
        assert.equal(dimensions.maxHeight, '350px', 'mobile cap changed');
        assert.ok(Math.abs(dimensions.height - Math.min(width * 9 / 16, 350)) < 1, 'mobile hero dimensions changed');
      } else {
        assert.equal(dimensions.maxHeight, 'none', `desktop hero remains capped at ${width}px`);
        assert.ok(Math.abs(dimensions.height - width * dimensions.naturalHeight / dimensions.naturalWidth) < 1, `desktop image is cropped at ${width}px`);
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: uncropped desktop hero and unchanged mobile layout at six viewport widths');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
