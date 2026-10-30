/**
 * Centralized homepage promotional banner configuration.
 *
 * Single source of truth for banner assets, destinations, alt text, and
 * campaign expiration. Artwork lives in public/banners/ (webp-optimized
 * copies of the originals in the repo-root banners/ directory — originals
 * are never modified).
 *
 * Destinations are real routes only (verified against the live catalog):
 *  - /deals                      — monthly deals page (discount products)
 *  - /product/<slug>             — single product page (slug verified live)
 *  - /products?search=<term>    — catalog search results (term verified live)
 *
 * Expiry: campaigns with `expiresAt` stop rendering automatically
 * (America/Los_Angeles). See isCampaignActive() below.
 */

// October 2026 monthly campaign ends 11:59 PM PT, Oct 30 2026.
// PT is UTC-7 (PDT) on that date, so the cutoff instant is 2026-10-31T06:59:59Z.
const MONTHLY_DEALS_EXPIRY = new Date('2026-10-31T06:59:59.000Z');

export const isCampaignActive = (expiresAt) =>
  !expiresAt || Date.now() < expiresAt.getTime();

export const HERO_BANNER = {
  // Settings-driven hero (image_7b3e8917.webp) is the "Good Drinks. Great
  // Weekends." artwork. This fallback is used only if settings.heroSlides
  // is empty (see pages/home/index.jsx).
  image: '/banners/balport-liquors-coastal-weekend-ad.webp',
  alt: 'Balport Liquors — Good Drinks. Great Weekends.',
  link: '/products',
  width: 1672,
  height: 941,
};

export const MONTHLY_DEALS_BANNER = {
  image: '/banners/tropical-liquor-deals-by-the-sea.webp',
  alt: 'See Monthly Deals — special prices on top brands, updated monthly at Balport Liquors',
  link: '/deals',
  expiresAt: MONTHLY_DEALS_EXPIRY,
  width: 2043,
  height: 770,
  // Compact presentation: this is a secondary promo, not a second hero.
  maxWidthClass: 'max-w-[720px]',
};

export const DEALS_CAROUSEL_BANNERS = [
  {
    image: '/banners/balport_don_julio_70_15_off.webp',
    alt: 'Don Julio Añejo 70th Anniversary — $15 OFF at Balport Liquors',
    link: '/product/don-julio-anejo-70th-anniversary',
    width: 1672,
    height: 310,
  },
  {
    image: '/banners/balport_artemis_cabernet_10_off.webp',
    alt: 'Stags Leap Wine Cellars Artemis Cabernet Sauvignon — $10 OFF at Balport Liquors',
    link: '/product/stags-leap-wine-cellars-artemis-cabernet-sauvignon',
    width: 1672,
    height: 288,
  },
  {
    image: '/banners/balport_cabernet_sauvignon_20_off.webp',
    alt: 'Stags Leap Cabernet Sauvignon — $20 OFF at Balport Liquors',
    link: '/product/stags-leab-cabernet-sauvignion',
    width: 1672,
    height: 320,
  },
];

// Section 5 — "More Ways to Save" beverage promotions.
// Starbucks "2 for $7.99" banner artwork was not provided (missing asset);
// only the soda banner is configured. The grid stacks gracefully with one.
export const BEVERAGE_BANNERS = [
  {
    image: '/banners/summer-soda-deal-six-for-5.99.webp',
    alt: 'Soda Deal — 6 for $5.99 at Balport Liquors',
    link: '/products?search=soda',
    width: 2043,
    height: 770,
  },
];

export const FEATURED_WINE_BANNER = {
  image: '/banners/coastal-daou-cabernet-promotion.webp',
  alt: 'DAOU Cabernet Sauvignon 750ml — $29.99 at Balport Liquors',
  link: '/product/daou-cabernet-sauvignon-750ml',
  width: 2043,
  height: 770,
};