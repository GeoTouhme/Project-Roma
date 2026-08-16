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

/** Product card thumbnail — responsive width for crisp mobile/desktop */
export function getProductCardImage(url, isMobile = false) {
  return getOptimizedImageUrl(url, { width: isMobile ? 400 : 800, height: isMobile ? 400 : 800, crop: 'fill', quality: 'auto' });
}

/** Product detail main image (~1200px container, retina ready) */
export function getProductDetailImage(url) {
  return getOptimizedImageUrl(url, { width: 1200, crop: 'limit', quality: 'auto' });
}

/** Product detail thumbnail slider */
export function getProductThumbImage(url) {
  return getOptimizedImageUrl(url, { width: 300, height: 300, crop: 'fill', quality: 'auto' });
}

/** Small thumbnail for lists (~150px) */
export function getThumbnailImage(url) {
  return getOptimizedImageUrl(url, { width: 200, height: 200, crop: 'fill', quality: 'auto' });
}

/** Admin tiny thumbnail */
export function getAdminThumbnail(url) {
  return getOptimizedImageUrl(url, { width: 100, height: 100, crop: 'fill', quality: 'auto' });
}

/** Hero slide background — 16:9 aspect ratio for PC and mobile */
export function getHeroSlideImage(url, isMobile = false) {
  return getOptimizedImageUrl(url, {
    width: isMobile ? 800 : 1920,
    height: isMobile ? 450 : 1080,
    crop: 'fill',
    quality: 'auto',
    gravity: 'auto',
  });
}
