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
      if (!res.ok) throw new Error(json.error || 'Failed to dismiss')
      await fetchReports()
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
      if (!res.ok) throw new Error(json.error || 'Failed to remove')
      await fetchReports()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Flagged Content</h1>
        <p className="text-[--text-secondary] text-sm mt-1">
          Review and resolve reported content
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {data && data.reports.length === 0 ? (
        <div className="text-center py-20 bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={24} className="text-emerald-500" />
          </div>
          <p className="text-[--text-secondary] font-medium">No flagged content</p>
          <p className="text-[--text-tertiary] text-sm mt-1">
            All reports have been resolved
          </p>
        </div>
      ) : data ? (
        <>
          <div className="space-y-3">
            {data.reports.map((report) => (
              <div
                key={report.id}
                className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Flag size={14} className="text-amber-500 flex-shrink-0" />
                      <span className="text-sm font-medium capitalize">
                        {report.content_type} report
                      </span>
                      <span className="text-xs text-[--text-quaternary]">
                        #{report.content_id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm text-[--text-secondary] mt-1">
                      {report.reason || 'No reason provided'}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-[--text-tertiary]">
                      <span>
                        Reported by{' '}
                        {report.profiles?.full_name || report.profiles?.email || 'Unknown'}
                      </span>
                      <span>{new Date(report.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {acting === report.id ? (
                      <Loader2 size={16} className="animate-spin text-[--text-tertiary]" />
                    ) : (
                      <>
                        <button
                          onClick={() => handleDismiss(report.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-hover] transition-colors"
                        >
                          <CheckCircle size={13} />
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleRemove(report.id)}
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-[--text-tertiary]">
                Showing {data.reports.length} of {data.total} reports
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
