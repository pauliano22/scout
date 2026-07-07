'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, UserCheck, Check, X, Linkedin, Send } from 'lucide-react'

interface Claim {
  id: string
  full_name: string | null
  email: string | null
  sport: string | null
  graduation_year: number | null
  company: string | null
  role: string | null
  location: string | null
  linkedin_url: string | null
  claimed_by_user_id: string | null
  claimed_at: string | null
}

export default function AdminClaimsPage() {
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgResult, setTgResult] = useState<string | null>(null)

  const testTelegram = async () => {
    setTgTesting(true)
    setTgResult(null)
    try {
      const res = await fetch('/api/admin/telegram-test', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Test failed')
      const d = json.data
      if (d.sent) {
        setTgResult('✓ Sent — check your Telegram.')
      } else if (!d.hasToken || !d.hasChatId) {
        const missing = [!d.hasToken && 'TELEGRAM_BOT_TOKEN', !d.hasChatId && 'TELEGRAM_CHAT_ID']
          .filter(Boolean).join(' + ')
        setTgResult(`✗ The deployed app is missing ${missing}. Add it in Vercel (Production) and Redeploy.`)
      } else {
        setTgResult('✗ Env vars are present but the send failed — check the token/chat ID, or that you tapped Start on the bot.')
      }
    } catch (e: any) {
      setTgResult('✗ ' + e.message)
    } finally {
      setTgTesting(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/claims')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load claims')
      setClaims(json.data?.claims ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const act = async (id: string, action: 'approve' | 'reject') => {
    setActing(id)
    setError('')
    try {
      const res = await fetch('/api/admin/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumni_id: id, action }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Failed to ${action}`)
      setClaims((prev) => prev.filter((c) => c.id !== id))
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary]">Claims</h1>
          <p className="text-sm text-[--text-secondary] mt-1">
            Alumni profile claims whose name wasn&apos;t found on the roster — approve to
            publish the profile and grant the person directory access, or reject to keep it hidden.
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <button
            onClick={testTelegram}
            disabled={tgTesting}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[--bg-secondary] border border-[--border-primary] text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
          >
            {tgTesting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Test Telegram
          </button>
          {tgResult && (
            <p className={`text-xs mt-2 max-w-xs ${tgResult.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
              {tgResult}
            </p>
          )}
        </div>
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
      ) : claims.length === 0 ? (
        <div className="text-center py-16">
          <UserCheck size={32} className="mx-auto text-[--text-tertiary] mb-3" />
          <p className="text-sm text-[--text-tertiary]">No claims waiting for review</p>
          <p className="text-xs text-[--text-quaternary] mt-1">
            Claims that match the roster are auto-approved and never land here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-4 bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[--text-primary]">{c.full_name || '(no name)'}</span>
                  {c.linkedin_url && (
                    <a href={c.linkedin_url} target="_blank" rel="noopener noreferrer"
                       className="text-[--text-quaternary] hover:text-[#0077b5]">
                      <Linkedin size={14} />
                    </a>
                  )}
                </div>
                <p className="text-xs text-[--text-secondary] mt-0.5">{c.email || 'no email'}</p>
                <p className="text-xs text-[--text-tertiary] mt-1">
                  {[
                    c.sport,
                    c.graduation_year ? `'${String(c.graduation_year).slice(-2)}` : null,
                    c.role && c.company ? `${c.role} · ${c.company}` : c.role || c.company,
                    c.location,
                  ].filter(Boolean).join(' · ')}
                </p>
                <p className="text-[11px] text-[--text-quaternary] mt-1">
                  ⚠ not found on roster{c.claimed_at ? ` · submitted ${new Date(c.claimed_at).toLocaleDateString()}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => act(c.id, 'approve')}
                  disabled={acting === c.id}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {acting === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Approve
                </button>
                <button
                  onClick={() => act(c.id, 'reject')}
                  disabled={acting === c.id}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-[--bg-tertiary] text-[--text-secondary] hover:text-[--text-primary] disabled:opacity-50"
                >
                  <X size={13} />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
