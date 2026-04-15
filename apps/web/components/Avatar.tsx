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

// Map sport to a gradient background style
function getSportGradient(sport: string): string | null {
  const s = sport.toLowerCase()
  if (s.includes('football')) return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
  if (s.includes('basketball')) return 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
  if (s.includes('soccer')) return 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
  if (s.includes('lacrosse')) return 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
  if (s.includes('hockey')) return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  if (s.includes('tennis')) return 'linear-gradient(135deg, #84cc16 0%, #65a30d 100%)'
  if (s.includes('baseball') || s.includes('softball')) return 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
  if (s.includes('volleyball')) return 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'
  if (s.includes('swimming') || s.includes('diving')) return 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)'
  if (s.includes('track') || s.includes('cross country')) return 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)'
  if (s.includes('rowing') || s.includes('crew')) return 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
  if (s.includes('wrestling')) return 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)'
  if (s.includes('golf')) return 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
  if (s.includes('fencing')) return 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
  if (s.includes('gymnastics')) return 'linear-gradient(135deg, #d946ef 0%, #c026d3 100%)'
  if (s.includes('field hockey')) return 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)'
  if (s.includes('squash')) return 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)'
  if (s.includes('polo')) return 'linear-gradient(135deg, #059669 0%, #047857 100%)'
  if (s.includes('sail')) return 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)'
  if (s.includes('sprint')) return 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)'
  return null
}

// Fallback: generate a gradient class based on name hash
function getGradientClass(name: string): string {
  const gradients = [
    'avatar-gradient-1',
    'avatar-gradient-2',
    'avatar-gradient-3',
    'avatar-gradient-4',
    'avatar-gradient-5',
    'avatar-gradient-6',
    'avatar-gradient-7',
  ]

  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }

  return gradients[Math.abs(hash) % gradients.length]
}

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

export default function Avatar({ name, sport, imageUrl, size = 'md', className = '' }: AvatarProps) {
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
        className={`${sizeClass} rounded-full object-cover shadow-md flex-shrink-0 ${className}`}
        onError={() => setImgFailed(true)}
      />
    )
  }

  const sportGradient = sport ? getSportGradient(sport) : null

  if (sportGradient) {
    return (
      <div
        className={`${sizeClass} rounded-full flex items-center justify-center font-semibold text-white shadow-md flex-shrink-0 ${className}`}
        style={{ background: sportGradient }}
      >
        {initials}
      </div>
    )
  }

  const gradientClass = getGradientClass(name)
  return (
    <div
      className={`${sizeClass} ${gradientClass} rounded-full flex items-center justify-center font-semibold text-white shadow-md flex-shrink-0 ${className}`}
    >
      {initials}
    </div>
  )
}
