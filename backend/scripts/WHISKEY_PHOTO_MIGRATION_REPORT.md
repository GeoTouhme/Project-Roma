# Whiskey Photo Migration Report — 2026-05-03

## Overview

Batch replacement of whiskey product photos in the MongoDB database with new high-quality images matched by UPC code.

- **Date:** 2026-05-03
- **Photos processed:** 104 files
- **Database:** `liquor_shop` (local Docker MongoDB, 4,591 products)
- **Image storage:** Cloudinary (`balport-products` folder)

---

## Results Summary

| Metric | Count |
|---|---|
| Total files in `wiskey-photos/` | 104 |
| Valid UPC photos processed | 101 |
| **Successfully matched & uploaded** | **71** |
| No match (orphans) | 30 |
| Skipped (duplicates / non-UPC) | 3 |
| Errors during upload | 0 |

---

## Skipped Files

These files were automatically skipped by the migration script (not valid UPC filenames or duplicates).

| Filename | Reason |
|---|---|
| `0085246500101 (1).jpg` | Duplicate |
| `0655709000303 (1).jpg` | Duplicate |
| `https.--qrstud.io-llox80k.jpg` | Not a UPC (URL-based filename) |

---

## Unmatched UPCs (Orphans)

These 30 UPCs had no matching product in the database. Products may be missing, or the UPCs may need manual verification.

### Full 13-digit UPCs (22 items)

| UPC | Filename | Notes |
|---|---|---|
| `0040232379123` | `0040232379123.jpg` | No product with code `40232379123` or SKU `BP-40232379123` |
| `0040232555442` | `0040232555442.jpg` | No product with code `40232555442` or SKU `BP-40232555442` |
| `0051497363840` | `0051497363840.jpg` | No product with code `51497363840` or SKU `BP-51497363840` |
| `0080686004424` | `0080686004424.jpg` | No product with code `80686004424` or SKU `BP-80686004424` |
| `0080686007746` | `0080686007746.jpg` | No product with code `80686007746` or SKU `BP-80686007746` |
| `0080686009955` | `0080686009955.jpg` | No product with code `80686009955` or SKU `BP-80686009955` |
| `0081128000646` | `0081128000646.jpg` | No product with code `81128000646` or SKU `BP-81128000646` |
| `0081128001872` | `0081128001872.jpg` | No product with code `81128001872` or SKU `BP-81128001872` |
| `0081128002879` | `0081128002879.jpg` | No product with code `81128002879` or SKU `BP-81128002879` |
| `0082000809791` | `0082000809791.jpg` | No product with code `82000809791` or SKU `BP-82000809791` |
| `0082184004371` | `0082184004371.jpg` | No product with code `82184004371` or SKU `BP-82184004371` |
| `0085246503126` | `0085246503126.jpg` | No product with code `85246503126` or SKU `BP-85246503126` |
| `0085246503171` | `0085246503171.jpg` | No product with code `85246503171` or SKU `BP-85246503171` |
| `0088076188365` | `0088076188365.jpg` | No product with code `88076188365` or SKU `BP-88076188365` |
| `0088076190566` | `0088076190566.jpg` | No product with code `88076190566` or SKU `BP-88076190566` |
| `0655709000303` | `0655709000303.jpg` | No product with code `655709000303` or SKU `BP-655709000303` |
| `0810020890020` | `0810020890020.jpg` | No product with code `810020890020` or SKU `BP-810020890020` |
| `0812066020300` | `0812066020300.jpg` | No product with code `812066020300` or SKU `BP-812066020300` |
| `0814794011957` | `0814794011957.jpg` | No product with code `814794011957` or SKU `BP-814794011957` |
| `0816136023413` | `0816136023413.jpg` | No product with code `816136023413` or SKU `BP-816136023413` |
| `0850003347653` | `0850003347653.jpg` | No product with code `850003347653` or SKU `BP-850003347653` |
| `0857186006025` | `0857186006025.jpg` | No product with code `857186006025` or SKU `BP-857186006025` |
| `0858349004100` | `0858349004100.jpg` | No product with code `858349004100` or SKU `BP-858349004100` |
| `0860009871007` | `0860009871007.jpg` | No product with code `860009871007` or SKU `BP-860009871007` |

### Short UPCs (8-digit, 6 items)

These were not zero-padded to 13 digits in the database. The script tried both exact and padded matches with no success.

| UPC | Filename | Zero-padded (13-digit) |
|---|---|---|
| `08262802` | `08262802.jpg` | `0000008262802` |
| `08269203` | `08269203.jpg` | `0000008269203` |
| `08773502` | `08773502.jpg` | `0000008773502` |
| `08773900` | `08773900.jpg` | `0000008773900` |
| `08776509` | `08776509.jpg` | `0000008776509` |
| `10055406` | `10055406.jpg` | `000010055406` |

---

## Successfully Updated Products (71 items)

All matched products had their Cloudinary images replaced and old images deleted. See `whiskey-photo-migration-log.json` for the full list with old image URLs.

**Brands updated:** 1792, Jim Beam, Knob Creek, Woodford Reserve, Bulleit, Crown Royal, Jack Daniel's, Gentleman Jack, Maker's Mark, Fireball, Buchanan's, Ballantine's, Jagermeister, Jura, Benchmark, Seagram's, Templeton, Wild Turkey, Garrison Brothers, Widow Jane, Yellow Rose, Skrewball, Chicken Cock.

---

## Rollback Notes

Old Cloudinary image URLs are logged in `backend/scripts/whiskey-photo-migration-log.json`. Each entry contains the product ID, UPC, product name, and the complete `oldImages` array (URL, `_id`, `blurDataURL`) for recovery if needed.

---

## Next Steps

1. Verify updated images display correctly in the **admin panel** (`/products`) and **customer storefront**.
2. Check Cloudinary dashboard to confirm old images are removed and new ones are in `balport-products/`.
3. For unmatched UPCs: either add missing products to the database or acquire correct UPC-to-product mapping.
4. The `wiskey-photos/` directory can be removed from the server once verification is complete.
