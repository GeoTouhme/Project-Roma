# Cloudinary Cleanup + Migration Plan

Goal: free up the current Cloudinary account by **keeping only whiskey + tequila photos**, then **move those remaining assets to a new Cloudinary account** with fresh credentials. Everything is backed up to the server first so the operation is reversible.

**Live impact warning:** this plan touches production product images. Run it during low traffic, or put the storefront in maintenance mode for the swap. Each phase below is independently reversible until Phase 5.

---

## Prerequisites

Before starting, you must have:

1. **Full-access API key for the OLD Cloudinary account.** The current key is upload-only and cannot list, download, or delete assets. You need:
   - Access to the OLD Cloudinary console, OR
   - A master API key/secret from the account owner.
2. **New Cloudinary account** created with its own cloud name + master API key/secret.
3. **Server with enough free disk** to hold a full backup. Estimate: count of images × average size. For ~4,000 images at ~200 KB each that's <1 GB; for high-res originals it can be 10–20 GB. Run `df -h` first.
4. **MongoDB backup** taken right before starting (`mongodump --uri="$MONGODB_URI" --out=/backups/mongo-pre-cloudinary-migration-$(date +%F)`).
5. **Maintenance window** scheduled, or a feature flag to serve a "images temporarily unavailable" placeholder.

If you don't have prerequisite 1, stop here — open a Cloudinary support ticket (see `BG_REMOVAL_IMPROVEMENTS.md` discussion) before continuing.

---

## Phase 0 — Inventory & Sanity Check

Goal: know exactly what you're touching before you touch it.

### 0.1 Count images by category

```bash
# in backend/, with MONGODB_URI exported
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./src/models/Product');
const Category = require('./src/models/Category');
(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const cats = await Category.find().lean();
  const byCat = {};
  for (const c of cats) {
    const products = await Product.find({ category: c._id }).lean();
    const imgCount = products.reduce((n, p) => n + (p.images?.length || 0), 0);
    byCat[c.name] = { products: products.length, images: imgCount };
  }
  console.table(byCat);
  process.exit(0);
})();
"
```

Save this output. It's your reference for what 'success' looks like at the end.

### 0.2 List the public_ids to KEEP (whiskey + tequila)

```bash
node scripts/list-public-ids.js --categories=whiskey,tequila --out=/backups/keep-public-ids.txt
```

(See Appendix A for the script — write it once, reuse it.)

### 0.3 List the public_ids to DELETE (everything else)

```bash
node scripts/list-public-ids.js --exclude-categories=whiskey,tequila --out=/backups/delete-public-ids.txt
```

Verify counts roughly match what you saw in 0.1.

---

## Phase 1 — Full Backup to Server (do this first, no exceptions)

Goal: every image that currently lives on Cloudinary is copied to the server, regardless of category. If anything goes wrong later, you can re-upload from this backup.

### 1.1 Create backup directory structure

```bash
BACKUP_ROOT=/backups/cloudinary-$(date +%F)
mkdir -p "$BACKUP_ROOT/images" "$BACKUP_ROOT/metadata"
echo "$BACKUP_ROOT" > /tmp/cloudinary-backup-path
```

### 1.2 Dump full Mongo state

```bash
mongodump --uri="$MONGODB_URI" --out="$BACKUP_ROOT/metadata/mongo"
```

### 1.3 Download every image referenced in MongoDB

```bash
node scripts/backup-cloudinary-images.js --out="$BACKUP_ROOT/images"
```

This script (Appendix B) iterates every `images[].url` in the `products` collection and downloads the file to `$BACKUP_ROOT/images/<public_id>.<ext>`. Use `axios` with redirects and a 3-try retry.

**Estimated time:** ~4,000 images × 0.5 s with concurrency 5 = ~7 minutes plus network. Watch for rate limits.

### 1.4 Verify backup integrity

```bash
# Count downloaded files vs expected
find "$BACKUP_ROOT/images" -type f | wc -l
wc -l /backups/keep-public-ids.txt /backups/delete-public-ids.txt
# Sanity: random-sample 20 files and open them
ls "$BACKUP_ROOT/images" | shuf -n 20
```

Counts should match. If any image failed to download, the backup script's log lists them — re-run on the failed subset before proceeding.

### 1.5 (Recommended) Off-server copy

Tar + compress + ship offsite so a server failure doesn't destroy the backup:

```bash
tar -czf "$BACKUP_ROOT.tar.gz" -C "$(dirname $BACKUP_ROOT)" "$(basename $BACKUP_ROOT)"
# Then scp / rsync / aws s3 cp to a different host
```

**Do not proceed to Phase 2 until 1.4 passes and 1.5 is done.**

---

## Phase 2 — Delete Non-Whiskey/Tequila Photos from OLD Cloudinary

Goal: shrink the OLD account's storage by removing assets you don't need to migrate.

### 2.1 Dry-run delete

```bash
node scripts/delete-cloudinary-assets.js --list=/backups/delete-public-ids.txt --dry-run
```

Output should be a count and a sample of the first 20 public_ids that *would* be destroyed. Confirm the list does NOT contain anything from the whiskey/tequila keep list:

