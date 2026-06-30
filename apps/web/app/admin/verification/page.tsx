'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, ShieldCheck, CheckCircle, AlertTriangle, HelpCircle, Clock } from 'lucide-react'

interface AlumniBrief {
  id: string
  full_name: string
  email: string | null
  sport: string
  graduation_year: number
  company: string | null
  role: string | null
}

interface VerificationItem {
  id: string
  alumni_id: string
  reported_year: number
  roster_year: number | null
  match_status: 'verified' | 'mismatch' | 'unverified' | 'pending'
  reviewed: boolean
  flagged_at: string | null
  created_at: string
  updated_at: string
  alumni: AlumniBrief | null
}

interface VerificationsResponse {
  verifications: VerificationItem[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  verified: { label: 'Verified', icon: CheckCircle, color: 'bg-emerald-500/10 text-emerald-500' },
  mismatch: { label: 'Mismatch', icon: AlertTriangle, color: 'bg-red-500/10 text-red-500' },
  unverified: { label: 'Unverified', icon: HelpCircle, color: 'bg-amber-500/10 text-amber-500' },
  pending: { label: 'Pending', icon: Clock, color: 'bg-gray-500/10 text-gray-500' },
}

export default function AdminVerificationPage() {
  const [data, setData] = useState<VerificationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [acting, setActing] = useState<string | null>(null)

  const fetchVerifications = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (statusFilter) params.set('status', statusFilter)

      const res = await fetch(`/api/admin/verification?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load verifications')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page, statusFilter])

  useEffect(() => {
    fetchVerifications()
  }, [fetchVerifications])

  const handleMarkReviewed = async (id: string) => {
    setActing(id)
    try {
      const res = await fetch('/api/admin/verification', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to mark as reviewed')
      fetchVerifications()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const statusBadge = (status: string) => {
    const cfg = statusConfig[status]
    if (!cfg) return null
    const Icon = cfg.icon
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${cfg.color}`}>
        <Icon size={12} />
        {cfg.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Graduation Year Verification</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Cross-referenced alumni graduation years against Cornell Athletics roster data
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['', 'mismatch', 'verified', 'unverified', 'pending'].map((s) => {
          const label = s === '' ? 'All' : (statusConfig[s]?.label ?? s)
          return (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s)
                setPage(1)
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                statusFilter === s
                  ? 'bg-[--bg-active] text-[--text-primary] border border-[--border-primary]'
                  : 'bg-[--bg-secondary] text-[--text-secondary] border border-[--border-primary] hover:text-[--text-primary]'
              }`}
            >
              {label}
            </button>
          )
        })}
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

      {/* Items */}
      {!loading && data && (
        <>
          <div className="space-y-3">
            {data.verifications.length === 0 ? (
              <div className="text-center py-16">
                <ShieldCheck size={32} className="mx-auto text-[--text-tertiary] mb-3" />
                <p className="text-sm text-[--text-tertiary]">No verification records found</p>
                <p className="text-xs text-[--text-quaternary] mt-1">
                  {statusFilter
                    ? `No records with status &quot;${statusFilter}&quot;`
                    : 'Run the verification cron job to populate this table'}
                </p>
              </div>
            ) : (
              data.verifications.map((item) => (
                <div
                  key={item.id}
                  className={`bg-[--bg-secondary] border rounded-xl p-5 transition-colors ${
                    item.match_status === 'mismatch' && !item.reviewed
                      ? 'border-red-500/30'
                      : item.reviewed
                        ? 'border-[--border-primary] opacity-70'
                        : 'border-[--border-primary]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 mb-2">
                        {statusBadge(item.match_status)}
                        {item.reviewed && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                            Reviewed
                          </span>
                        )}
                        {item.flagged_at && (
                          <span className="text-xs text-[--text-tertiary]">
                            Flagged {new Date(item.flagged_at).toLocaleString()}
                          </span>
                        )}
                      </div>

                      {/* Alumni info */}
                      <p className="text-sm font-medium text-[--text-primary]">
                        {item.alumni?.full_name || 'Unknown'}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-[--text-secondary]">
                        <span>Sport: {item.alumni?.sport || '-'}</span>
                        {item.alumni?.email && <span>Email: {item.alumni.email}</span>}
                        {item.alumni?.company && <span>{item.alumni.company}</span>}
                        {item.alumni?.role && <span>{item.alumni.role}</span>}
                      </div>

                      {/* Year comparison */}
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <div>
                          <span className="text-[--text-tertiary] text-xs">Self-reported</span>
                          <p className="text-[--text-primary] font-semibold">{item.reported_year}</p>
                        </div>
                        <div className="text-[--text-tertiary]">→</div>
                        <div>
                          <span className="text-[--text-tertiary] text-xs">Roster</span>
                          <p className="text-[--text-primary] font-semibold">
                            {item.roster_year ?? (
                              <span className="text-[--text-tertiary] italic">N/A</span>
                            )}
                          </p>
                        </div>
                        {item.match_status === 'mismatch' && item.roster_year != null && (
                          <div className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs font-medium rounded">
                            Gap: {Math.abs(item.reported_year - item.roster_year)}yr
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    {!item.reviewed && (
                      <button
                        onClick={() => handleMarkReviewed(item.id)}
                        disabled={acting === item.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      >
                        {acting === item.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        Mark Reviewed
                      </button>
                    )}
                  </div>
                </div>
              ))
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
