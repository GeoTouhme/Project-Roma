# Plan: Process New ZIP Images from Nextcloud (2026-08-12)

## Source

Nextcloud folder: `http://nextcloud.home/apps/files/files/2314?dir=/ZIp%20files/New%20ZIP`
WebDAV path: `http://nextcloud.home/remote.php/dav/files/admin/ZIp%20files/New%20ZIP/`

## Contents found

15 ZIP archives, total ~2.9 GB:

| ZIP | Size |
|---|---|
| pinot noir .zip | 2.5 MB |
| moscato.zip | 8.8 MB |
| condoms.zip | 27.2 MB |
| Juul and vapes.zip | 25.3 MB |
| Chardonnay.zip | 84.3 MB |
| Rosé.zip | 54.1 MB |
| protein bar.zip | 135.0 MB |
| Gum.zip | 172.6 MB |
| CHOCOLATE.zip | 196.4 MB |
| vodka.zip | 155.1 MB |
| pouches .zip | 89.7 MB |
| cabernet wine .zip | 222.1 MB |
| mexican candy.zip | 541.6 MB |
| wiskey.zip | 597.6 MB |
| Tequila .zip | 711.2 MB |

## Current catalog state (approximate)

- Total products: ~8,749
- Products with real images: ~1,755
- Products with placeholder images: ~6,994

## Steps I will take

### 1. Download ZIPs via WebDAV

Use `curl -u admin:PASSWORD` from the Nextcloud WebDAV endpoint into:
`/home/geo/projects/Project-Roma/data/zip-batches/new-zip-2026-08-12/`

Deduplicate same-named files from different subfolders by prefixing source folder name.

### 2. Extract archives

Use Python `zipfile` (unzip is not installed). Extract into:
`/home/geo/projects/Project-Roma/data/extracted-images/`

Keep per-archive subdirectories to preserve provenance.

### 3. Audit filenames and match against MongoDB

Create/run `backend/scripts/audit-new-zip-batch.js` inside the `balport-backend` container so it can query MongoDB directly.

Rules:
- Strip all non-digits from filename stem.
- Keep only stems with 8+ digits.
- Match candidate SKUs in order: exact, strip one leading zero, strip all leading zeros, last 12, last 13.
- Detect whether the matched product already has a real Cloudinary image (skip those to save quota).

Outputs:
- `data/match-results.json` — array of matched items with `file`, `upc`, `matched_sku`, `product_id`, `product_name`, `already_has_real_image`.
- `data/unmatched-files.json` — list of filenames that could not be auto-matched for manual review.
- `data/zip-audit-summary.json` — counts: total images, clean UPCs, matched, already-real, to-upload, unmatched.

### 4. Upload only needed images to Cloudinary

Run the existing `backend/scripts/link-product-images.js` (already configured for Project Roma env vars and no background-removal transformation).

- Uploads only items where `already_has_real_image === false`.
- Uses deterministic public_id `balport-products/<UPC>` with `overwrite: true`.
- Updates `product.images` in MongoDB.
- Adds a small delay between uploads to respect rate limits.

### 5. Verify

Call the customer-facing API and confirm returned products have real Cloudinary URLs, not placeholder:

```bash
curl -H 'public-request: true' 'http://192.168.88.218:5001/api/products?limit=50'
```

Also report final product counts (real vs placeholder).

## Safety notes

- I will **not** apply `e_background_removal,b_white` (Cloudinary free-tier limit).
- I will **not** modify `main` branch — image processing only touches the database and data directory, not repo code.
- I will **not** upload images for products that already have real images; this avoids wasting Cloudinary credits.
- If the audit reveals many non-UPC filenames (descriptive names, URL garbage, etc.), I will report them for manual matching instead of guessing.

## Expected outcome

- New real images linked to placeholder products.
- Updated count of customer-visible products.
- A list of unmatched image files for manual handling.

## Commands (for me to run after approval)

```bash
# 1. Download
mkdir -p /home/geo/projects/Project-Roma/data/zip-batches/new-zip-2026-08-12
# Use NEXTCLOUD_PASSWORD env var; never hardcode credentials
curl -s -u "admin:${NEXTCLOUD_PASSWORD}" \
  "http://nextcloud.home/remote.php/dav/files/admin/ZIp%20files/New%20ZIP/" \
  -X PROPFIND -H "Depth: 1" | python3 ...
# (batch download each .zip)

# 2. Extract
python3 -c "import zipfile, os, glob ..."

# 3. Audit (inside backend container)
cd /home/geo/projects/Project-Roma
sg docker -c "docker cp backend/scripts/audit-new-zip-batch.js balport-backend:/app/scripts/audit-new-zip-batch.js"
sg docker -c "docker exec -i balport-backend node scripts/audit-new-zip-batch.js"

# 4. Upload/link (inside backend container)
sg docker -c "docker exec -i balport-backend node scripts/link-product-images.js"

# 5. Verify
curl -H 'public-request: true' 'http://192.168.88.218:5001/api/products?limit=50'
```

---

**Please confirm**: Proceed with this plan? If yes, I'll start downloading and processing.
