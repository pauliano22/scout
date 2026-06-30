'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { cleanField } from '@/lib/cleanField'

export interface ShareableProfileData {
  full_name: string
  sport: string
  graduation_year: number
  company: string | null
  role: string | null
  location: string | null
  photo_url?: string | null
  avatar_url?: string | null
}

interface ShareableProfileCardProps {
  alumni: ShareableProfileData
  /** Usually the page origin + path for the alum's profile */
  profileUrl?: string
  /** Additional class hidden by default — component is rendered offscreen for capture */
  className?: string
  /** ref for the containing element (used by html-to-image) */
  cardRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * Renders a branded profile card designed to be captured as a PNG image.
 * Uses Cornell red (#B31B1B) and warm beige (#F5F0EB) brand colors with Inter typeface.
 */
export default function ShareableProfileCard({
  alumni,
  profileUrl,
  className = '',
  cardRef,
}: ShareableProfileCardProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [imgError, setImgError] = useState(false)
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = (cardRef as React.RefObject<HTMLDivElement>) || internalRef

  const role = cleanField(alumni.role)
  const company = cleanField(alumni.company)

  // Generate QR code as data URL
  useEffect(() => {
    const url = profileUrl || (typeof window !== 'undefined' ? window.location.href : '')
    if (!url) return

    QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: {
        dark: '#1a1a1a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(() => {
        // Silently fail — card still works without QR
      })
  }, [profileUrl])

  const photoUrl = alumni.photo_url || alumni.avatar_url

  function getInitials(name: string): string {
    const parts = name.trim().split(' ').filter(Boolean)
    if (parts.length === 0) return '?'
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: 420,
        background: '#F5F0EB',
        borderRadius: 20,
        overflow: 'hidden',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    >
      {/* Top brand bar */}
      <div
        style={{
          background: '#B31B1B',
          padding: '14px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Scout logo mark */}
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'rgba(255,255,255,0.15)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
            fontWeight: 800,
            color: '#fff',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          S
          <div
            style={{
              position: 'absolute',
              top: -1,
              right: -1,
              width: 8,
              height: 8,
              background: '#fff',
              opacity: 0.9,
            }}
          />
        </div>
        <span
          style={{
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: '-0.03em',
            color: '#fff',
          }}
        >
          scout
        </span>
        <span style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'rgba(255,255,255,0.7)',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          Cornell
        </span>
      </div>

      {/* Body */}
      <div
        style={{
          padding: '32px 28px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* Avatar / Photo */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '3px solid #B31B1B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          {photoUrl && !imgError ? (
            <img
              src={photoUrl}
              alt={alumni.full_name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={() => setImgError(true)}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e8e0d6',
                color: '#B31B1B',
                fontSize: 32,
                fontWeight: 700,
              }}
            >
              {getInitials(alumni.full_name)}
            </div>
          )}
        </div>

        {/* Name */}
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: '#1a1a1a',
            letterSpacing: '-0.03em',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {alumni.full_name}
        </h2>

        {/* Sport + Class */}
        <p
          style={{
            fontSize: 13,
            color: '#6b6b6b',
            fontWeight: 500,
            margin: '4px 0 0',
            textAlign: 'center',
          }}
        >
          {alumni.sport}
          <span style={{ color: '#B31B1B', margin: '0 6px' }}>·</span>
          Class of {alumni.graduation_year}
        </p>

        {/* Role + Company */}
        {(role || company) && (
          <p
            style={{
              fontSize: 14,
              color: '#3f3f46',
              fontWeight: 500,
              textAlign: 'center',
              margin: '12px 0 0',
              lineHeight: '1.4',
            }}
          >
            {role}{role && company && <span style={{ color: '#a1a1aa' }}> at </span>}{company}
          </p>
        )}

        {/* Location */}
        {alumni.location && (
          <p
            style={{
              fontSize: 12,
              color: '#a1a1aa',
              margin: '6px 0 0',
              textAlign: 'center',
            }}
          >
            📍 {alumni.location}
          </p>
        )}

        {/* Divider */}
        <div
          style={{
            width: '100%',
            height: 1,
            background: '#e0d8ce',
            margin: '20px 0 16px',
          }}
        />

        {/* Bottom row: QR + CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            width: '100%',
          }}
        >
          {/* QR Code */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #e0d8ce',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Profile QR" style={{ width: 76, height: 76 }} />
            ) : (
              <div
                style={{
                  width: 76,
                  height: 76,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  color: '#a1a1aa',
                }}
              >
                QR
              </div>
            )}
          </div>

          {/* CTA text */}
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: '#B31B1B',
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Scan to connect
            </p>
            <p
              style={{
                fontSize: 11,
                color: '#6b6b6b',
                margin: '3px 0 0',
                lineHeight: '1.4',
              }}
            >
              View full profile and connect on Scout
            </p>
          </div>
        </div>

        {/* Cornell footer */}
        <div
          style={{
            marginTop: 18,
            width: '100%',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              color: '#b8b0a6',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            Cornell Big Red · Scout
          </span>
        </div>
      </div>
    </div>
  )
}
