const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const SubCategory = require('../models/SubCategory');
const Product = require('../models/Product');

const BASE_URL = 'https://balportliquors.com';

/**
 * GET /api/sitemap.xml
 * Dynamically generates an XML sitemap containing:
 *  - Static pages (home, products, deals, terms, privacy)
 *  - All active category slugs
 *  - All active subcategory slugs
 *  - All active product slugs
 */
router.get('/sitemap.xml', async (req, res) => {
  try {
    // Fetch all data in parallel for performance
    const [categories, subcategories, products] = await Promise.all([
      Category.find({ status: { $ne: 'disabled' } }).select('slug updatedAt').lean(),
      SubCategory.find().select('slug parentCategory updatedAt').lean(),
      Product.find({
        status: { $nin: ['disabled', 'inactive'] },
        available: { $gt: 0 },
      }).select('slug updatedAt').lean(),
    ]);

    const today = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { loc: `${BASE_URL}/`, priority: '1.0', changefreq: 'daily', lastmod: today },
      { loc: `${BASE_URL}/products`, priority: '0.9', changefreq: 'daily', lastmod: today },
      { loc: `${BASE_URL}/deals`, priority: '0.8', changefreq: 'daily', lastmod: today },
      { loc: `${BASE_URL}/terms-and-conditions`, priority: '0.4', changefreq: 'yearly', lastmod: today },
      { loc: `${BASE_URL}/privacy-policy`, priority: '0.4', changefreq: 'yearly', lastmod: today },
    ];

    // Category pages
    const categoryUrls = categories.map((cat) => ({
      loc: `${BASE_URL}/category/${cat.slug}`,
      priority: '0.8',
      changefreq: 'weekly',
      lastmod: cat.updatedAt ? new Date(cat.updatedAt).toISOString().split('T')[0] : today,
    }));

    // Subcategory pages — URL pattern is /category/:parentSlug/:subSlug
    // We only need the sub slug for the URL since the SPA handles nested routing
    const subcategoryUrls = subcategories.map((sub) => ({
      loc: `${BASE_URL}/category/${sub.slug}`,
      priority: '0.7',
      changefreq: 'weekly',
      lastmod: sub.updatedAt ? new Date(sub.updatedAt).toISOString().split('T')[0] : today,
    }));

    // Product pages
    const productUrls = products.map((prod) => ({
      loc: `${BASE_URL}/product/${prod.slug}`,
      priority: '0.6',
      changefreq: 'weekly',
      lastmod: prod.updatedAt ? new Date(prod.updatedAt).toISOString().split('T')[0] : today,
    }));

    const allUrls = [...staticPages, ...categoryUrls, ...subcategoryUrls, ...productUrls];

    const urlEntries = allUrls.map((entry) => `
  <url>
    <loc>${escapeXml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // Cache for 1 hour at the CDN/proxy level; always revalidate
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    res.status(200).send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).json({ success: false, message: 'Failed to generate sitemap.' });
  }
});

/**
 * Escape special XML characters to prevent malformed XML if a slug
 * somehow contains characters like &, <, >, etc.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
