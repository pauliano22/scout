'use client'

import { useRef, useState, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { Share2, Download, Loader2, Check } from 'lucide-react'
import ShareableProfileCard from '@/components/ShareableProfileCard'
import type { ShareableProfileData } from '@/components/ShareableProfileCard'

interface ShareProfileButtonProps {
  alumni: ShareableProfileData
  profileUrl?: string
}

/**
 * "Share Profile" button that either:
 * 1. Downloads the profile card as a PNG (desktop fallback)
 * 2. Opens the native share sheet (mobile browsers with Web Share API + file support)
 */
export default function ShareProfileButton({ alumni, profileUrl }: ShareProfileButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null!)
  const [status, setStatus] = useState<'idle' | 'generating' | 'success' | 'error'>('idle')

  const handleShare = useCallback(async () => {
    setStatus('generating')

    try {
      if (!cardRef.current) {
        throw new Error('Card element not available')
      }

      // Give the card a moment to render
      await new Promise((r) => setTimeout(r, 150))

      const dataUrl = await toPng(cardRef.current, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#F5F0EB',
      })

      // Try native share (mobile) with the image file
      if (navigator.share && navigator.canShare) {
        const blob = await (await fetch(dataUrl)).blob()
        const file = new File([blob], `${alumni.full_name.replace(/\s+/g, '_')}_scout_card.png`, {
          type: 'image/png',
        })

        const shareData: ShareData = {
          title: `${alumni.full_name} — Scout Profile`,
          text: `Check out ${alumni.full_name} on Scout — Cornell ${alumni.sport}, Class of ${alumni.graduation_year}`,
          files: [file],
        }

        if (navigator.canShare(shareData)) {
          await navigator.share(shareData)
          setStatus('success')
          return
        }
      }

      // Fallback: download the image
      const link = document.createElement('a')
      link.download = `${alumni.full_name.replace(/\s+/g, '_')}_scout_card.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      setStatus('success')
    } catch (err) {
      console.error('Share failed:', err)
      setStatus('error')
    } finally {
      setTimeout(() => setStatus('idle'), 3000)
    }
  }, [alumni, cardRef])

  return (
    <>
      {/* Hidden off-screen card for image generation */}
      <div className="fixed" style={{ left: -9999, top: 0, zIndex: -1 }}>
        <ShareableProfileCard
          alumni={alumni}
          profileUrl={profileUrl}
          cardRef={cardRef}
        />
      </div>

      <button
        onClick={handleShare}
        disabled={status === 'generating'}
        className="btn-secondary flex items-center justify-center gap-2 px-4 text-sm"
        title="Share profile as a card"
      >
        {status === 'generating' ? (
          <Loader2 size={15} className="animate-spin" />
        ) : status === 'success' ? (
          <Check size={15} className="text-green-500" />
        ) : (
          <Share2 size={15} />
        )}
        <span className="hidden sm:inline">
          {status === 'generating' ? 'Generating...' : status === 'success' ? 'Done!' : 'Share Profile'}
        </span>
        <span className="sm:hidden">
          {status === 'generating' ? '...' : status === 'success' ? '✓' : 'Share'}
        </span>
      </button>
    </>
  )
}
