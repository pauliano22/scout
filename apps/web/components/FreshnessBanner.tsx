'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, X } from 'lucide-react'

const DISMISS_KEY = 'scout_profile_freshness_dismissed'
const DISMISS_DAYS = 30
const MS_PER_DAY = 86_400_000

interface Props {
  /** Names of stale fields, e.g. ['role', 'company']. */
  staleFields: string[]
  /** Days since the oldest stale field was updated. */
  daysSinceUpdate: number
}

/**
 * FreshnessBanner — shown to claimed alumni whose profile data is 6+ months
 * old.  Dismissible; after dismissal it won't re-appear for 30 days.
 */
export default function FreshnessBanner({ staleFields, daysSinceUpdate }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY)
      if (raw) {
        const dismissedAt = parseInt(raw, 10)
        if (Date.now() - dismissedAt < DISMISS_DAYS * MS_PER_DAY) {
          setVisible(false)
          return
        }
      }
    } catch {
      // localStorage unavailable (SSR / private browsing) — show the banner.
    }
    setVisible(true)
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // ignore
    }
    setVisible(false)
  }

  if (!visible) return null

  const fieldLabels: Record<string, string> = {
    role: 'Job title',
    company: 'Company',
    industry: 'Industry',
    location: 'Location',
    bio: 'Bio / past experience',
  }

  const label = staleFields.length === 1
    ? fieldLabels[staleFields[0]] ?? staleFields[0]
    : `${staleFields.length} profile fields`

  const days = daysSinceUpdate >= 365
    ? `over ${Math.floor(daysSinceUpdate / 365)} year${Math.floor(daysSinceUpdate / 365) > 1 ? 's' : ''}`
    : `${daysSinceUpdate} day${daysSinceUpdate !== 1 ? 's' : ''}`

  return (
    <div className="relative bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-5">
      <div className="flex items-start gap-3">
        <RefreshCw size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-amber-200 font-medium">
            Your {label} {staleFields.length === 1 ? 'is' : 'are'} {days} old
          </p>
          <p className="text-xs text-amber-300/80 mt-0.5">
            Keeping your profile up to date helps student-athletes find you.
          </p>
          <Link
            href="/profile?tab=edit"
            className="inline-block mt-2 text-xs font-medium text-amber-200 underline underline-offset-2 hover:text-amber-100 transition-colors"
          >
            Update your profile &rarr;
          </Link>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
