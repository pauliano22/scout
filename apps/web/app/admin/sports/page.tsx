'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Shield,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Hash,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────

interface NormalizedSport {
  canonicalName: string
  aliasCount: number
  aliases: string[]
  category: string
  contactType: string
  level: string
}

interface UnmappedItem {
  value: string
  locations: string[]
}

interface NormalizeResult {
  processed: number
  updated: number
  unmapped: UnmappedItem[]
  tables: { table: string; column: string; updated: number; unmappedCount: number }[]
  elapsedMs: number
}

// ── Component ──────────────────────────────────────────────────────────

export default function AdminSportsPage() {
  const [sports, setSports] = useState<NormalizedSport[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [runResult, setRunResult] = useState<NormalizeResult | null>(null)
  const [running, setRunning] = useState(false)
  const [showUnmapped, setShowUnmapped] = useState(false)

  const fetchSports = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/sports/normalized')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load sports')
      setSports(json.data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSports()
  }, [])

  const handleRunNormalization = async () => {
    setRunning(true)
    setRunResult(null)
    try {
      const res = await fetch('/api/cron/normalize-sports', {
        headers: {
          'x-cron-secret': 'triggered-from-admin',
        },
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Normalization failed')
      setRunResult(json)
      // Refresh the sport list
      fetchSports()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Run failed')
    } finally {
      setRunning(false)
    }
  }

  // ── Loading State ──────────────────────────────────────────────────
  if (loading && !sports) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={32} className="animate-spin text-[--text-tertiary]" />
      </div>
    )
  }

  // ── Error State ─────────────────────────────────────────────────────
  if (error && !sports) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
        {error}
      </div>
    )
  }

  const totalAliases = sports?.reduce((s, sp) => s + sp.aliasCount, 0) ?? 0
  const teamCount = sports?.filter((s) => s.category === 'team').length ?? 0
  const individualCount = sports?.filter((s) => s.category === 'individual').length ?? 0
  const contactCount = sports?.filter((s) => s.contactType === 'contact').length ?? 0
  const nonContactCount = sports?.filter((s) => s.contactType === 'non-contact').length ?? 0

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-[--text-tertiary] mb-1">
            <Link href="/admin" className="hover:text-[--text-secondary] transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span>Sports</span>
          </div>
          <h1 className="text-2xl font-bold text-[--text-primary]">Sport Name Normalization</h1>
          <p className="text-sm text-[--text-secondary] mt-1">
            Canonical sport entries with alias resolution for Cornell athletics
          </p>
        </div>
        <button
          onClick={handleRunNormalization}
          disabled={running}
          className="flex items-center gap-2 bg-[--school-primary] hover:bg-[--school-primary-hover] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} className={running ? 'animate-spin' : ''} />
          {running ? 'Running...' : 'Run Normalization'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[--text-secondary] mb-1">
            <Hash size={14} />
            Canonical Sports
          </div>
          <p className="text-2xl font-bold text-[--text-primary]">{sports?.length ?? 0}</p>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[--text-secondary] mb-1">
            <Hash size={14} />
            Known Aliases
          </div>
          <p className="text-2xl font-bold text-[--text-primary]">{totalAliases}</p>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[--text-secondary] mb-1">
            <Shield size={14} />
            Team Sports
          </div>
          <p className="text-2xl font-bold text-[--text-primary]">{teamCount}</p>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[--text-secondary] mb-1">
            <Shield size={14} />
            Individual Sports
          </div>
          <p className="text-2xl font-bold text-[--text-primary]">{individualCount}</p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Contact Type</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span className="text-sm text-[--text-secondary]">Contact: {contactCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="text-sm text-[--text-secondary]">Non-Contact: {nonContactCount}</span>
            </div>
          </div>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[--text-primary] mb-3">By Category</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-sm text-[--text-secondary]">Team: {teamCount}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-sm text-[--text-secondary]">Individual: {individualCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Run Result */}
      {runResult && (
        <div className={`rounded-xl border p-4 ${
          runResult.unmapped.length > 0
            ? 'bg-amber-500/5 border-amber-500/30'
            : 'bg-emerald-500/5 border-emerald-500/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {runResult.unmapped.length > 0 ? (
              <AlertTriangle size={16} className="text-amber-400" />
            ) : (
              <CheckCircle size={16} className="text-emerald-400" />
            )}
            <span className="text-sm font-medium text-[--text-primary]">
              Normalization completed in {(runResult.elapsedMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="text-sm text-[--text-secondary] space-y-1">
            <p>Processed: {runResult.processed} records across {runResult.tables.length} tables</p>
            <p>Updated: {runResult.updated} records</p>
            {runResult.unmapped.length > 0 && (
              <p>Unmapped: {runResult.unmapped.length} unique sport values</p>
            )}
          </div>

          {/* Unmapped toggle */}
          {runResult.unmapped.length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setShowUnmapped(!showUnmapped)}
                className="flex items-center gap-1 text-sm text-amber-400 hover:text-amber-300 transition-colors"
              >
                {showUnmapped ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                View unmapped values needing attention
              </button>
              {showUnmapped && (
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {runResult.unmapped.map((item) => (
                    <div key={item.value} className="flex items-start gap-2 text-sm bg-amber-500/5 rounded px-3 py-1.5">
                      <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="text-[--text-primary] font-mono text-xs">{item.value}</span>
                        <span className="text-[--text-tertiary] text-xs ml-2">
                          in {item.locations.join(', ')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Table Results */}
      {runResult && (
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
          <div className="px-5 py-3 border-b border-[--border-primary]">
            <h2 className="text-sm font-semibold text-[--text-primary]">Table Results</h2>
          </div>
          <div className="divide-y divide-[--border-primary]">
            {runResult.tables.map((t) => (
              <div key={`${t.table}.${t.column}`} className="flex items-center justify-between px-5 py-3">
                <div className="text-sm text-[--text-primary]">
                  <span className="font-mono">{t.table}</span>
                  <span className="text-[--text-tertiary]">.</span>
                  <span className="font-mono">{t.column}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-400">{t.updated} updated</span>
                  {t.unmappedCount > 0 && (
                    <span className="text-amber-400">{t.unmappedCount} unmapped</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sports List */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[--border-primary]">
          <h2 className="text-sm font-semibold text-[--text-primary]">All Canonical Sports</h2>
          <span className="text-xs text-[--text-tertiary]">{sports?.length ?? 0} entries</span>
        </div>
        <div className="divide-y divide-[--border-primary]">
          {sports?.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[--text-tertiary]">No sports configured</p>
          ) : (
            sports?.map((sport) => (
              <SportRow key={sport.canonicalName} sport={sport} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function SportRow({ sport }: { sport: NormalizedSport }) {
  const [expanded, setExpanded] = useState(false)

  const categoryColor =
    sport.category === 'team' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
  const contactColor =
    sport.contactType === 'contact' ? 'bg-red-500/10 text-red-400' : 'bg-green-500/10 text-green-400'
  const levelColor =
    sport.level === 'varsity'
      ? 'bg-emerald-500/10 text-emerald-400'
      : sport.level === 'club'
        ? 'bg-amber-500/10 text-amber-400'
        : 'bg-gray-500/10 text-gray-400'

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-[--bg-tertiary]/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-[--text-primary] truncate">
            {sport.canonicalName}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${categoryColor}`}>
            {sport.category}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${contactColor}`}>
            {sport.contactType}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${levelColor}`}>
            {sport.level}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-[--text-tertiary]">{sport.aliasCount} aliases</span>
          {expanded ? <ChevronDown size={14} className="text-[--text-tertiary]" /> : <ChevronRight size={14} className="text-[--text-tertiary]" />}
        </div>
      </button>
      {expanded && (
        <div className="px-5 pb-3">
          <div className="bg-[--bg-tertiary]/50 rounded-lg px-4 py-3">
            <h4 className="text-xs font-semibold text-[--text-secondary] mb-2 uppercase tracking-wider">
              Known Aliases ({sport.aliasCount})
            </h4>
            {sport.aliases.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {sport.aliases.map((alias) => (
                  <span
                    key={alias}
                    className="text-xs bg-[--bg-secondary] border border-[--border-primary] text-[--text-secondary] px-2 py-1 rounded-md font-mono"
                  >
                    {alias}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[--text-tertiary]">No aliases configured</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
