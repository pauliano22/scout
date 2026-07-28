'use client'

// Teams view of the Recruiting CRM: one penetration card per team. Teams
// arrive pre-sorted (focus-pinned first, then penetration asc) and every
// card ends in a verb — clicking drops into the Pipeline pre-filtered to
// that team's untouched athletes.

import { Loader2, Pin } from 'lucide-react'
import type { TeamRollup } from '@/lib/recruiting/merge'

export default function TeamsGrid({
  teams,
  crmReady,
  actingTeam,
  onTogglePin,
  onOpenTeam,
}: {
  teams: TeamRollup[]
  crmReady: boolean
  actingTeam: string | null
  onTogglePin: (team: TeamRollup) => void
  onOpenTeam: (teamKey: string) => void
}) {
  if (teams.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-[--text-tertiary]">
        No teams to show.
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {teams.map(team => {
        const pct = (n: number) => (team.roster > 0 ? (n / team.roster) * 100 : 0)
        const outreach = team.reached_out + team.responded
        const acting = actingTeam === team.team_key

        return (
          <div
            key={team.team_key}
            onClick={() => onOpenTeam(team.team_key)}
            className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 cursor-pointer hover:bg-[--bg-hover]/50 transition-colors"
          >
            {/* Header: team name + roster count + focus pin */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium text-[--text-primary] truncate">{team.team_key}</div>
                <div className="text-xs text-[--text-tertiary]">{team.roster} on roster</div>
              </div>
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onTogglePin(team)
                }}
                disabled={!crmReady || acting}
                title={team.is_focus ? 'Unpin focus team' : 'Pin as focus team'}
                className={`p-1.5 rounded hover:bg-[--bg-hover] disabled:opacity-50 transition-colors shrink-0 ${
                  team.is_focus ? 'text-[--school-primary]' : 'text-[--text-quaternary]'
                }`}
              >
                {acting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Pin size={16} className={team.is_focus ? 'fill-current' : undefined} />
                )}
              </button>
            </div>

            {/* Stacked penetration bar: activated / signed up / reached+responded, rest = track */}
            <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-[--bg-tertiary]">
              {team.activated > 0 && (
                <div className="bg-emerald-500" style={{ width: `${pct(team.activated)}%` }} />
              )}
              {team.signed_up > 0 && (
                <div className="bg-blue-500" style={{ width: `${pct(team.signed_up)}%` }} />
              )}
              {outreach > 0 && (
                <div className="bg-amber-500" style={{ width: `${pct(outreach)}%` }} />
              )}
            </div>

            <div className="mt-2 text-xs text-[--text-secondary]">
              {team.penetration}% on Scout · {team.activated} activated
            </div>

            {team.strategy_notes && (
              <div className="mt-1 text-xs text-[--text-tertiary] truncate">
                {team.strategy_notes}
              </div>
            )}

            <div className="mt-3">
              {team.untouched > 0 ? (
                <span className="text-xs font-medium text-[--school-primary]">
                  {team.untouched} untouched →
                </span>
              ) : (
                <span className="text-xs text-[--text-tertiary]">Fully covered</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
