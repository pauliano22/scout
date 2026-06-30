'use client'

import { useEffect, useMemo, useState } from 'react'
import { Sparkles, Bookmark, SkipForward, PenLine, Send, Loader2, Download } from 'lucide-react'

interface UserRow {
  userId: string
  email: string
  name: string
  role: string
  suggested: number
  saved: number
  skipped: number
  generated: number
  sent: number
  events: number
  lastActiveAt: string | null
}
interface Metrics {
  totals: {
    users: number; activeUsers: number; suggested: number; saved: number
    skipped: number; generated: number; sent: number; events: number
  }
  users: UserRow[]
  generatedAt: string
}

const COLS: { key: keyof UserRow; label: string }[] = [
  { key: 'suggested', label: 'Suggested' },
  { key: 'saved', label: 'Saved' },
  { key: 'skipped', label: 'Skipped' },
  { key: 'generated', label: 'Generated' },
  { key: 'sent', label: 'Sent' },
  { key: 'events', label: 'Events' },
]

export default function AdminDataPage() {
  const [data, setData] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sort, setSort] = useState<keyof UserRow>('lastActiveAt')

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/metrics')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load metrics')
        setData(json.data)
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const rows = useMemo(() => {
    if (!data) return []
    const r = [...data.users]
    r.sort((a, b) => {
      if (sort === 'lastActiveAt') return (b.lastActiveAt ?? '').localeCompare(a.lastActiveAt ?? '')
      if (sort === 'name' || sort === 'email' || sort === 'role') return String(a[sort]).localeCompare(String(b[sort]))
      return (b[sort] as number) - (a[sort] as number)
    })
    return r
  }, [data, sort])

  const exportCsv = () => {
    if (!data) return
    const head = ['Name', 'Email', 'Role', ...COLS.map(c => c.label), 'Last active']
    const lines = rows.map(u => [
      u.name, u.email, u.role, u.suggested, u.saved, u.skipped, u.generated, u.sent, u.events,
      u.lastActiveAt ?? '',
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    const blob = new Blob([[head.join(','), ...lines].join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `scout-user-metrics.csv`
    a.click()
  }

  if (loading) {
    return <div className="flex items-center justify-center py-32"><Loader2 size={32} className="animate-spin text-[--text-tertiary]" /></div>
  }
  if (error) {
    return <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">{error}</div>
  }
  if (!data) return null

  const cards = [
    { label: 'Suggested', value: data.totals.suggested, icon: Sparkles, color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Saved', value: data.totals.saved, icon: Bookmark, color: 'bg-emerald-500/10 text-emerald-500' },
    { label: 'Skipped', value: data.totals.skipped, icon: SkipForward, color: 'bg-zinc-500/10 text-zinc-500' },
    { label: 'Generated', value: data.totals.generated, icon: PenLine, color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Sent', value: data.totals.sent, icon: Send, color: 'bg-purple-500/10 text-purple-500' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary]">User Data</h1>
          <p className="text-sm text-[--text-secondary] mt-1">
            Per-user activity across Scout · {data.totals.activeUsers} of {data.totals.users} users active
          </p>
        </div>
        <button onClick={exportCsv} className="btn-secondary text-sm flex items-center gap-2">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-[--text-secondary]">{c.label}</p>
                  <p className="text-3xl font-bold text-[--text-primary] mt-1">{c.value.toLocaleString()}</p>
                </div>
                <div className={`p-2.5 rounded-lg ${c.color}`}><Icon size={20} /></div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-user table */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[--border-primary]">
          <h2 className="text-sm font-semibold text-[--text-primary]">Per-user breakdown</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[--text-tertiary] border-b border-[--border-primary]">
                <th className="px-5 py-2.5 font-medium cursor-pointer" onClick={() => setSort('name')}>User</th>
                {COLS.map(c => (
                  <th key={c.key} className="px-3 py-2.5 font-medium text-right cursor-pointer whitespace-nowrap hover:text-[--text-secondary]" onClick={() => setSort(c.key)}>
                    {c.label}
                  </th>
                ))}
                <th className="px-5 py-2.5 font-medium text-right cursor-pointer whitespace-nowrap" onClick={() => setSort('lastActiveAt')}>Last active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[--border-primary]">
              {rows.map(u => (
                <tr key={u.userId} className="hover:bg-[--bg-tertiary]/40">
                  <td className="px-5 py-3">
                    <div className="font-medium text-[--text-primary]">{u.name || 'Unnamed'}</div>
                    <div className="text-xs text-[--text-tertiary]">{u.email}{u.role !== 'student' ? ` · ${u.role}` : ''}</div>
                  </td>
                  {COLS.map(c => (
                    <td key={c.key} className="px-3 py-3 text-right tabular-nums text-[--text-secondary]">
                      {(u[c.key] as number) || <span className="text-[--text-quaternary]">0</span>}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right text-xs text-[--text-tertiary] whitespace-nowrap">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-[--text-quaternary]">
        Suggested = agent picks · Saved = network adds · Skipped = dismissed/passed · Generated = drafts written ·
        Sent = messages sent · Events = tracked interactions. Snapshot {new Date(data.generatedAt).toLocaleString()}.
      </p>
    </div>
  )
}
