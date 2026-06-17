'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Flag, CheckCircle, Trash2 } from 'lucide-react'

interface Report {
  id: string
  user_id: string
  content_type: string
  content_id: string
  reason: string
  status: string
  created_at: string
  resolved_at: string | null
  resolved_by: string | null
  profiles: { full_name: string | null; email: string } | null
}

interface ReportsResponse {
  reports: Report[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function AdminReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [acting, setActing] = useState<string | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('status', 'flagged')

      const res = await fetch(`/api/admin/reports?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load reports')
      setData(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const handleDismiss = async (id: string) => {
    setActing(id)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to dismiss report')
      fetchReports()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const handleRemove = async (id: string) => {
    setActing(id)
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'removed' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to resolve report')
      fetchReports()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const contentTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      message: 'bg-blue-500/10 text-blue-500',
      profile: 'bg-purple-500/10 text-purple-500',
      alumni: 'bg-emerald-500/10 text-emerald-500',
    }
    return (
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colors[type] || 'bg-gray-500/10 text-gray-500'}`}>
        {type}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Flagged Content</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Review and moderate reported content from users
        </p>
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

      {/* Reports */}
      {!loading && data && (
        <>
          <div className="space-y-3">
            {data.reports.length === 0 ? (
              <div className="text-center py-16">
                <Flag size={32} className="mx-auto text-[--text-tertiary] mb-3" />
                <p className="text-sm text-[--text-tertiary]">No flagged content</p>
                <p className="text-xs text-[--text-quaternary] mt-1">All reports have been reviewed</p>
              </div>
            ) : (
              data.reports.map((report) => (
                <div
                  key={report.id}
                  className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {contentTypeBadge(report.content_type)}
                        <span className="text-xs text-[--text-tertiary]">
                          ID: {report.content_id.slice(0, 8)}...
                        </span>
                        <span className="text-xs text-[--text-tertiary]">
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm text-[--text-primary] mb-1">
                        Reported by{' '}
                        <span className="font-medium">
                          {report.profiles?.full_name || report.profiles?.email || 'Unknown'}
                        </span>
                      </p>

                      {report.reason && (
                        <p className="text-sm text-[--text-secondary] bg-[--bg-tertiary] rounded-lg p-3 mt-2">
                          &ldquo;{report.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDismiss(report.id)}
                        disabled={acting === report.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {acting === report.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle size={12} />
                        )}
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleRemove(report.id)}
                        disabled={acting === report.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {acting === report.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Remove
                      </button>
                    </div>
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
