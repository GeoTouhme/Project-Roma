# Background Removal Script — Improvement Guide

This document describes how to improve `backend/scripts/batch-remove-backgrounds.js` and `backend/scripts/remove-bg-white.py` step by step, with a focus on **correctness first**, then **speed with minimum resources**.

Audience: anyone re-running or extending the batch background-removal pipeline.

---

## Current State (Baseline)

- **Throughput:** ~603 images in one run, with `DELAY_MS = 800` and `execSync` per image.
- **Resource use:** single-threaded Node, single-threaded Python (`rembg` on CPU), one image in memory at a time.
- **Known good output:** whiskey + tequila categories only.
- **Known issues:** see `## Bugs / correctness` in the audit. The four load-bearing problems are:
  1. MongoDB URI hardcoded to `localhost`.
  2. Cloudinary originals overwritten with no backup.
  3. `public_id` resolution falls back to a Mongo ObjectId in some records.
  4. `https.get` does not follow redirects.

Everything below assumes you fix those four first.

---

## Phase 1 — Correctness Fixes (do these before any performance work)

### 1.1 Read `MONGODB_URI` from env

**File:** `batch-remove-backgrounds.js:107`

```js
// before
const uri = 'mongodb://localhost:27017/liquor_shop';

// after
const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/liquor_shop';
```

Why: lets the script run in Docker, against staging, or against a remote DB without code edits.

### 1.2 Back up Cloudinary originals before overwriting

**File:** `batch-remove-backgrounds.js:75-87`

Two options — pick one:

**Option A — Cloudinary built-in backup (simplest):**
```js
const result = await cloudinary.uploader.upload(filePath, {
    public_id: publicId,
    overwrite: true,
    backup: true,         // ← Cloudinary keeps the prior version
    resource_type: 'image',
});
```

**Option B — Explicit sibling asset (more control):**
```js
// Copy original to <publicId>_orig first
await cloudinary.uploader.rename(publicId, `${publicId}_orig`, { overwrite: false });
// Then upload the cleaned version under the original public_id
```

Why: `rembg` produces halos / over-crops on dark glass bottles. Without a backup, the only recovery path is re-photographing the product.

### 1.3 Resolve `public_id` correctly

**File:** `batch-remove-backgrounds.js:135`

Build a real `public_id` (no ObjectId fallback), and skip records that don't have one:

```js
const publicId = img.public_id || (typeof img._id === 'string' && img._id.includes('/') ? img._id : null);
if (!publicId) {
    // log and skip — don't pretend an ObjectId is a public_id
    continue;
}
```

Also update the DB pointer after upload so `images.${i}._id` and `public_id` stay aligned:

```js
$set: {
    [`images.${task.imageIndex}.url`]: uploaded.url,
    [`images.${task.imageIndex}.public_id`]: uploaded.public_id,
    [`images.${task.imageIndex}.blurDataURL`]: uploaded.blurDataURL,
},
```

### 1.4 Follow redirects on download

**File:** `batch-remove-backgrounds.js:51-68`

Replace `https.get` with `axios` (already a backend dep):

```js
const axios = require('axios');

async function downloadImage(url, dest) {
    const res = await axios.get(url, { responseType: 'stream', maxRedirects: 5, timeout: 30_000 });
    await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        res.data.pipe(file);
        file.on('finish', resolve);
        file.on('error', reject);
    });
}
```

### 1.5 Validate downloaded content

After download, reject anything that isn't an image before handing it to `rembg`:

```js
const { size } = fs.statSync(rawPath);
if (size < 1024) throw new Error(`Suspiciously small download (${size} bytes)`);
```

(Optionally check magic bytes for `FFD8` / `8950 4E47`.)

### 1.6 Apply EXIF orientation in Python

**File:** `remove-bg-white.py:20`

```python
from PIL import Image, ImageOps

input_img = Image.open(input_path).convert("RGBA")
input_img = ImageOps.exif_transpose(input_img)   # ← respect camera rotation
```

### 1.7 Stream the log to disk

**File:** `batch-remove-backgrounds.js:215-216`

Append each result immediately so a crash after 590 successes doesn't lose the record:

```js
const logStream = fs.createWriteStream(logPath, { flags: 'a' });
// inside loop, after each task:
logStream.write(JSON.stringify(entry) + '\n');
```

Use JSON Lines (`.jsonl`) instead of a single JSON array — simpler to append, easier to diff.

### 1.8 Clean temp files on every path

Wrap the per-task body in `try/finally` so raw + clean files are removed whether the task succeeded or failed.

### 1.9 Reflect failures in the exit code

```js
process.exit(results.errors > 0 ? 1 : 0);
```

So CI / `&&` chains notice.

---

## Phase 2 — Speed Improvements (minimum resources)

The Python `rembg` call dominates wall-clock time (multiple seconds per image on CPU). Network and DB work are minor by comparison. Optimize in this order:

### 2.1 Remove the artificial sleep

**File:** `batch-remove-backgrounds.js:41`

```js
const DELAY_MS = 0;   // was 800
```

Cloudinary's free/standard rate limits are far above what this loop produces. 603 × 800 ms ≈ **8 minutes of pure sleep** saved.

### 2.2 Keep the Python process alive (biggest win)

Right now every image spawns a fresh `python` interpreter, which re-imports `rembg`, reloads the U²Net model (~170 MB), and re-allocates ONNX runtime memory. That's **3–5 seconds of pure startup per image**.

