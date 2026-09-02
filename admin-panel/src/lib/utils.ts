import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const FALLBACK_BASE = import.meta.env.VITE_IMAGE_FALLBACK_URL || '/api/images'

function isCloudinaryUrl(url: string | undefined): boolean {
  return typeof url === 'string' && url.includes('cloudinary.com')
}

export function resolveImageUrl(
  image: { url?: string; fallbackUrl?: string } | string | undefined,
  opts: { width?: number; height?: number; crop?: string; quality?: string } = {}
): string {
  if (!image) return ''
  if (typeof image === 'string') {
    return getOptimizedImageUrl(image, opts)
  }
  const { url, fallbackUrl } = image
  if (!url) return fallbackUrl || ''
  // Local API path — served by backend/Nginx, no transforms needed
  if (url.startsWith('/api/images/')) return url
  if (!isCloudinaryUrl(url)) return url
  if (fallbackUrl) return getOptimizedImageUrl(fallbackUrl, opts)
  return getOptimizedImageUrl(url, opts)
}

/** Cloudinary image optimization */
export function getOptimizedImageUrl(
  url: string,
  opts: { width?: number; height?: number; crop?: string; quality?: string } = {}
): string {
  if (!url || !url.includes('cloudinary.com')) return url

  const { width = 400, height, crop = 'scale', quality = 'auto' } = opts
  const transform: string[] = []
  if (width) transform.push(`w_${width}`)
  if (height) transform.push(`h_${height}`)
  if (crop) transform.push(`c_${crop}`)
  if (quality) transform.push(`q_${quality}`)
  if (quality === 'auto') transform.push('f_auto')

  const transformStr = transform.join(',')
  return url.replace(/\/image\/upload\//, `/image/upload/${transformStr}/`)
}

export function getAdminThumbnail(
  image: { url?: string; fallbackUrl?: string } | string | undefined
): string {
  return resolveImageUrl(image, { width: 100, height: 100, crop: 'fill', quality: 'auto' })
}
