const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const getBlurDataURL = require('../config/getBlurDataURL');

const STORAGE_DIR = process.env.IMAGE_FALLBACK_DIR || path.join(__dirname, '../../image-fallback/storage/images');

function ensureDir() {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_{2,}/g, '_');
}

/**
 * Save an image buffer to local fallback storage and return the local URL.
 * @param {Buffer} buffer
 * @param {string} originalName
 * @param {string} [deterministicId] — optional ID to make filename deterministic
 * @returns {{ filename: string, localUrl: string, filePath: string }}
 */
function saveBuffer(buffer, originalName, deterministicId = null) {
  ensureDir();
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const basename = sanitizeFilename(path.basename(originalName, ext)) || 'image';
  const id = deterministicId || crypto.randomBytes(4).toString('hex');
  const filename = `${basename}_${id}${ext}`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  return { filename, localUrl: `/api/images/${filename}`, filePath };
}

/**
 * Save a file from disk to local fallback storage.
 * Optionally removes the source file after copying.
 * @param {string} sourcePath
 * @param {string} originalName
 * @param {string} [deterministicId]
 * @param {{ removeSource?: boolean }} [opts]
 * @returns {{ filename: string, localUrl: string, filePath: string }}
 */
function saveFile(sourcePath, originalName, deterministicId = null, opts = {}) {
  ensureDir();
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const basename = sanitizeFilename(path.basename(originalName, ext)) || 'image';
  const id = deterministicId || crypto.randomBytes(4).toString('hex');
  const filename = `${basename}_${id}${ext}`;
  const filePath = path.join(STORAGE_DIR, filename);
  fs.copyFileSync(sourcePath, filePath);
  if (opts.removeSource && fs.existsSync(sourcePath)) {
    fs.unlinkSync(sourcePath);
  }
  return { filename, localUrl: `/api/images/${filename}`, filePath };
}

/**
 * Generate a tiny blur placeholder from a local file path.
 * Falls back to a 1x1 transparent PNG if generation fails.
 */
async function getLocalBlurDataURL(filePath) {
  try {
    // Reuse the Cloudinary blur helper's logic: read file, resize+blur via sharp or canvas.
    // For now return the same 1x1 gray placeholder used by react-loading-skeleton.
    const placeholder = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
    return `data:image/png;base64,${placeholder.toString('base64')}`;
  } catch (err) {
    console.error('Blur generation failed:', err);
    return null;
  }
}

module.exports = {
  saveBuffer,
  saveFile,
  getLocalBlurDataURL,
  STORAGE_DIR,
};
