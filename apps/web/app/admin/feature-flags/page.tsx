'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, ToggleLeft, ToggleRight, AlertCircle, CheckCircle } from 'lucide-react'

interface FeatureFlag {
  flag_name: string
  enabled: boolean
  rollout_percentage: number
  created_at: string
  updated_at: string
}

export default function AdminFeatureFlagsPage() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const fetchFlags = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/feature-flags')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load flags')
      setFlags(json.data || [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFlags()
  }, [fetchFlags])

  const toggleFlag = async (flag: FeatureFlag, newEnabled: boolean) => {
    setActing(flag.flag_name)
    setSuccessMsg('')
    setError('')
    try {
      const res = await fetch('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_name: flag.flag_name, enabled: newEnabled }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to toggle flag')
      setFlags((prev) =>
        prev.map((f) =>
          f.flag_name === flag.flag_name ? { ...f, enabled: newEnabled, updated_at: json.data.updated_at } : f,
        ),
      )
      setSuccessMsg(`"${flag.flag_name}" is now ${newEnabled ? 'ON' : 'OFF'}`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const updateRollout = async (flag: FeatureFlag, rollout: number) => {
    setActing(flag.flag_name)
    setSuccessMsg('')
    setError('')
    try {
      const res = await fetch('/api/feature-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag_name: flag.flag_name, rollout_percentage: rollout }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update rollout')
      setFlags((prev) =>
        prev.map((f) =>
          f.flag_name === flag.flag_name ? { ...f, rollout_percentage: rollout, updated_at: json.data.updated_at } : f,
        ),
      )
      setSuccessMsg(`"${flag.flag_name}" rollout set to ${rollout}%`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setActing(null)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  const flagNameToLabel = (name: string) =>
    name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[--text-primary]">Feature Flags</h1>
        <p className="text-sm text-[--text-secondary] mt-1">
          Toggle features on/off and control gradual rollouts
        </p>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-emerald-400 text-sm">
          <CheckCircle size={16} />
          {successMsg}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      )}

      {/* Flags */}
      {!loading && (
        <div className="space-y-3">
          {flags.length === 0 ? (
            <div className="text-center py-16">
              <ToggleLeft size={32} className="mx-auto text-[--text-tertiary] mb-3" />
              <p className="text-sm text-[--text-tertiary]">No feature flags found</p>
              <p className="text-xs text-[--text-quaternary] mt-1">Run the migration to seed initial flags</p>
            </div>
          ) : (
            flags.map((flag) => {
              const isActing = acting === flag.flag_name
              return (
                <div
                  key={flag.flag_name}
                  className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-[--text-primary]">
                          {flagNameToLabel(flag.flag_name)}
                        </span>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            flag.enabled
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-gray-500/10 text-gray-500'
                          }`}
                        >
                          {flag.enabled ? 'ENABLED' : 'DISABLED'}
                        </span>
                      </div>
                      <code className="text-xs text-[--text-tertiary]">{flag.flag_name}</code>
                      <div className="mt-3 flex items-center gap-4">
                        {/* Rollout slider */}
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[--text-secondary]">Rollout:</label>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={flag.rollout_percentage}
                            onChange={(e) => updateRollout(flag, Number(e.target.value))}
                            disabled={isActing}
                            className="w-24 h-1.5 accent-[--school-primary] disabled:opacity-50 cursor-pointer"
                          />
                          <span className="text-xs font-mono text-[--text-secondary] w-8 text-right">
                            {flag.rollout_percentage}%
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-[--text-quaternary] mt-2">
                        Updated {formatDate(flag.updated_at)}
                      </p>
                    </div>

                    {/* Toggle button */}
                    <button
                      onClick={() => toggleFlag(flag, !flag.enabled)}
                      disabled={isActing}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        flag.enabled
                          ? 'bg-red-500/10 text-red-500 hover:bg-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                      }`}
                    >
                      {isActing ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : flag.enabled ? (
                        <ToggleRight size={14} />
                      ) : (
                        <ToggleLeft size={14} />
                      )}
                      {flag.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
