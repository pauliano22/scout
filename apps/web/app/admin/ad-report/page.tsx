'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Download, GraduationCap } from 'lucide-react'

type AdReport = {
  generated_for_days: number
  students: { total: number; new_in_window: number; active_in_window: number; sent_at_least_one_message: number }
  funnel: {
    connections_saved: number
    contacted: number
    replied: number
    meetings: number
    met: number
    reply_rate: number | null
    meeting_rate: number | null
    median_days_to_reply: number | null
  }
  outcomes: Record<string, number> | null
  messages: { total: number; by_channel: Record<string, number> }
  alumni: {
    directory_total: number
    claimed: number
    claim_rate: number | null
    intent: { seeking_employment: number; here_to_help: number; both: number; unknown: number }
  }
  roster: { entries_total: number; coverage_by_sport: Array<{ sport: string; roster: number; directory: number; ratio: number | null }> }
}

const pct = (v: number | null) => (v === null ? '—' : `${(v * 100).toFixed(0)}%`)

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
      <p className="text-2xl font-semibold text-[--text-primary] tabular-nums">{value}</p>
      <p className="text-xs text-[--text-secondary] mt-1">{label}</p>
      {hint && <p className="text-[11px] text-[--text-quaternary] mt-0.5">{hint}</p>}
    </div>
  )
}

export default function AdReportPage() {
  const [report, setReport] = useState<AdReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [days, setDays] = useState(30)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/reports/ad?days=${days}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load report')
      setReport(json.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    fetchReport()
  }, [fetchReport])

  const funnelSteps = report
    ? [
        { label: 'Saved', value: report.funnel.connections_saved },
        { label: 'Contacted', value: report.funnel.contacted },
        { label: 'Replied', value: report.funnel.replied },
        { label: 'Meetings', value: report.funnel.meetings },
      ]
    : []
  const funnelMax = Math.max(1, ...funnelSteps.map(s => s.value))

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[--text-primary] flex items-center gap-2">
            <GraduationCap size={22} /> AD Report
          </h1>
          <p className="text-sm text-[--text-secondary] mt-1">
            Program-level evidence: adoption, outreach funnel, and outcomes
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-[--bg-secondary] border border-[--border-primary] rounded-lg px-2.5 py-1.5 text-sm text-[--text-primary]"
          >
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={180}>Last 180 days</option>
          </select>
          <a
            href={`/api/admin/reports/ad?days=${days}&format=csv`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-secondary] hover:text-[--text-primary] transition-colors"
          >
            <Download size={14} /> CSV
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-[--text-tertiary]" />
        </div>
      )}

      {!loading && report && (
        <>
          {/* Students */}
          <section>
            <h2 className="text-sm font-semibold text-[--text-primary] mb-3">Student adoption</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Students" value={report.students.total} />
              <Stat label={`New (last ${report.generated_for_days}d)`} value={report.students.new_in_window} />
              <Stat label={`Active (last ${report.generated_for_days}d)`} value={report.students.active_in_window} />
              <Stat label="Sent ≥1 message" value={report.students.sent_at_least_one_message} hint="all-time" />
            </div>
          </section>

          {/* Funnel */}
          <section>
            <h2 className="text-sm font-semibold text-[--text-primary] mb-3">Outreach funnel (all-time)</h2>
            <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-3">
              {funnelSteps.map(step => (
                <div key={step.label} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-[--text-secondary] flex-shrink-0">{step.label}</span>
                  <div className="flex-1 h-5 bg-[--bg-tertiary] rounded overflow-hidden">
                    <div
                      className="h-full bg-[--school-primary]/70 rounded"
                      style={{ width: `${(step.value / funnelMax) * 100}%` }}
                    />
                  </div>
                  <span className="w-12 text-right text-sm tabular-nums text-[--text-primary]">{step.value}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-x-6 gap-y-1 pt-2 text-xs text-[--text-secondary]">
                <span>Reply rate: <strong className="text-[--text-primary]">{pct(report.funnel.reply_rate)}</strong></span>
                <span>Reply → meeting: <strong className="text-[--text-primary]">{pct(report.funnel.meeting_rate)}</strong></span>
                <span>
                  Median days to reply:{' '}
                  <strong className="text-[--text-primary]">{report.funnel.median_days_to_reply ?? '—'}</strong>
                </span>
              </div>
              <p className="text-[11px] text-[--text-quaternary]">
                Replies are student-logged; “copied” messages ({report.messages.by_channel.copied ?? 0} of{' '}
                {report.messages.total}) may never have been sent.
              </p>
            </div>
          </section>

          {/* Outcomes */}
          <section>
            <h2 className="text-sm font-semibold text-[--text-primary] mb-3">Outcomes</h2>
            {report.outcomes ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Helpful conversations" value={report.outcomes.helpful_convo ?? 0} />
                <Stat label="Referrals" value={report.outcomes.referral ?? 0} />
                <Stat label="Interviews" value={report.outcomes.interview ?? 0} />
                <Stat label="Offers" value={report.outcomes.offer ?? 0} />
              </div>
            ) : (
              <p className="text-sm text-[--text-quaternary] bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
                Not tracked yet — apply migration 058 to start capturing what connections lead to.
              </p>
            )}
          </section>

          {/* Alumni */}
          <section>
            <h2 className="text-sm font-semibold text-[--text-primary] mb-3">Alumni activation</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat label="Directory size" value={report.alumni.directory_total} />
              <Stat label="Claimed profiles" value={report.alumni.claimed} hint={pct(report.alumni.claim_rate)} />
              <Stat label="Here to help" value={report.alumni.intent.here_to_help + report.alumni.intent.both} />
              <Stat label="Seeking employment" value={report.alumni.intent.seeking_employment + report.alumni.intent.both} />
            </div>
          </section>

          {/* Roster coverage */}
          <section>
            <h2 className="text-sm font-semibold text-[--text-primary] mb-3">
              Roster coverage <span className="font-normal text-[--text-quaternary]">— directory size vs roster size per sport</span>
            </h2>
            {report.roster.coverage_by_sport.length === 0 ? (
              <p className="text-sm text-[--text-quaternary] bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
                No roster entries imported yet.
              </p>
            ) : (
              <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-[--text-quaternary] border-b border-[--border-primary]">
                      <th className="px-4 py-2.5 font-medium">Sport</th>
                      <th className="px-4 py-2.5 font-medium text-right">Roster</th>
                      <th className="px-4 py-2.5 font-medium text-right">In directory</th>
                      <th className="px-4 py-2.5 font-medium text-right">Coverage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[--border-primary]">
                    {report.roster.coverage_by_sport.map(row => (
                      <tr key={row.sport}>
                        <td className="px-4 py-2.5 text-[--text-primary]">{row.sport}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[--text-secondary]">{row.roster}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[--text-secondary]">{row.directory}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-[--text-primary]">{pct(row.ratio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
