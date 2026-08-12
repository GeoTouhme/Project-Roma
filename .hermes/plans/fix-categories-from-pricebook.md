# Plan: Fix Categories & Subcategories from Pricebook

## Current State
- 8,807 products have subCategory matching CSV department exactly (already correct)
- 8 products uncategorized (all belong to "SYSTEM" department in CSV)
- 86 subcategories have NO `category` parent field set (all show `category: undefined`)
- Some questionable parent category mappings need correction

## Fixes

### Fix 1: Assign 8 uncategorized products
All 8 have "SYSTEM" department in CSV. Assign them to:
- Category: "Accessories & More" (where System/Tax/Scratcher items live)
- SubCategory: "System" (already exists in DB)

Products: TAXABLE, $ 2 FEE, delet, FEE1, Bag, AXXION CUPS, CBD, HUMM MANGO PASSION

### Fix 2: Set parent category on all 86 subcategories
Each subcategory document needs its `category` field set to the correct parent ObjectId.
The mapping is inferred from the product assignments (which parent each sub's products currently use).

### Fix 3: Correct questionable parent category mappings
Based on the product data, these subcategories are under the wrong parent:

| Subcategory | Current Parent | Correct Parent | Reason |
|---|---|---|---|
| Sake & Soju | Ready-to-Drink & Seltzers | Spirits | Sake/Soju are spirits |
| Non-Alcoholic Beer & Wine | Beer | Non-Alcoholic Drinks | It's non-alcoholic |
| Coffee & Milk & Protein shakes and Dairy | Snacks & Food | Non-Alcoholic Drinks | Beverages |
| Protein & Hydration | Health & Wellness | Non-Alcoholic Drinks | Beverage category |
| Protein Bars | Health & Wellness | Snacks & Food | Food category |
| Exotic ice-cream | Snacks & Food | Snacks & Food | (already correct, keep) |

Wait — actually let me not assume. Let me ask George about these.

### Fix 4: Recalculate category/subcategory productCount
After all changes, update the productCount on categories and subcategories.

## Execution Order
1. Backup database
2. Fix 8 uncategorized products
3. Set parent category on all 86 subcategories
4. Fix questionable parent mappings (pending George's approval)
5. Recalculate productCount
6. Verify