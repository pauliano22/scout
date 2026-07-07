'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  GraduationCap,
  Flag,
  UserPlus,
  ChevronRight,
  BadgeCheck,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

interface Stats {
  totalUsers: number
  totalAlumni: number
  verifiedUsers: number
  flaggedContent: number
  recentSignups: { id: string; full_name: string | null; email: string; created_at: string }[]
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load stats')
        setStats(json.data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[--text-tertiary]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  if (!stats) return null

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers.toLocaleString(),
      icon: Users,
      color: 'bg-blue-500/10 text-blue-500',
      href: '/admin/users',
    },
    {
      label: 'Alumni',
      value: stats.totalAlumni.toLocaleString(),
      icon: GraduationCap,
      color: 'bg-emerald-500/10 text-emerald-500',
      href: '/admin/users?role=alumni',
    },
    {
      label: 'Verified',
      value: stats.verifiedUsers.toLocaleString(),
      icon: BadgeCheck,
      color: 'bg-purple-500/10 text-purple-500',
      href: '/admin/users?status=verified',
    },
    {
      label: 'Flagged Content',
      value: stats.flaggedContent.toLocaleString(),
      icon: Flag,
      color: 'bg-amber-500/10 text-amber-500',
      href: '/admin/reports',
    },
    {
      label: 'Sport Normalization',
      value: 'Manage',
      icon: ShieldCheck,
      color: 'bg-rose-500/10 text-rose-500',
      href: '/admin/sports',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Admin Dashboard</h1>
        <p className="text-sm text-[--text-secondary] mt-1">Overview of Scout platform activity</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 hover:border-[--border-hover] transition-colors group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[--text-secondary]">{card.label}</p>
                  <p className="text-3xl font-bold text-[--text-primary] mt-1">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${card.color}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-[--text-tertiary] group-hover:text-[--text-secondary] transition-colors">
                View details <ChevronRight size={12} />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Recent signups */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--border-primary]">
          <h2 className="text-sm font-semibold text-[--text-primary]">Recent Signups</h2>
          <Link
            href="/admin/users"
            className="text-xs text-[--school-primary] hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="divide-y divide-[--border-primary]">
          {stats.recentSignups.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[--text-tertiary]">No recent signups</p>
          ) : (
            stats.recentSignups.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[--bg-tertiary] flex items-center justify-center">
                    <UserPlus size={14} className="text-[--text-tertiary]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[--text-primary]">
                      {user.full_name || 'Unnamed User'}
                    </p>
                    <p className="text-xs text-[--text-tertiary]">{user.email}</p>
                  </div>
                </div>
                <span className="text-xs text-[--text-tertiary]">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
