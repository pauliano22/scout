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
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-[--text-secondary] text-sm mt-1">
          Overview of the Scout platform
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 hover:bg-[--bg-hover] transition-colors group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.color}`}>
                  <Icon size={20} />
                </div>
                <ChevronRight
                  size={16}
                  className="text-[--text-quaternary] group-hover:text-[--text-secondary] transition-colors"
                />
              </div>
              <p className="text-2xl font-semibold">{card.value}</p>
              <p className="text-sm text-[--text-tertiary] mt-0.5">{card.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Signups */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[--border-primary]">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-[--text-tertiary]" />
              <h2 className="text-sm font-medium">Recent Signups</h2>
            </div>
            <Link
              href="/admin/users"
              className="text-xs text-[--school-primary] hover:underline"
            >
              View all
            </Link>
          </div>
          {stats.recentSignups.length === 0 ? (
            <p className="text-sm text-[--text-tertiary] px-5 py-8 text-center">
              No recent signups
            </p>
          ) : (
            <div className="divide-y divide-[--border-primary]">
              {stats.recentSignups.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {user.full_name || 'Unnamed'}
                    </p>
                    <p className="text-xs text-[--text-tertiary]">{user.email}</p>
                  </div>
                  <span className="text-xs text-[--text-quaternary]">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <h2 className="text-sm font-medium mb-4">Quick Links</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <QuickLink href="/admin/users" label="User Moderation" desc="Manage users, verify accounts" />
            <QuickLink href="/admin/reports" label="Flagged Content" desc="Review and resolve reports" />
            <QuickLink href="/admin/activity" label="Activity Log" desc="Audit all user actions" />
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickLink({
  href,
  label,
  desc,
}: {
  href: string
  label: string
  desc: string
}) {
  return (
    <Link
      href={href}
      className="block p-3 rounded-lg border border-[--border-primary] hover:bg-[--bg-hover] transition-colors"
    >
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-[--text-tertiary] mt-0.5">{desc}</p>
    </Link>
  )
}
