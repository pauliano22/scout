'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserX, EyeOff, Trash2, Linkedin, MailCheck, ShieldAlert } from 'lucide-react'

interface LinkedAlumni {
  id: string
  full_name: string | null
  email: string | null
  linkedin_url: string | null
  is_public: boolean
  claimed_by_user_id: string | null
}

interface RemovalRequest {
  id: string
  alumni_id: string | null
  submitted_name: string
  submitted_email: string | null
  submitted_linkedin: string | null
  reason: string | null
  matched: boolean
  status: 'pending' | 'actioned' | 'rejected'
  verified: boolean
  verified_at: string | null
  created_at: string
  actioned_at: string | null
  alumni: LinkedAlumni | LinkedAlumni[] | null
}

function linkedRow(r: RemovalRequest): LinkedAlumni | null {
  if (!r.alumni) return null
  return Array.isArray(r.alumni) ? r.alumni[0] ?? null : r.alumni
}

export default function AdminRemovalsPage() {
  const [requests, setRequests] = useState<RemovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/removals')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load removal requests')
      setRequests(json.data?.requests ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'hide' | 'hard_delete') => {
    if (action === 'hard_delete' && !window.confirm(
      'Hard delete permanently removes the alumni row and suppresses the email/LinkedIn from all future imports. This cannot be undone. Continue?'
    )) return
    setActing(id)
    setError('')
    try {
      const res = await fetch('/api/admin/removals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ request_id: id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to ${action}`)
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const statusBadge = (r: RemovalRequest) => {
    if (r.status === 'actioned') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">actioned</span>
    if (r.status === 'rejected') return <span className="text-[11px] px-2 py-0.5 rounded-full bg-[--bg-tertiary] text-[--text-tertiary]">rejected</span>
    return <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400">pending</span>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Removals</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Alumni data-removal requests from /remove. Hide is reversible (is_public = false).
          Hard delete removes the row permanently and suppresses the person from future imports
          and enrichment.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <UserX size={32} className="mx-auto text-[--text-tertiary] mb-3" />
          <p className="text-sm text-[--text-tertiary]">No removal requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => {
            const alum = linkedRow(r)
            const claimed = Boolean(alum?.claimed_by_user_id)
            return (
              <div
                key={r.id}
                className="flex items-start justify-between gap-4 bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-[--text-primary]">{r.submitted_name}</span>
                    {r.submitted_linkedin && (
                      <a href={r.submitted_linkedin} target="_blank" rel="noopener noreferrer"
                         className="text-[--text-quaternary] hover:text-[#0077b5]">
                        <Linkedin size={14} />
                      </a>
                    )}
                    {statusBadge(r)}
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                        <MailCheck size={11} /> email verified
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[--text-secondary] mt-0.5">
                    {r.submitted_email || 'no email submitted'}
                  </p>
                  <p className="text-xs text-[--text-tertiary] mt-1">
                    {alum
                      ? `Matched: ${alum.full_name ?? alum.id} · ${alum.is_public ? 'still public' : 'hidden'}`
                      : r.matched ? 'Matched a row (since deleted or merged)' : 'No directory match'}
                    {' · '}submitted {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  {r.reason && (
                    <p className="text-xs text-[--text-quaternary] mt-1 line-clamp-2">&ldquo;{r.reason}&rdquo;</p>
                  )}
                  {claimed && (
                    <p className="inline-flex items-center gap-1 text-[11px] text-amber-400 mt-1">
                      <ShieldAlert size={11} /> claimed by a live account — purge the user before hard deleting
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => act(r.id, 'hide')}
                    disabled={acting === r.id}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
                  >
                    {acting === r.id ? <Loader2 size={13} className="animate-spin" /> : <EyeOff size={13} />}
                    Hide
                  </button>
                  <button
                    onClick={() => act(r.id, 'hard_delete')}
                    disabled={acting === r.id || claimed}
                    title={claimed ? 'Purge the linked user first (/api/admin/users/purge)' : undefined}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 size={13} />
                    Hard delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
