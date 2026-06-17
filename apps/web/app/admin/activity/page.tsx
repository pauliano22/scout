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
}

function getActionConfig(action: string) {
  if (actionConfig[action]) return actionConfig[action]
  if (action.startsWith('role_changed_to_')) {
    return {
      label: `Role → ${action.replace('role_changed_to_', '')}`,
      icon: ShieldAlert,
      color: 'text-orange-500 bg-orange-500/10',
    }
  }
  if (action.startsWith('alumni_status_')) {
    return {
      label: `Alumni ${action.replace('alumni_status_', '')}`,
      icon: UserCheck,
      color: 'text-emerald-500 bg-emerald-500/10',
    }
  }
  return {
    label: action.replace(/_/g, ' '),
    icon: ActivityIcon,
    color: 'text-[--text-tertiary] bg-[--bg-tertiary]',
  }
}

export default function AdminActivityPage() {
  const [data, setData] = useState<ActivityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')

  const fetchActivity = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      if (actionFilter) params.set('action', actionFilter)

      const res = await fetch(`/api/admin/activity?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load activity')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, actionFilter])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  // Compute unique action types for filter
  const actionTypes = data?.entries
    ? [...new Set(data.entries.map((e) => e.action))]
    : []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Activity Log</h1>
        <p className="text-[--text-secondary] text-sm mt-1">
          Chronological audit of all user activity
        </p>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value)
            setPage(1)
          }}
          className="input-field w-auto min-w-[180px]"
        >
          <option value="">All Actions</option>
          {actionTypes.map((action) => (
            <option key={action} value={action}>
              {getActionConfig(action).label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      ) : data && data.entries.length === 0 ? (
        <div className="text-center py-20 text-[--text-tertiary]">
          <ActivityIcon size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No activity recorded yet</p>
        </div>
      ) : data ? (
        <>
          {/* Timeline */}
          <div className="space-y-2">
            {data.entries.map((entry) => {
              const config = getActionConfig(entry.action)
              const Icon = config.icon
              return (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.color}`}
                  >
                    <Icon size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {config.label}
                    </p>
                    <p className="text-xs text-[--text-tertiary] mt-0.5">
                      {entry.profiles?.full_name || entry.profiles?.email || 'Unknown user'}
                    </p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <p className="text-xs text-[--text-quaternary] mt-1 font-mono">
                        {JSON.stringify(entry.metadata).slice(0, 120)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-[--text-quaternary] flex-shrink-0 whitespace-nowrap">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-[--text-tertiary]">
                Showing {data.entries.length} of {data.total} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-md bg-[--bg-secondary] border border-[--border-primary] text-sm hover:bg-[--bg-hover] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-[--text-tertiary] px-2">
                  Page {page} of {data.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="px-3 py-1.5 rounded-md bg-[--bg-secondary] border border-[--border-primary] text-sm hover:bg-[--bg-hover] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
