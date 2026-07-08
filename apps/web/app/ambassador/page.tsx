'use client'

import { useCallback, useEffect, useState } from 'react'
import { Award, Shield, Star, Users, Target, Sparkles, Loader2 } from 'lucide-react'
import VarsityBadge from '@/components/VarsityBadge'
import type { AmbassadorTier, AmbassadorBadgeType, AmbassadorProfile } from '@scout/shared/types/database'

interface AmbStatus {
  ambassador: AmbassadorProfile | null
}

interface LeaderboardEntry {
  id: string
  full_name: string
  avatar_url: string | null
  sport: string
  tier: AmbassadorTier
  badge_type: AmbassadorBadgeType
  recruits_count: number
}

const TIER_INFO: { tier: AmbassadorTier; label: string; recruits: string; perks: string[] }[] = [
  { tier: 'bronze', label: 'Bronze Ambassador', recruits: '1+ recruit', perks: ['Varsity badge on profile', 'Early feature access'] },
  { tier: 'silver', label: 'Silver Ambassador', recruits: '3+ recruits', perks: ['All bronze perks', 'Exclusive Slack channel', 'Monthly ambassador calls'] },
  { tier: 'gold', label: 'Gold Ambassador', recruits: '5+ recruits', perks: ['All silver perks', 'Scout merch package', 'Priority support'] },
  { tier: 'platinum', label: 'Platinum Ambassador', recruits: '10+ recruits', perks: ['All gold perks', 'Board seat in alumni council', 'Featured in newsletter'] },
]

const SPORTS = [
  'Basketball', 'Soccer', 'Football', 'Lacrosse', 'Tennis', 'Swimming',
  'Baseball', 'Volleyball', 'Hockey', 'Track & Field', 'Rowing', 'Wrestling',
  'Golf', 'Field Hockey', 'Cross Country', 'Fencing', 'Gymnastics',
]