```bash
comm -12 <(sort /backups/keep-public-ids.txt) <(sort /backups/delete-public-ids.txt)
# This must print nothing. If it prints anything, STOP and fix the lists.
```

### 2.2 Execute delete

```bash
node scripts/delete-cloudinary-assets.js --list=/backups/delete-public-ids.txt --execute
```

The script (Appendix C) uses Cloudinary's `api.delete_resources` (batched, up to 100 public_ids per call) with the OLD account's master credentials. Logs successes/failures to `delete-cloudinary-log.jsonl`.

### 2.3 Clear DB references for deleted products

For products whose images you just deleted, set `images: []` so the storefront doesn't render broken URLs:

```bash
node scripts/clear-deleted-image-refs.js --list=/backups/delete-public-ids.txt
```

### 2.4 Verify

- Cloudinary console (OLD): storage should have dropped meaningfully.
- Site sanity-check: whiskey/tequila pages still render images, other categories now show placeholder (this is expected and temporary).

---

## Phase 3 — Migrate Whiskey + Tequila to NEW Cloudinary

Goal: upload the kept images to the NEW account, preserving folder structure and `public_id` shape so URLs are predictable.

### 3.1 Configure both accounts

Add the new account's creds to your env (do NOT remove the old ones yet — you still need both):

```env
# OLD (still active for fallback)
CLOUDINARY_CLOUD_NAME=ddhs5dd6l
CLOUDINARY_PUBLISHABLE_KEY=<old-key>
CLOUDINARY_SECRET_KEY=<old-secret>

# NEW (target)
CLOUDINARY_NEW_CLOUD_NAME=<new-cloud>
CLOUDINARY_NEW_PUBLISHABLE_KEY=<new-key>
CLOUDINARY_NEW_SECRET_KEY=<new-secret>
```

### 3.2 Upload from server backup to NEW account

```bash
node scripts/migrate-to-new-cloudinary.js \
  --source=/backups/cloudinary-$(date +%F)/images \
  --keep-list=/backups/keep-public-ids.txt \
  --target=new \
  --dry-run
```

Review output, then drop `--dry-run`. The script (Appendix D):
- Reads files from the backup directory (no traffic to OLD account).
- Uploads each with the **same `public_id`** to the NEW account — URLs change only in cloud name, not in path.
- Writes a mapping file `migration-url-map.jsonl` with `{ public_id, old_url, new_url }` per asset.

**Estimated time:** ~4,000 uploads at ~2/sec with concurrency 3 = ~30 min.

### 3.3 Verify uploads

```bash
node scripts/verify-new-cloudinary.js --map=migration-url-map.jsonl
```

For each entry, HEAD the new URL and confirm 200. Failures list goes to `verify-failures.jsonl` for retry.

---

## Phase 4 — Update MongoDB to Point at NEW URLs

Goal: switch the source of truth so the storefront serves from the NEW account.

### 4.1 Take a fresh DB backup (small, fast)

```bash
mongodump --uri="$MONGODB_URI" --out=/backups/mongo-pre-url-swap-$(date +%F-%H%M)
```

### 4.2 Dry-run swap

```bash
node scripts/swap-image-urls.js --map=migration-url-map.jsonl --dry-run
```

Output: count of `images[].url` fields that would change. Should equal the count in `keep-public-ids.txt`.

### 4.3 Execute swap

```bash
node scripts/swap-image-urls.js --map=migration-url-map.jsonl --execute
```

The script (Appendix E) does an aggregation-pipeline update on `products.images.url` (and `.public_id` if present), keyed by `public_id`. Also regenerates `blurDataURL` if you want to refresh placeholders (optional, slower).

### 4.4 Spot-check the storefront

- Open 10 random whiskey/tequila product pages.
- Confirm images render and the URL shows `res.cloudinary.com/<NEW_CLOUD>/...`.
- Open browser devtools → Network → confirm no 404s and reasonable load times.

---

## Phase 5 — Cut Over Application Config

Goal: make the NEW account the default for all writes (new uploads, admin uploads). Point of no return.

### 5.1 Swap env vars on the backend

```env
# Promote NEW → primary
CLOUDINARY_CLOUD_NAME=<new-cloud>
CLOUDINARY_PUBLISHABLE_KEY=<new-key>
CLOUDINARY_SECRET_KEY=<new-secret>

# Retire OLD (keep commented for 30 days in case of rollback)
# CLOUDINARY_CLOUD_NAME_OLD=ddhs5dd6l
# CLOUDINARY_PUBLISHABLE_KEY_OLD=<old-key>
# CLOUDINARY_SECRET_KEY_OLD=<old-secret>
```

### 5.2 Restart backend

```bash
docker-compose restart backend
# or your deployment's equivalent
```

### 5.3 End-to-end test

- Admin panel → Products → upload a new test image → confirm it lands in NEW account.
- Customer panel → view the newly uploaded product → confirm image renders.
- Hit `GET /api/products?limit=10` and grep for `res.cloudinary.com` — every URL should reference the new cloud name.

