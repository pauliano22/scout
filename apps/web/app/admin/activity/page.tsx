'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2,
  Activity as ActivityIcon,
  UserPlus,
  LogIn,
  UserCheck,
  ShieldAlert,
  Flag,
} from 'lucide-react'

interface ActivityEntry {
  id: string
  user_id: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
  profiles: { full_name: string | null; email: string } | null
}

interface ActivityResponse {
  entries: ActivityEntry[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const actionConfig: Record<
  string,
  { label: string; icon: React.ElementType; color: string }
> = {
  signup: {
    label: 'Signup',
    icon: UserPlus,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  login: {
    label: 'Login',
    icon: LogIn,
    color: 'text-blue-500 bg-blue-500/10',
  },
  account_verified: {
    label: 'Verified',
    icon: UserCheck,
    color: 'text-purple-500 bg-purple-500/10',
  },
  account_unverified: {
    label: 'Unverified',
    icon: ShieldAlert,
    color: 'text-amber-500 bg-amber-500/10',
  },
  report_dismissed: {
    label: 'Report Dismissed',
    icon: Flag,
    color: 'text-slate-500 bg-slate-500/10',
  },
  report_removed: {
    label: 'Content Removed',
    icon: Flag,
    color: 'text-red-500 bg-red-500/10',
  },
  profile_update: {
    label: 'Profile Updated',
    icon: ActivityIcon,
    color: 'text-cyan-500 bg-cyan-500/10',
  },
  role_changed_to_student: {
    label: 'Role → Student',
    icon: ShieldAlert,
    color: 'text-blue-500 bg-blue-500/10',
  },
  role_changed_to_alumni: {
    label: 'Role → Alumni',
    icon: ShieldAlert,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  role_changed_to_admin: {
    label: 'Role → Admin',
    icon: ShieldAlert,
    color: 'text-purple-500 bg-purple-500/10',
  },
  alumni_status_enabled: {
    label: 'Alumni Status Enabled',
    icon: UserCheck,
    color: 'text-emerald-500 bg-emerald-500/10',
  },
  alumni_status_disabled: {
    label: 'Alumni Status Disabled',
    icon: ShieldAlert,
    color: 'text-amber-500 bg-amber-500/10',
  },
}

function getActionConfig(action: string) {
  return actionConfig[action] || {
    label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: ActivityIcon,
    color: 'text-gray-500 bg-gray-500/10',
  }
}

export default function AdminActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)
      params.set('page', String(page))

      const res = await fetch(`/api/admin/activity?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load activity')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [actionFilter, page])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return d.toLocaleDateString()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Activity Log</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Audit trail of user signups, logins, profile changes, and admin actions
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="px-3 py-2 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] focus:outline-none focus:border-[--school-primary]"
        >
          <option value="">All Actions</option>
          <option value="signup">Signups</option>
          <option value="login">Logins</option>
          <option value="profile_update">Profile Updates</option>
          <option value="account_verified">Verifications</option>
        </select>
        {data && (
          <span className="text-xs text-[--text-tertiary]">
            {data.total} total entries
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      )}

      {/* Activity entries */}
      {!loading && data && (
        <>
          <div className="space-y-2">
            {data.entries.length === 0 ? (
              <div className="text-center py-16">
                <ActivityIcon size={32} className="mx-auto text-[--text-tertiary] mb-3" />
                <p className="text-sm text-[--text-tertiary]">No activity entries found</p>
              </div>
            ) : (
              data.entries.map((entry) => {
                const cfg = getActionConfig(entry.action)
                const Icon = cfg.icon
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 bg-[--bg-secondary] border border-[--border-primary] rounded-lg p-4"
                  >
                    <div className={`p-2 rounded-lg ${cfg.color} flex-shrink-0`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[--text-primary]">
                          {entry.profiles?.full_name || entry.profiles?.email || 'Unknown User'}
                        </span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                        <p className="text-xs text-[--text-tertiary] mt-0.5 font-mono truncate">
                          {JSON.stringify(entry.metadata)}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-[--text-tertiary] flex-shrink-0">
                      {formatTime(entry.created_at)}
                    </span>
                  </div>
                )
              })
            )}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-sm text-[--text-tertiary]">
                Page {page} of {data.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
