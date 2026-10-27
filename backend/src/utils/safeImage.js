 'use strict';
const sharp = require('sharp');
const path = require('path');
const formats = { '.jpg': 'jpeg', '.jpeg': 'jpeg', '.png': 'png', '.webp': 'webp' };
async function sanitizeImage(buffer, name, mime) {
  const expected = formats[path.extname(name || '').toLowerCase()];
  if (!expected || mime !== `image/${expected}` || !Buffer.isBuffer(buffer) || buffer.length > 10 * 1024 * 1024) throw new Error('Only JPEG, PNG and WebP images are supported');
  const image = sharp(buffer, { limitInputPixels: 16000000, failOn: 'warning', animated: false });
  const info = await image.metadata();
  if (info.format !== expected || (info.pages || 1) !== 1 || !info.width || !info.height || info.width > 8192 || info.height > 8192) throw new Error('Invalid or oversized image');
  return image.rotate().webp({ quality: 90 }).toBuffer();
}
module.exports = { sanitizeImage };
