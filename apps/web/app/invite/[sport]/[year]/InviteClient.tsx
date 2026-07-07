'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import { Users, Share2, Check, ArrowRight, Copy, UserPlus } from 'lucide-react'

interface AlumniPreview {
  full_name: string | null
  company: string | null
  role: string | null
}

interface CohortData {
  sport: string
  sport_slug: string
  graduation_year: number
  total_count: number
  alumni: AlumniPreview[]
}

export default function InviteClient({ data }: { data: CohortData }) {
  const [copied, setCopied] = useState(false)

  const inviteUrl = typeof window !== 'undefined'
    ? window.location.href
    : `https://scout.app/invite/${data.sport_slug}/${data.graduation_year}`

  const shareText = `${data.total_count} ${data.sport} alumni from the class of ${data.graduation_year} are on Scout. Join them!`

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
      const input = document.createElement('input')
      input.value = inviteUrl
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Scout — ${data.sport} Class of ${data.graduation_year}`,
          text: shareText,
          url: inviteUrl,
        })
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink()
    }
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <img src="/favicon.svg" alt="Scout" className="w-10 h-10" />
          <span className="logo-text text-xl">scout</span>
        </Link>

        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 text-center">
          {/* Header */}
          <div className="w-16 h-16 bg-[--school-primary]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-[--school-primary]" />
          </div>

          <h1 className="text-2xl font-semibold mb-1">
            {data.sport}
          </h1>
          <p className="text-[--text-tertiary] text-sm mb-6">
            Class of {data.graduation_year}
          </p>

          {/* Count */}
          <div className="bg-[--bg-tertiary] rounded-xl p-6 mb-6">
            <div className="text-5xl font-bold text-[--school-primary] mb-1">
              {data.total_count}
            </div>
            <p className="text-[--text-tertiary] text-sm">
              {data.total_count === 1
                ? 'alumni on Scout'
                : 'alumni on Scout'}
            </p>
          </div>

          {/* Alumni preview */}
          {data.alumni.length > 0 && (
            <div className="mb-6 text-left">
              <p className="text-xs text-[--text-quaternary] uppercase tracking-wide mb-3">
                Recently joined
              </p>
              <div className="space-y-2">
                {data.alumni.map((alum, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 bg-[--bg-primary] border border-[--border-primary] rounded-lg px-4 py-3"
                  >
                    <div className="w-8 h-8 bg-[--school-primary]/10 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-[--school-primary]">
                        {alum.full_name?.charAt(0) ?? '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {alum.full_name ?? 'Anonymous'}
                      </p>
                      {(alum.company || alum.role) && (
                        <p className="text-xs text-[--text-tertiary] truncate">
                          {[alum.role, alum.company].filter(Boolean).join(' at ')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {data.total_count > data.alumni.length && (
                <p className="text-xs text-[--text-quaternary] text-center mt-2">
                  +{data.total_count - data.alumni.length} more
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {data.alumni.length === 0 && (
            <div className="mb-6 p-6 bg-[--bg-tertiary] rounded-xl">
              <p className="text-sm text-[--text-tertiary]">
                Be the first from this cohort to join Scout!
              </p>
            </div>
          )}

          {/* CTA */}
          <Link
            href={`/join?sport=${encodeURIComponent(data.sport_slug)}&year=${data.graduation_year}`}
            className="btn-primary flex items-center justify-center gap-2 w-full mb-3"
          >
            <UserPlus size={16} />
            {data.total_count > 0
              ? 'Join Your Teammates'
              : 'Be the First to Join'}
            <ArrowRight size={16} />
          </Link>

          {/* Share */}
          <div className="flex gap-2">
            <button
              onClick={handleCopyLink}
              className="btn-secondary flex items-center justify-center gap-2 flex-1"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-500" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={14} />
                  Copy Link
                </>
              )}
            </button>
            <button
              onClick={handleShare}
              className="btn-secondary flex items-center justify-center gap-2 flex-1"
            >
              <Share2 size={14} />
              Share
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[--text-quaternary] mt-8">
          Scout connects current student-athletes with alumni who've been in their shoes.
        </p>
      </div>
    </main>
  )
}
