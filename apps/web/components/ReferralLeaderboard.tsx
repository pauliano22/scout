'use client'

import { useEffect, useState } from 'react'
import type { ReferralLeaderboardEntry } from '@scout/shared/types/database'

interface ReferralLeaderboardProps {
  limit?: number
  currentUserId?: string | null
  className?: string
}

/**
 * ReferralLeaderboard component
 *
 * Displays the top referrers sorted by referral count.
 * Highlights the current user's entry if provided.
 */
export default function ReferralLeaderboard({
  limit = 20,
  currentUserId = null,
  className = '',
}: ReferralLeaderboardProps) {
  const [entries, setEntries] = useState<ReferralLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        const res = await fetch(`/api/referral/leaderboard?limit=${limit}`)
        if (!res.ok) {
          throw new Error('Failed to load leaderboard')
        }
        const data = await res.json()
        setEntries(data.entries || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchLeaderboard()
  }, [limit])

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-200 rounded-full" />
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="w-12 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`text-sm text-red-500 ${className}`}>
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className={`text-gray-500 text-center py-8 ${className}`}>
        <div className="text-4xl mb-2">🏆</div>
        <p className="font-medium">No referrals yet</p>
        <p className="text-sm">Be the first to refer a teammate!</p>
      </div>
    )
  }

  // Medal emojis for top 3
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span>Rank</span>
        <span>Referrer</span>
        <span>Referred</span>
      </div>

      {entries.map((entry, index) => {
        const isCurrentUser = currentUserId && entry.user_id === currentUserId
        const rank = index + 1
        const displayRank = rank <= 3 ? medals[index] : `#${rank}`

        return (
          <div
            key={entry.user_id}
            className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
              isCurrentUser
                ? 'bg-[#B31B1B]/5 border border-[#B31B1B]/20'
                : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3 min-w-[3rem]">
              <span className="text-lg font-semibold w-8 text-center">
                {displayRank}
              </span>
            </div>

            <div className="flex-1 min-w-0 mx-3">
              <p className={`font-medium truncate ${
                isCurrentUser ? 'text-[#B31B1B]' : 'text-gray-900'
              }`}>
                {entry.full_name || 'Anonymous'}
                {isCurrentUser && (
                  <span className="ml-2 text-xs text-[#B31B1B] font-normal">(you)</span>
                )}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {entry.sport && `${entry.sport}`}
                {entry.sport && entry.graduation_year && ' • '}
                {entry.graduation_year && `'${entry.graduation_year.toString().slice(-2)}`}
              </p>
            </div>

            <div className="text-right min-w-[3rem]">
              <span className={`text-lg font-bold ${
                isCurrentUser ? 'text-[#B31B1B]' : 'text-gray-700'
              }`}>
                {entry.referral_count}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
