/**
 * Cloudinary image optimization helpers.
 * Appends resize/quality/format transforms to Cloudinary URLs.
 */

export function getOptimizedImageUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('cloudinary.com')) return url;

  const { width = 400, height, crop = 'scale', quality = 'auto' } = opts;

  const transform = [];
  if (width) transform.push(`w_${width}`);
  if (height) transform.push(`h_${height}`);
  if (crop) transform.push(`c_${crop}`);
  if (quality) transform.push(`q_${quality}`);
  if (quality === 'auto') transform.push('f_auto');

  const transformStr = transform.join(',');
  return url.replace(/\/image\/upload\//, `/image/upload/${transformStr}/`);
}

/** Product card thumbnail (~350px container) */
export function getProductCardImage(url) {
  return getOptimizedImageUrl(url, { width: 400, crop: 'scale', quality: 'auto' });
}

/** Product detail main image (~800px container) */
export function getProductDetailImage(url) {
  return getOptimizedImageUrl(url, { width: 800, crop: 'scale', quality: 'auto' });
}

/** Product detail thumbnail slider */
export function getProductThumbImage(url) {
  return getOptimizedImageUrl(url, { width: 200, height: 200, crop: 'fill', quality: 'auto' });
}

/** Small thumbnail for lists (~100px) */
export function getThumbnailImage(url) {
  return getOptimizedImageUrl(url, { width: 150, height: 150, crop: 'fill', quality: 'auto' });
}

/** Admin tiny thumbnail */
export function getAdminThumbnail(url) {
  return getOptimizedImageUrl(url, { width: 100, height: 100, crop: 'fill', quality: 'auto' });
}
