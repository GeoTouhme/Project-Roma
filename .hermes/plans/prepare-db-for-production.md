# Plan: Prepare DB for Production Server

## Current State
- 8,749 products, 1 super admin user, 12 categories, 86 subcategories, 1 settings doc
- 1,755 products with real images, 6,994 with placeholders (hidden from customers)
- All products have: sku, name, slug, category, subCategory, priceSale, available, status
- price field is always null (priceSale holds the actual price — this is by design)
- 0 duplicate slugs, 0 duplicate SKUs
- 0 old Cloudinary account references
- 73 pageviews (dev/test data — should be cleared)

## Issues to Fix Before Production

### 1. Clear dev/test data
- Delete pageviews collection (73 entries from local dev testing)

### 2. Fix 11 mojibake product names
Products with corrupted UTF-8 characters (ÔøΩ sequences and Ã©):
- LAYÔøΩ...S SOUR CREAM & ONION → LAY'S SOUR CREAM & ONION
- WOODBRDGE ROSÔøΩ... → WOODBRIDGE ROSÉ
- Whispering Angel RosÔøΩ → Whispering Angel Rosé
- REÔøΩ...L SANGRIA → RÉAL SANGRIA
- MÔøΩ...NAGE ÔøΩ... TROIS → MÉNAGE À TROIS
- Macanudo Hampton Court CafÃ© → Macanudo Hampton Court Café
- Macanudo Portofino CafÃ© → Macanudo Portofino Café
- Macanudo Crystal CafÃ© → Macanudo Crystal Café
- Punch CafÃ© Royal Natural → Punch Café Royal Natural
- Macanudo Crystal CafÃ© Maduro → Macanudo Crystal Café Maduro
- HERRADURA LEGEND AÔøΩ...EJO → HERRADURA LEGEND AÑEJO

### 3. Verify settings are production-ready
- deliveryProvider: 'store' (OK — manual for now)
- taxRate: 0.0775 (7.75% — Newport Beach, CA)
- Operating hours set

### 4. Create the export dump
- mongodump to archive file
- Transfer-ready at /tmp/

## Execution
1. Backup database
2. Clear pageviews
3. Fix 11 mojibake names
4. Create final production dump