'use client'

import { useState, useEffect } from 'react'
import { isLikelyPlaceholderAvatar } from '@/lib/isPlaceholderAvatar'

// LinkedIn CDN hosts both real and generic silhouette images — indistinguishable by URL alone.
// We check size server-side (silhouettes ~3KB, real photos ~15-100KB) and cache in sessionStorage.
function useSilhouetteCheck(imageUrl: string | null | undefined): boolean {
  const [isSilhouette, setIsSilhouette] = useState(false)

  useEffect(() => {
    if (!imageUrl || !imageUrl.includes('media.licdn.com')) return

    const cacheKey = `avatar-check:${imageUrl}`
    try {
      const cached = sessionStorage.getItem(cacheKey)
      if (cached !== null) {
        setIsSilhouette(cached === '1')
        return
      }
    } catch { /* sessionStorage unavailable */ }

    fetch(`/api/avatar/check?url=${encodeURIComponent(imageUrl)}`)
      .then(r => r.json())
      .then(({ isPlaceholder }: { isPlaceholder: boolean }) => {
        try { sessionStorage.setItem(cacheKey, isPlaceholder ? '1' : '0') } catch { /* ignore */ }
        if (isPlaceholder) setIsSilhouette(true)
      })
      .catch(() => { /* fail open — don't hide a real photo due to network error */ })
  }, [imageUrl])

  return isSilhouette
}

interface AvatarProps {
  name: string
  sport?: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  className?: string
}

// Initials fallback — one muted, school-tinted style. Never bright, never
// random: a person without a photo should still look like part of the system.
function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
}

export default function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false)
  const isSilhouette = useSilhouetteCheck(imageUrl)
  const initials = getInitials(name)
  const sizeClass = sizeClasses[size]

  // Show image only if: URL present, not a known placeholder pattern, not a LinkedIn silhouette, and hasn't errored at runtime
  const showImage = !!imageUrl && !isLikelyPlaceholderAvatar(imageUrl) && !isSilhouette && !imgFailed

  if (showImage) {
    return (
      <img
        src={imageUrl!}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${className}`}
      style={{
        background: 'color-mix(in srgb, var(--school-primary) 10%, var(--bg-tertiary))',
        color: 'color-mix(in srgb, var(--school-primary) 75%, var(--text-primary))',
      }}
    >
      {initials}
    </div>
  )
}
