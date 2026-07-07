/**
 * IDEA 21: Image Optimization Pipeline
 * Utility for generating optimized image URLs using Supabase Storage
 * image transformation API.
 */

const STORAGE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1`
  : null

// Widths commonly used throughout the app for avatars and team photos
export const DEFAULT_WIDTHS = [150, 300, 600] as const

export type ImageFormat = 'webp' | 'avif' | 'original'

export interface OptimizeOptions {
  width?: number
  height?: number
  format?: ImageFormat
  quality?: number
}

/**
 * Returns a Supabase Storage image transformation URL for the given
 * original URL. Falls back to the original URL when transformations
 * aren't available (e.g. external images, missing config).
 *
 * @param url  - Original image URL (can be Supabase or external)
 * @param width  - Target width in pixels (optional)
 * @param height - Target height in pixels (optional)
 * @param format - Output format (default: 'webp')
 * @param quality - Image quality 1-100 (default: 80)
 */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  width?: number,
  height?: number,
  format: ImageFormat = 'webp',
  quality: number = 80,
): string | null {
  if (!url) return null

  // If there's no storage URL configured, return original
  if (!STORAGE_URL) return url

  // Only transform Supabase-stored images — external URLs are passed through
  if (!url.startsWith(STORAGE_URL)) return url

  try {
    const parsed = new URL(url)
    const params = new URLSearchParams(parsed.search)

    if (width) params.set('width', String(width))
    if (height) params.set('height', String(height))

    // Use WebP by default for size savings; skip if 'original'
    if (format !== 'original') {
      params.set('format', format)
    }

    params.set('quality', String(quality))

    parsed.search = params.toString()
    return parsed.toString()
  } catch {
    // If URL parsing fails, return the original URL safe
    return url
  }
}

/**
 * Generates multiple sizes of an image URL for responsive srcsets.
 *
 * @param url - Original image URL
 * @param widths - Array of desired widths
 * @param format - Output format
 * @param quality - Image quality
 * @returns Record mapping width (as string) → optimized URL
 */
export function getOptimizedImageUrls(
  url: string | null | undefined,
  widths: number[] = [...DEFAULT_WIDTHS],
  format: ImageFormat = 'webp',
  quality: number = 80,
): Record<string, string | null> {
  if (!url) return {}

  const result: Record<string, string | null> = {}

  for (const w of widths) {
    result[String(w)] = getOptimizedImageUrl(url, w, undefined, format, quality)
  }

  return result
}