### 5.4 Update any hardcoded references

```bash
grep -rn "ddhs5dd6l" --include="*.{js,ts,tsx,jsx,json,env,yml,yaml}" .
```

There shouldn't be any code references (cloud name comes from env), but check `.env.example`, deployment configs, README/CLAUDE.md, and the `docker-compose.yml` for stale defaults.

---

## Phase 6 — Cleanup (after a 30-day safety window)

Goal: free disk and decommission the OLD account.

### 6.1 Delete the remaining whiskey/tequila assets from OLD account

Same script as 2.2 but with the keep-list:

```bash
node scripts/delete-cloudinary-assets.js --list=/backups/keep-public-ids.txt --execute
```

### 6.2 Close the OLD Cloudinary account

In OLD Cloudinary console → Settings → Account → Close account.

### 6.3 Archive the server backup

```bash
# Move tarball to cold storage
mv /backups/cloudinary-*.tar.gz /backups/archive/
# After another 90 days, delete if no issues surfaced
```

### 6.4 Remove commented-out OLD env vars

Delete the retention block from 5.1 in `.env` and deployment configs.

---

## Rollback

If something goes wrong at each phase, the recovery path:

| Phase | Failure mode | Recovery |
|-------|--------------|----------|
| 1 (backup) | Download errors | Re-run backup script on failed list. No production impact. |
| 2 (delete) | Wrong items deleted | Re-upload from `$BACKUP_ROOT/images` to OLD account via `scripts/migrate-to-new-cloudinary.js` pointed at OLD. |
| 3 (upload to NEW) | Upload failures | Retry from backup. DB hasn't changed yet. |
| 4 (URL swap) | Wrong URLs in DB | `mongorestore` from the backup taken in 4.1. |
| 5 (env cut over) | Backend errors / images 404 | Revert env vars to OLD, restart backend. The Phase 4 URL swap is the only thing that needs reverting; everything else is additive. |
| 6 (cleanup) | Already deleted, no recovery needed | Wait 30 days before this phase precisely to avoid this. |

---

## Appendix: Scripts to Write

These don't exist yet — write them once, run from `backend/scripts/`. Keep them small, idempotent, and use `MONGODB_URI` + the appropriate Cloudinary creds from env.

### A. `list-public-ids.js`

Inputs: `--categories=` or `--exclude-categories=`, `--out=`.
Behavior: query MongoDB, walk `products.images`, write one `public_id` per line.

### B. `backup-cloudinary-images.js`

Inputs: `--out=<dir>`.
Behavior: iterate all `products.images`, download each URL with axios (redirects + 3-try retry + 5-concurrency), save as `<public_id>.<ext>` in the output dir. Log to `backup-log.jsonl`.

### C. `delete-cloudinary-assets.js`

Inputs: `--list=<file>`, `--dry-run` / `--execute`.
Behavior: read public_ids, batch in groups of 100, call `cloudinary.api.delete_resources()`. Log to `delete-log.jsonl`. **Refuses to run without `--execute`.**

### D. `migrate-to-new-cloudinary.js`

Inputs: `--source=<dir>`, `--keep-list=<file>`, `--target=new`, `--dry-run` / `--execute`.
Behavior: read files from source, upload to NEW account with the same `public_id` and `overwrite: false` (prevents accidental clobber if the NEW account already has something there). Log `{public_id, old_url, new_url}` to `migration-url-map.jsonl`.

### E. `swap-image-urls.js`

Inputs: `--map=<file>`, `--dry-run` / `--execute`.
Behavior: read the URL map, update `products.images.url` (and `.public_id`) for each entry. Use one `bulkWrite` per 500 entries.

---

## Estimated Total Time & Cost

| Phase | Wall-clock | Cloudinary cost (OLD account) | Cloudinary cost (NEW account) |
|-------|-----------|-------------------------------|------------------------------|
| 0 — Inventory | 2 min | 0 | 0 |
| 1 — Backup (~4,000 imgs) | 10–30 min | ~2 GB bandwidth | 0 |
| 2 — Delete non-keep | 5 min | minimal API calls | 0 |
| 3 — Upload to NEW | 20–40 min | 0 (from local backup) | ingress not metered |
| 4 — DB swap | 1 min | 0 | 0 |
| 5 — Cut over | 5 min | 0 | 0 |
| 6 — Cleanup (after 30 days) | 5 min | minimal | 0 |

**Total active time: ~1 hour of script execution + a 30-day wait before final cleanup.**

---

## Pre-flight Checklist

Tick before starting:

- [ ] Full-access API key for OLD Cloudinary in hand
- [ ] NEW Cloudinary account created, credentials in hand
- [ ] `df -h` shows >5 GB free on backup volume
- [ ] `MONGODB_URI` is set and points at the right environment
- [ ] Mongo dump taken (`mongo-pre-cloudinary-migration-YYYY-MM-DD`)
- [ ] Maintenance window scheduled OR feature flag for image fallback ready
- [ ] All five scripts in Appendix written and dry-run tested
- [ ] Off-server copy destination ready (S3 bucket, another VPS, whatever)
