'use client'

import { useEffect, useState } from 'react'

interface ReferralStats {
  redemption_count: number
  leaderboard_position: number | null
  total_referrers: number
  code: string | null
}

interface ReferralProgressTrackerProps {
  className?: string
}

/**
 * ReferralProgressTracker component
 *
 * Shows the user's referral code, stats, and a copy-to-clipboard link.
 * Designed to be embedded on the profile/settings page.
 */
export default function ReferralProgressTracker({
  className = '',
}: ReferralProgressTrackerProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/referral/stats')
        if (!res.ok) {
          throw new Error('Failed to load referral stats')
        }
        const data = await res.json()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const handleCopy = async () => {
    if (!stats?.code) return

    const url = `${window.location.origin}/invite/${stats.code}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className={`animate-pulse bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
        <div className="h-5 w-40 bg-gray-200 rounded mb-4" />
        <div className="h-4 w-60 bg-gray-200 rounded mb-2" />
        <div className="h-10 w-full bg-gray-200 rounded mt-4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  const hasCode = stats?.code
  const progress = stats ? Math.min((stats.redemption_count / 10) * 100, 100) : 0

  // Milestones
  const milestones = [
    { count: 1, label: 'First referral', emoji: '🎯' },
    { count: 5, label: 'Network builder', emoji: '🤝' },
    { count: 10, label: 'Super connector', emoji: '🌟' },
  ]

  return (
    <div className={`bg-white rounded-xl border border-gray-100 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔗</span>
        <h3 className="text-lg font-semibold text-gray-900">Referral Program</h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Invite your Cornell teammates to join the network and track your impact!
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats?.redemption_count ?? 0}</p>
          <p className="text-xs text-gray-500">Referred</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">
            {stats?.leaderboard_position ? `#${stats.leaderboard_position}` : '-'}
          </p>
          <p className="text-xs text-gray-500">Rank</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats?.total_referrers ?? 0}</p>
          <p className="text-xs text-gray-500">Referrers</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-500">Progress to Super Connector</span>
          <span className="text-xs font-medium text-gray-700">{stats?.redemption_count ?? 0}/10</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#B31B1B] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Milestones */}
      <div className="flex justify-between mb-5">
        {milestones.map((m) => {
          const reached = (stats?.redemption_count ?? 0) >= m.count
          return (
            <div key={m.count} className="text-center">
              <div className={`text-lg ${reached ? '' : 'opacity-30'}`}>{m.emoji}</div>
              <p className={`text-[10px] font-medium ${reached ? 'text-gray-700' : 'text-gray-400'}`}>
                {m.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Referral link */}
      {hasCode ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Your referral link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}/invite/${stats.code}`}
              className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-600 font-mono"
              onClick={(e) => e.currentTarget.select()}
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-[#B31B1B] hover:bg-[#8B1515] text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-3">
          <p className="text-sm text-gray-500 mb-2">No referral link yet</p>
          <button
            onClick={async () => {
              try {
                const res = await fetch('/api/referral/create', { method: 'POST' })
                if (res.ok) {
                  // Reload stats
                  window.location.reload()
                }
              } catch {
                // Silent fail
              }
            }}
            className="px-4 py-2 bg-[#B31B1B] hover:bg-[#8B1515] text-white text-sm font-medium rounded-lg transition-colors"
          >
            Create Referral Link
          </button>
        </div>
      )}
    </div>
  )
}
