# 🥃 Whiskey Photo Replacement Plan

## Overview

Replace product photos in the MongoDB database with **104 new high-quality photos**.
Photos are named by UPC code (e.g., `0080660001142.jpg`) and match products via the `code` field.

---

## System Architecture

| Component | Detail |
|---|---|
| **Photo source** | `/usr/src/app/wiskey-photos/` (inside Docker container) |
| **Database** | MongoDB (`liquor_shop` → `products` collection) |
| **Image storage** | Cloudinary (folder: `balport-products`) |
| **Product model** | `code` field = UPC, `images[]` = `{url, _id, blurDataURL}` |
| **SKU format** | `BP-PRO-{UPC}` |

### Matching Logic

```
Photo filename (sans .jpg)  →  Product.code  (UPC)
0080660001142.jpg           →  code: "0080660001142"
```

---

## Step-by-Step Execution

### Step 1: Upload Photos to Server

```bash
# From your local machine — SCP photos to server
scp -r /path/to/wiskey/ user@your-server:/tmp/wiskey-photos/

# Copy into the Docker container
docker cp /tmp/wiskey-photos/ balport-backend:/usr/src/app/wiskey-photos/
```

### Step 2: Upload the Script to Server

```bash
# Copy the migration script to server
scp backend/scripts/replace-whiskey-photos.js user@your-server:/tmp/
docker cp /tmp/replace-whiskey-photos.js balport-backend:/usr/src/app/scripts/
```

### Step 3: Backup Database

```bash
# Create a backup before running
docker exec balport-mongo mongodump --db liquor_shop --out /tmp/backup-before-photos
docker cp balport-mongo:/tmp/backup-before-photos ./backup-before-photos
```

### Step 4: Dry Run (Match Check Only)

```bash
# Run in dry-run mode first — NO uploads, NO changes
docker exec balport-backend node scripts/replace-whiskey-photos.js --dry-run
```

This will output:
- Total photos found
- How many match products in DB
- How many are orphans (no matching product)
- List of all matches and misses

### Step 5: Execute Migration

```bash
# Run the actual migration (uploads to Cloudinary + updates DB)
docker exec balport-backend node scripts/replace-whiskey-photos.js
```

### Step 6: Verify

- Check admin panel for updated product images
- Spot-check products on customer storefront
- Verify Cloudinary dashboard shows new uploads

---

## Files to Handle

### Standard UPC Files (98 files)
Format: `{13-digit-UPC}.jpg` → direct match to `Product.code`

### Short UPC Files (6 files) — Need special matching
| File | Note |
|---|---|
| `08262802.jpg` | 8-digit — try zero-padding |
| `08269203.jpg` | 8-digit — try zero-padding |
| `08773502.jpg` | 8-digit — try zero-padding |
| `08773900.jpg` | 8-digit — try zero-padding |
| `08776509.jpg` | 8-digit — try zero-padding |
| `10055406.jpg` | 8-digit — try zero-padding |

### Duplicates — Skipped automatically
| File | Reason |
|---|---|
| `0085246500101 (1).jpg` | Duplicate |
| `0655709000303 (1).jpg` | Duplicate |

### Non-UPC — Skipped automatically
| File | Reason |
|---|---|
| `https.--qrstud.io-llox80k.jpg` | Not a UPC |

---

## Rollback Plan

If something goes wrong:

```bash
# Restore from backup
docker cp ./backup-before-photos balport-mongo:/tmp/backup-before-photos
docker exec balport-mongo mongorestore --db liquor_shop --drop /tmp/backup-before-photos/liquor_shop
```

Note: Old Cloudinary images are logged to `whiskey-photo-migration-log.json` before deletion, so URLs can be recovered.

---

## Prerequisites Checklist

- [ ] SSH access to production server
- [ ] Docker running (`balport-backend` + `balport-mongo`)
- [ ] `.env` has Cloudinary credentials
- [ ] MongoDB backup taken
- [ ] Photos uploaded to container at `/usr/src/app/wiskey-photos/`
- [ ] Script uploaded to container at `/usr/src/app/scripts/`