**Fix:** make `remove-bg-white.py` a long-running worker that reads paths from stdin and writes status to stdout.

```python
# remove-bg-white.py (worker mode)
import sys
from PIL import Image, ImageOps
from rembg import remove, new_session

session = new_session("u2net")   # load model ONCE

for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        inp, outp = line.split("\t")
        img = ImageOps.exif_transpose(Image.open(inp).convert("RGBA"))
        no_bg = remove(img, session=session)
        white = Image.new("RGBA", no_bg.size, (255, 255, 255, 255))
        white.paste(no_bg, (0, 0), no_bg)
        white.convert("RGB").save(outp, "JPEG", quality=92, subsampling=0)
        sys.stdout.write(f"OK\t{outp}\n")
    except Exception as e:
        sys.stdout.write(f"ERR\t{e}\n")
    sys.stdout.flush()
```

On the Node side, spawn it once with `child_process.spawn`, write `${inputPath}\t${outputPath}\n` per task, await one `OK` / `ERR` line.

**Expected gain:** from ~5 s/image to ~1–2 s/image. On 603 images that's ~30 min saved with zero extra hardware.

### 2.3 Overlap download + bg-removal + upload (pipeline)

These three stages are independent and bound by different resources (network → CPU → network). A 3-stage pipeline with concurrency 1 per stage uses no more peak RAM than the current setup but cuts wall time by ~3x:

```
Download(i+2)  ─┐
RemoveBG(i+1)  ─┤  all running concurrently
Upload(i)      ─┘
```

Implementation: keep a `Promise` queue of length 3, advance one stage per loop tick. Or use a tiny worker pool (`p-limit` with `concurrency: 2` for download and upload — keep rembg at 1).

### 2.4 Skip already-processed images

Read the prior `batch-bg-removal-log.jsonl` at startup and drop any task whose `publicId` is already marked `success`. Re-runs become incremental instead of full re-processing.

### 2.5 Smaller model variant

`rembg` supports `u2netp` (a ~4 MB quantized version of U²Net). Quality is slightly lower but acceptable for clean product shots, and inference is **~2x faster** with **~10x less RAM**.

```python
session = new_session("u2netp")   # quantized
```

Try on a 20-image sample first; if labels look fine, switch globally.

### 2.6 Resize before processing

Most product photos are 2000–3000 px wide. `rembg` runs at U²Net's native 320×320 input regardless, but PIL has to decode the full image first. Downscale to max 1024 px on the long edge before `remove()`:

```python
img.thumbnail((1024, 1024), Image.LANCZOS)
```

Saves decode time, alpha-composite time, and JPEG encode time. Cloudinary's `c_limit,w_2000` transform can be applied at delivery if you ever need the larger version back.

### 2.7 (Optional) GPU

If a GPU is available, `rembg` will use it automatically when `onnxruntime-gpu` is installed in the venv. ~10x faster than CPU. Skip if running on a laptop or shared host — not worth the install pain for a one-off.

---

## Phase 3 — Operational Improvements

### 3.1 CLI flags

Replace hardcoded category filter with flags:

```bash
node scripts/batch-remove-backgrounds.js --categories=whiskey,tequila --limit=50 --dry-run
node scripts/batch-remove-backgrounds.js --categories=all
node scripts/batch-remove-backgrounds.js --resume   # uses log to skip done items
```

### 3.2 Retry transient failures

Wrap download + upload in a 3-try exponential backoff (`1s`, `2s`, `4s`). Only retry on network errors / 5xx — never on 4xx.

### 3.3 Per-image timeout

Set a 60 s timeout per task. A stuck `rembg` invocation should not freeze the whole batch.

### 3.4 Sample-then-batch workflow

Before processing 600 more images, run on 10 random samples and eyeball the output. Bottles with reflective foil and dark spirits are the failure modes.

---

## Phase 4 — Verification

After a run, verify:

1. `results.errors === 0` (or all errors triaged).
2. Random-sample 20 products in the admin panel; check images render with clean white background.
3. `blurDataURL` field is non-empty on updated docs:
   ```js
   db.products.countDocuments({ "images.blurDataURL": { $exists: false } })
   ```
4. Cloudinary asset count hasn't grown unexpectedly (would indicate Phase 1.3 isn't working — new assets being created instead of overwrites).

---

## Estimated Total Impact

| Change | Wall-clock saved (603 images) | Extra RAM | Extra disk |
|--------|------------------------------|-----------|------------|
| Remove `DELAY_MS` (2.1) | ~8 min | 0 | 0 |
| Persistent Python worker (2.2) | ~30 min | 0 (same model, loaded once) | 0 |
| 3-stage pipeline (2.3) | ~10 min | +1 image buffer (~5 MB) | 0 |
| Resume from log (2.4) | variable | 0 | 0 |
| `u2netp` model (2.5) | ~15 min | **−150 MB** | −165 MB |
| Resize before processing (2.6) | ~5 min | reduced | 0 |

**Baseline:** ~75 min for 603 images.
**After Phase 2:** ~10–15 min for the same 603, with **less peak RAM than the baseline**.

---

## Files Touched

- `backend/scripts/batch-remove-backgrounds.js` — phases 1.1–1.5, 1.7–1.9, 2.1, 2.2 (worker protocol), 2.3, 2.4, 3.x
- `backend/scripts/remove-bg-white.py` — phases 1.6, 2.2, 2.5, 2.6
- `backend/scripts/batch-bg-removal-log.jsonl` — new append-only log format (replaces `.json`)