export default function AmbassadorDashboard() {
  const [status, setStatus] = useState<AmbStatus | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [applying, setApplying] = useState(false)
  const [applySport, setApplySport] = useState('')
  const [applyError, setApplyError] = useState('')
  const [applySuccess, setApplySuccess] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [statusRes, leaderRes] = await Promise.all([
        fetch('/api/ambassador/status'),
        fetch('/api/ambassador/leaderboard?limit=20'),
      ])
      if (statusRes.ok) {
        const data = await statusRes.json()
        setStatus(data)
      }
      if (leaderRes.ok) {
        const data = await leaderRes.json()
        setLeaderboard(data.ambassadors || [])
      }
    } catch (err) {
      console.error('Failed to load ambassador data:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleApply = async () => {
    setApplyError('')
    setApplySuccess(false)
    if (!applySport) {
      setApplyError('Please select a sport.')
      return
    }
    setApplying(true)
    try {
      const res = await fetch('/api/ambassador/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport: applySport }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApplyError(data.error || 'Application failed.')
        return
      }
      setApplySuccess(true)
      setApplySport('')
      await fetchData()
    } catch (err: any) {
      setApplyError(err.message || 'Something went wrong.')
    } finally {
      setApplying(false)
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 py-12">
        <div className="w-full max-w-4xl mx-auto flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-[--text-quaternary]" />
        </div>
      </main>
    )
  }

  const ambassador = status?.ambassador

  return (
    <main className="min-h-screen px-4 py-12">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">Ambassador Program</h1>
          <p className="text-[--text-secondary] mt-2 max-w-xl">
            Represent your sport, recruit your teammates, and earn exclusive perks.
            The most active alumni per sport get verified Varsity badges on their profile.
          </p>
        </div>

        {/* Current ambassador status or apply card */}
        {ambassador ? (
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 md:p-8 mb-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-semibold">Your Ambassador Status</h2>
                  {ambassador.is_active ? (
                    <span className="inline-flex items-center gap-1 text-xs bg-green-900/30 text-green-300 border border-green-600/40 rounded-full px-2 py-0.5">
                      <Sparkles size={10} />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs bg-amber-900/30 text-amber-300 border border-amber-600/40 rounded-full px-2 py-0.5">
                      Pending Review
                    </span>
                  )}
                </div>
                <VarsityBadge
                  sport={ambassador.sport}
                  tier={ambassador.tier as AmbassadorTier}
                  badgeType={ambassador.badge_type as AmbassadorBadgeType}
                  size="lg"
                />
              </div>
            </div>

            {/* Activity metrics */}
            <div className="mt-6 pt-6 border-t border-[--border-primary] grid grid-cols-3 gap-4">
              <MetricCard icon={Users} label="Recruits" value={ambassador.recruits_count} />
              <MetricCard icon={Target} label="Mentorship Hours" value={ambassador.mentorship_hours} />
              <MetricCard icon={Award} label="Referrals" value={ambassador.referrals_count} />
            </div>

            {/* Next tier progress */}
            {ambassador.is_active && (
              <div className="mt-6 pt-6 border-t border-[--border-primary]">
                <h3 className="text-sm font-semibold text-[--text-quaternary] uppercase tracking-wide mb-3">
                  Next Tier Progress
                </h3>
                <TierProgress currentTier={ambassador.tier as AmbassadorTier} recruits={ambassador.recruits_count} />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 md:p-8 mb-6">
            <h2 className="text-lg font-semibold mb-1">Become an Ambassador</h2>
            <p className="text-sm text-[--text-secondary] mb-5">
              Apply to represent your sport and earn a verified Varsity badge on your profile.
            </p>

            {applySuccess ? (
              <div className="bg-green-900/30 border border-green-600/40 rounded-xl p-4 text-sm text-green-300">
                Your application has been submitted! An admin will review it soon.
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs text-[--text-quaternary] uppercase tracking-wide mb-1.5">
                    Select your sport
                  </label>
                  <select
                    value={applySport}
                    onChange={(e) => setApplySport(e.target.value)}
                    className="w-full bg-[--bg-tertiary] border border-[--border-primary] rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="">Choose a sport...</option>
                    {SPORTS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleApply}
                  disabled={applying || !applySport}
                  className="btn-primary flex items-center gap-2 px-5 py-2 text-sm shrink-0"
                >
                  {applying ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Shield size={14} />
                      Apply Now
                    </>
                  )}
                </button>
              </div>
            )}

            {applyError && (
              <p className="mt-3 text-xs text-red-400">{applyError}</p>
            )}
          </div>
        )}

        {/* Tiers overview */}
        <section className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Tiers &amp; Perks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {TIER_INFO.map((t) => {
              const IconComponent = t.tier === 'bronze' ? Shield : t.tier === 'silver' ? Shield : t.tier === 'gold' ? Star : Award
              return (
                <div
                  key={t.tier}
                  className={`bg-[--bg-secondary] border rounded-xl p-4 ${
                    ambassador?.tier === t.tier
                      ? 'border-[--school-primary] ring-1 ring-[--school-primary]/30'
                      : 'border-[--border-primary]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <IconComponent size={16} className="text-[--school-primary]" />
                    <h3 className="font-semibold capitalize">{t.tier}</h3>
                  </div>
                  <p className="text-xs text-[--text-quaternary] mb-2">{t.recruits}</p>
                  <ul className="space-y-1">
                    {t.perks.map((perk, i) => (
                      <li key={i} className="text-xs text-[--text-secondary] flex items-start gap-1.5">
                        <Sparkles size={10} className="shrink-0 mt-0.5 text-[--school-primary]" />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Leaderboard */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Ambassador Leaderboard</h2>
          {leaderboard.length === 0 ? (
            <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 text-center">
              <Users size={28} className="mx-auto text-[--text-quaternary] mb-2" />
              <p className="text-sm text-[--text-tertiary]">No active ambassadors yet. Be the first!</p>
            </div>
          ) : (
            <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[--border-primary] text-xs text-[--text-quaternary] uppercase tracking-wider">
                    <th className="text-left px-4 py-3 font-medium">#</th>
                    <th className="text-left px-4 py-3 font-medium">Ambassador</th>
                    <th className="text-left px-4 py-3 font-medium">Sport</th>
                    <th className="text-left px-4 py-3 font-medium">Badge</th>
                    <th className="text-right px-4 py-3 font-medium">Recruits</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr key={entry.id} className="border-b border-[--border-primary]/50 last:border-0">
                      <td className="px-4 py-3 text-[--text-quaternary]">{i + 1}</td>
                      <td className="px-4 py-3 font-medium">{entry.full_name || 'Anonymous'}</td>
                      <td className="px-4 py-3 text-[--text-secondary]">{entry.sport}</td>
                      <td className="px-4 py-3">
                        <VarsityBadge
                          sport={entry.sport}
                          tier={entry.tier}
                          badgeType={entry.badge_type}
                          size="sm"
                          showLabel={false}
                        />
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">{entry.recruits_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users
  label: string
  value: number
}) {
  return (
    <div className="text-center">
      <Icon size={18} className="mx-auto text-[--school-primary] mb-1" />
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-xs text-[--text-quaternary]">{label}</p>
    </div>
  )
}

function TierProgress({ currentTier, recruits }: { currentTier: AmbassadorTier; recruits: number }) {
  const tierOrder: AmbassadorTier[] = ['bronze', 'silver', 'gold', 'platinum']
  const currentIndex = tierOrder.indexOf(currentTier)
  const nextTier = currentIndex < tierOrder.length - 1 ? tierOrder[currentIndex + 1] : null
  const nextThreshold = nextTier ? [1, 3, 5, 10][currentIndex + 1] : null

  if (!nextTier || nextThreshold === null) {
    return <p className="text-sm text-[--school-primary]">Maximum tier reached! 🎉</p>
  }

  const progress = Math.min((recruits / nextThreshold) * 100, 100)

  return (
    <div>
      <div className="flex justify-between text-xs text-[--text-secondary] mb-1">
        <span>{currentTier.charAt(0).toUpperCase() + currentTier.slice(1)}</span>
        <span>{nextTier.charAt(0).toUpperCase() + nextTier.slice(1)} ({nextThreshold} recruits)</span>
      </div>
      <div className="w-full h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[--school-primary] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-xs text-[--text-tertiary] mt-1">
        {recruits} / {nextThreshold} recruits, {nextThreshold - recruits} more to go
      </p>
    </div>
  )
}
