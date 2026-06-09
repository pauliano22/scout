'use client'

// The self-serve goal step. The student picks a goal type, a VALIDATED target
// industry (corpus taxonomy — no free-text "Startups"), an optional focus phrase
// that sharpens the search (e.g. "fintech" within Finance), and an optional city.
// A live coverage probe warns up front if the slice is thin — so a stall is
// caught HERE with a broaden option, not surfaced later as "Scout found nothing".

import { useEffect, useState } from 'react'
import { Target, ArrowRight, Check, AlertTriangle } from 'lucide-react'
import { CAMPAIGN_COUNT_BY_INTENSITY } from '@scout/shared/agent/nextBestAction'
import { CORPUS_INDUSTRIES } from '@/lib/campaign/industries'
import type { Profile } from '@scout/shared/types/database'

const OUTCOMES = [
  { key: 'informational_interview', label: 'Informational interviews', hint: 'Learn how alumni broke in' },
  { key: 'referral',               label: 'Referrals',                hint: 'Get introduced for roles' },
  { key: 'mentor_relationship',    label: 'Mentors',                  hint: 'Build lasting relationships' },
] as const

function defaultDeadline(): string {
  const d = new Date()
  d.setDate(d.getDate() + 70) // ~10 weeks out — a typical recruiting window
  return d.toISOString().slice(0, 10)
}

interface Coverage { tier: 'healthy' | 'moderate' | 'thin'; effective: number; industry: string; city: string | null; suggestion: string | null }

export default function GoalSetup({ profile, onComplete }: { profile: Profile; onComplete: () => void }) {
  const validIndustry = (CORPUS_INDUSTRIES as readonly string[]).includes(profile?.primary_industry ?? '')
    ? (profile!.primary_industry as string) : 'Finance'

  const [goalMetric, setGoalMetric] = useState<string>('informational_interview')
  const [industry, setIndustry]     = useState<string>(validIndustry)
  const [focus, setFocus]           = useState<string>(profile?.interests ?? '')
  const [city, setCity]             = useState<string>(profile?.preferred_locations?.[0] ?? '')
  const [goalCount, setGoalCount]   = useState<number>(CAMPAIGN_COUNT_BY_INTENSITY[profile?.networking_intensity ?? 'own_pace'] ?? 3)
  const [deadline, setDeadline]     = useState<string>(defaultDeadline())
  const [coverage, setCoverage]     = useState<Coverage | null>(null)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Live coverage probe (debounced) whenever the slice changes.
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ industry })
        if (city.trim()) q.set('city', city.trim())
        const res = await fetch(`/api/campaign/coverage?${q.toString()}`)
        if (res.ok && !cancelled) setCoverage(await res.json())
      } catch { /* hint is best-effort */ }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [industry, city])

  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/campaign/goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goalMetric, goalCount, deadline, industry, focus: focus.trim() || null, city: city.trim() || null }),
      })
      if (!res.ok) throw new Error('save failed')
      onComplete()
    } catch {
      setError('Could not save your goal. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <div className="flex items-center gap-2 text-[--school-primary] mb-3">
        <Target size={18} />
        <span className="text-xs font-semibold tracking-wider uppercase">Set your campaign</span>
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[--text-primary]">What are you working toward?</h1>
      <p className="text-[--text-secondary] mt-2 leading-relaxed">
        Scout lines up the right alumni and drafts your outreach between logins. You approve and send everything — nothing goes out without you.
      </p>

      {/* Goal type */}
      <div className="mt-7">
        <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">Goal</p>
        <div className="space-y-2">
          {OUTCOMES.map((o) => (
            <button key={o.key} onClick={() => setGoalMetric(o.key)}
              className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                goalMetric === o.key ? 'border-[--school-primary] bg-[--school-primary]/5' : 'border-[--border-primary] hover:border-[--border-secondary]'
              }`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-[--text-primary]">{o.label}</div>
                  <div className="text-xs text-[--text-tertiary]">{o.hint}</div>
                </div>
                {goalMetric === o.key && <Check size={16} className="text-[--school-primary] shrink-0" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Field + focus */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">Field</p>
          <select value={industry} onChange={(e) => setIndustry(e.target.value)}
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3 text-sm text-[--text-primary] focus:border-[--school-primary] outline-none appearance-none">
            {CORPUS_INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">Focus <span className="text-[--text-quaternary] normal-case">(optional)</span></p>
          <input type="text" value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. fintech, product"
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3 text-sm text-[--text-primary] focus:border-[--school-primary] outline-none" />
        </div>
      </div>

      {/* City */}
      <div className="mt-4">
        <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">City <span className="text-[--text-quaternary] normal-case">(optional)</span></p>
        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. New York"
          className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3 text-sm text-[--text-primary] focus:border-[--school-primary] outline-none" />
      </div>

      {/* Live coverage hint — the stall catcher */}
      {coverage && (
        <div className={`mt-3 flex items-start gap-2 text-sm rounded-xl px-3 py-2.5 ${
          coverage.tier === 'thin'
            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
            : 'text-[--text-tertiary]'
        }`}>
          {coverage.tier === 'thin'
            ? <AlertTriangle size={15} className="shrink-0 mt-0.5" />
            : <Check size={15} className="shrink-0 mt-0.5 text-emerald-500" />}
          <div>
            {coverage.tier === 'thin' ? (
              <>
                <span>{coverage.suggestion}</span>
                {coverage.city && (
                  <button onClick={() => setCity('')} className="ml-1 underline hover:no-underline">Search all cities</button>
                )}
              </>
            ) : (
              <span>~{coverage.effective} {coverage.industry} alumni{coverage.city ? ` in ${coverage.city}` : ''} — good coverage.</span>
            )}
          </div>
        </div>
      )}

      {/* How many + deadline */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">How many</p>
          <input type="number" min={1} max={50} value={goalCount}
            onChange={(e) => setGoalCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3 text-sm text-[--text-primary] focus:border-[--school-primary] outline-none" />
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wider uppercase text-[--text-quaternary] mb-2">By when</p>
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3 text-sm text-[--text-primary] focus:border-[--school-primary] outline-none" />
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      <button onClick={save} disabled={saving} className="btn-primary w-full mt-7 flex items-center justify-center gap-2 py-3">
        {saving ? 'Starting…' : <>Start my campaign <ArrowRight size={15} /></>}
      </button>
    </div>
  )
}
