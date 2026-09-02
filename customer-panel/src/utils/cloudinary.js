/**
 * Cloudinary image optimization helpers.
 * Appends resize/quality/format transforms to Cloudinary URLs.
 * Rewrites URLs to the configured local fallback CDN when the input is already
 * a fallback URL (non-Cloudinary) so images keep working if Cloudinary is down.
 */

const FALLBACK_BASE = process.env.REACT_APP_IMAGE_FALLBACK_URL || '/api/images';

export function isCloudinaryUrl(url) {
  return typeof url === 'string' && url.includes('cloudinary.com');
}

export function getFallbackImageUrl(originalUrl, filenameHint) {
  if (!originalUrl || typeof originalUrl !== 'string') return originalUrl;
  if (!isCloudinaryUrl(originalUrl)) return originalUrl;

  const cleanBase = originalUrl
    .split('?')[0]
    .split('#')[0]
    .replace(/\/$/, '');

  let filename = filenameHint;

  if (!filename) {
    try {
      const parts = cleanBase.split('/');
      filename = parts[parts.length - 1];
    } catch {
      filename = null;
    }
  }

  if (!filename) return originalUrl;

  return `${FALLBACK_BASE}/${filename}`;
}

export function getOptimizedImageUrl(url, opts = {}) {
  if (!url || typeof url !== 'string') return url;
  if (!isCloudinaryUrl(url)) return url;

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

/** Build final image URL. Local /api/images/ URLs are served by our backend/Nginx.
 *  Cloudinary URLs are optimized on the fly and treated as fallback only.
 */
export function resolveImageUrl(image, opts = {}) {
  if (!image) return '';
  const { url, fallbackUrl } = image;
  if (!url) return fallbackUrl || '';

  // Local API path — already correct, no transforms needed
  if (typeof url === 'string' && url.startsWith('/api/images/')) return url;

  // If primary is Cloudinary, optimize it
  if (isCloudinaryUrl(url)) return getOptimizedImageUrl(url, opts);

  // Unknown external URL — pass through
  return url;
}

/** Build final image URL, falling back to Cloudinary if the local URL is missing. */
export function resolveImageUrlWithFallback(image, opts = {}) {
  const primary = resolveImageUrl(image, opts);
  if (primary) return primary;
  if (image?.fallbackUrl) return getOptimizedImageUrl(image.fallbackUrl, opts);
  return '';
}

/** Product card thumbnail — responsive width for crisp mobile/desktop */
export function getProductCardImage(imageOrUrl, isMobile = false) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, { width: isMobile ? 400 : 800, height: isMobile ? 400 : 800, crop: 'fill', quality: 'auto' });
  }
  return getOptimizedImageUrl(imageOrUrl, { width: isMobile ? 400 : 800, height: isMobile ? 400 : 800, crop: 'fill', quality: 'auto' });
}

/** Product detail main image (~1200px container, retina ready) */
export function getProductDetailImage(imageOrUrl) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, { width: 1200, crop: 'limit', quality: 'auto' });
  }
  return getOptimizedImageUrl(imageOrUrl, { width: 1200, crop: 'limit', quality: 'auto' });
}

/** Product detail thumbnail slider */
export function getProductThumbImage(imageOrUrl) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, { width: 300, height: 300, crop: 'fill', quality: 'auto' });
  }
  return getOptimizedImageUrl(imageOrUrl, { width: 300, height: 300, crop: 'fill', quality: 'auto' });
}

/** Small thumbnail for lists (~150px) */
export function getThumbnailImage(imageOrUrl) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, { width: 200, height: 200, crop: 'fill', quality: 'auto' });
  }
  return getOptimizedImageUrl(imageOrUrl, { width: 200, height: 200, crop: 'fill', quality: 'auto' });
}

/** Admin tiny thumbnail */
export function getAdminThumbnail(imageOrUrl) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, { width: 100, height: 100, crop: 'fill', quality: 'auto' });
  }
  return getOptimizedImageUrl(imageOrUrl, { width: 100, height: 100, crop: 'fill', quality: 'auto' });
}

/** Hero slide background — 16:9 aspect ratio for PC and mobile */
export function getHeroSlideImage(imageOrUrl, isMobile = false) {
  if (imageOrUrl && typeof imageOrUrl === 'object') {
    return resolveImageUrl(imageOrUrl, {
      width: isMobile ? 800 : 1920,
      height: isMobile ? 450 : 1080,
      crop: 'fill',
      quality: 'auto',
      gravity: 'auto',
    });
  }
  return getOptimizedImageUrl(imageOrUrl, {
    width: isMobile ? 800 : 1920,
    height: isMobile ? 450 : 1080,
    crop: 'fill',
    quality: 'auto',
    gravity: 'auto',
  });
}
