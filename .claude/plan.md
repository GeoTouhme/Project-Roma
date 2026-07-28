# Plan: Product Labels for Best Sellers & Top Collections

## Goal
Add visual "Best Seller" and "Top Collection" badges/labels to product cards across the storefront, with manual on/off toggles in the admin product form.

## Decisions from clarifying questions
- **Label determination:** Manual toggles in admin (add new `isBestSeller` and `isTopCollection` booleans to products).
- **Visibility:** Everywhere product cards appear (home page, collections, product detail, wishlist, account, recommendations).

## Files to change

### 1. Backend — Data model & API
| File | Change |
|------|--------|
| `backend/src/models/Product.js` | Add `isBestSeller: Boolean` and `isTopCollection: Boolean` to schema. |
| `backend/src/controllers/product.js` | • `createProductByAdmin`: persist new flags.<br>• `updateProductByAdmin`: persist new flags.<br>• `getProducts` (storefront): project `isBestSeller` and `isTopCollection`.<br>• `getProductsByAdmin`: project both flags.<br>• `getOneProductByAdmin`: return both flags.<br>• `getOneProductBySlug`: return both flags.<br>• `exportInventoryCSV`: add two columns.<br>• `importInventoryCSV`: read optional `Best Seller`/`Top Collection` columns. |
| `backend/src/controllers/home.js` | • `getBestSellerProducts`: filter/prioritize by `isBestSeller: true` instead of only sorting by `sold`.<br>• `getFeaturedProducts`: rename internally to filter by `isTopCollection: true` (projection still returns both flags). |
| `backend/src/controllers/recommendation.js` | Include `isBestSeller` and `isTopCollection` in the aggregate `$project` so recommendation cards can show labels. |

### 2. Admin panel — Product form
| File | Change |
|------|--------|
| `admin-panel/src/pages/ProductForm.tsx` | • Add two `Checkbox` states: `isBestSeller`, `isTopCollection`.<br>• Load existing values when editing.<br>• Include both booleans in create/update payload. |
| `admin-panel/src/pages/Products.tsx` | Optional: show small `Badge` indicators in the products table for quick scanning. |

### 3. Customer panel — Product card & callers
| File | Change |
|------|--------|
| `customer-panel/src/components/product-card/index.jsx` | Add a small label stack (absolute on image or above title) that renders:<br>• Red/primary "Best Seller" badge when `product.isBestSeller` is true.<br>• Dark/gold "Top Collection" badge when `product.isTopCollection` is true.<br>Style matches existing Tailwind tokens (`primary` #B5223B). |
| `customer-panel/src/pages/home/index.jsx` | • Fix "Top Collections" section to fetch and render `featuredProducts` instead of duplicating `bestSellerProducts`.<br>• Add `HomeService.featuredProducts()` method.<br>• Pass `isBestSeller`/`isTopCollection` into each `ProductCard`. |
| `customer-panel/src/services/homeService.js` | Add `featuredProducts(params)` calling `GET /home/products/featured`. |
| `customer-panel/src/pages/collections/index.jsx` | Map `product.isBestSeller` / `product.isTopCollection` into the `ProductCard` product object. |
| `customer-panel/src/pages/product/index.jsx` | Pass flags to related-product `ProductCard`s (requires backend `relatedProducts` to project them). |
| `customer-panel/src/pages/wishlist/index.jsx` | Pass flags into wishlist `ProductCard`s (requires backend wishlist controller to populate them). |
| `customer-panel/src/pages/account/Account.jsx` | Pass flags into wishlist `ProductCard`s. |
| `customer-panel/src/components/recommendation-section/index.jsx` | Pass flags into recommendation `ProductCard`s. |

### 4. Backend — Populate labels for related/wishlist/recommendation endpoints
| File | Change |
|------|--------|
| `backend/src/controllers/product.js` | `relatedProducts` aggregate: project `isBestSeller`, `isTopCollection`. |
| `backend/src/controllers/wishlist.js` | Ensure wishlist response includes `isBestSeller` and `isTopCollection` from populated product docs. |

### 5. Migration script
| File | Change |
|------|--------|
| `backend/scripts/migrate-product-labels.js` (new) | • Set `isTopCollection = isFeatured` for all existing products.<br>• Optionally set `isBestSeller = true` for top N products by `sold` count as a starting dataset.<br>• Run once against MongoDB. |

## Implementation details

### ProductCard label design
- Position: top-left of the product image, stacked vertically with ~4px gap.
- Badges: small pill-style chips (`text-[10px]` / `text-xs`, uppercase, tracking-wide).
  - Best Seller: `bg-primary text-white`
  - Top Collection: `bg-black text-white` or `bg-amber-600 text-white` (to be decided at implementation time; default to dark/black to match site palette).
- Hide on skeleton state.

### Home page sections
- Keep the existing "Best Sellers" heading and use `getBestSellerProducts`.
- "Top Collections" heading will use the new `featuredProducts` service (`/home/products/featured`) that returns products flagged as `isTopCollection`.
- This fixes the current bug where both sections render identical `bestSellerProducts`.

### Admin form additions
- Place the two checkboxes directly below the existing "Featured Product" checkbox in `ProductForm.tsx`.
- If existing `isFeatured` is currently used as the "Top Collection" concept, we keep `isFeatured` untouched in the database but migrate its value into `isTopCollection` via the migration script. The admin UI will expose `isTopCollection` going forward.

### CSV round-trip
- Export columns: `Best Seller` (`true`/`false`), `Top Collection` (`true`/`false`).
- Import accepts case-insensitive `true`/`yes`/`1` for `true`; everything else is `false`.

## Testing checklist
- [ ] Migration script runs without errors and populates initial labels.
- [ ] Admin can create and edit a product with both toggles.
- [ ] Exported CSV includes the two new columns.
- [ ] CSV import correctly updates the two new columns.
- [ ] Home page "Best Sellers" only shows products with `isBestSeller: true`.
- [ ] Home page "Top Collections" only shows products with `isTopCollection: true`.
- [ ] Product cards in collections, product detail, wishlist, account, and recommendations show labels when flags are set.
- [ ] Docker builds (`docker-compose up --build`) succeed for all three services.

## Rollout steps
1. Merge migration script and run it against the live DB.
2. Deploy backend change.
3. Deploy admin-panel change.
4. Deploy customer-panel change.
5. Spot-check home page and one collection page for badge rendering.
