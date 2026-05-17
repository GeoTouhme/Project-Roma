import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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

export function getAdminThumbnail(url: string): string {
  return getOptimizedImageUrl(url, { width: 100, height: 100, crop: 'fill', quality: 'auto' })
}
