'use client'

import { useMemo } from 'react'
import type { Alumni } from '@scout/shared/types/database'
import {
  calculateCompletionScore,
  scoreHexColor,
  scoreColor,
  type CompletionResult,
} from '@/lib/profile-completion'
import { AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'

interface Props {
  alumni: Alumni | null
  /** Optional array of field names to map back to edit links. */
  fieldLinks?: Record<string, string>
  /** Callback fired when a missing-field suggestion is clicked. */
  onFieldClick?: (field: string, label: string) => void
  /** Compact variant for embedding in small spaces (default: false). */
  compact?: boolean
}

/**
 * Circular SVG progress indicator with colour-coded ring.
 * Shows score 0–100 in the centre.
 */
function CircularProgress({
  score,
  size = 80,
  strokeWidth = 6,
}: {
  score: number
  size?: number
  strokeWidth?: number
}) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = scoreHexColor(score)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0"
    >
      {/* Background track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-[--bg-tertiary]"
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="transition-all duration-500"
      />
      {/* Centre text */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.28}
        fontWeight={700}
        fill={color}
      >
        {score}
      </text>
    </svg>
  )
}

/**
 * ProfileCompletionWidget
 *
 * Displays a visual circular progress indicator showing the alumni profile's
 * completeness score (0–100), colour-coded (red <40, yellow 40–70, green >70),
 * and lists missing fields as actionable suggestions.
 */
export default function ProfileCompletionWidget({
  alumni,
  fieldLinks,
  onFieldClick,
  compact = false,
}: Props) {
  const result: CompletionResult = useMemo(() => {
    if (!alumni) {
      return { score: 0, missing: [], total: 100 }
    }
    return calculateCompletionScore({
      photo_url: alumni.photo_url || alumni.avatar_url,
      bio: alumni.bio || undefined,
      industry: alumni.industry || undefined,
      company: alumni.company || undefined,
      role: alumni.role || undefined,
      location: alumni.location || undefined,
      grad_year: alumni.graduation_year || undefined,
      linkedin_url: alumni.linkedin_url || undefined,
      education: alumni.education || undefined,
      sport: alumni.sport || undefined,
      class_year: alumni.graduation_year || undefined,
    })
  }, [alumni])

  const { score, missing } = result
  const color = scoreColor(score)

  // Compact render — just the circle + short label
  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <CircularProgress score={score} size={56} strokeWidth={5} />
        <div className="min-w-0">
          <p className="text-xs font-medium text-[--text-secondary]">
            Profile completeness
          </p>
          <p className="text-xs text-[--text-tertiary]">
            {missing.length === 0
              ? 'Complete!'
              : `${missing.length} field${missing.length === 1 ? '' : 's'} missing`}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-4">
      <div className="flex items-start gap-4">
        <CircularProgress score={score} strokeWidth={6} />

        <div className="min-w-0 pt-1">
          <h3 className="text-sm font-semibold text-[--text-primary]">
            Profile completeness
          </h3>
          <p className="text-xs text-[--text-tertiary] mt-0.5">
            {missing.length === 0
              ? 'Your profile is complete!'
              : `Complete your profile to help others discover you.`}
          </p>
          {missing.length > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-medium mt-2 ${
                color === 'red'
                  ? 'text-red-400'
                  : color === 'yellow'
                    ? 'text-yellow-400'
                    : 'text-green-400'
              }`}
            >
              {color === 'red' ? (
                <AlertTriangle size={12} />
              ) : (
                <CheckCircle size={12} />
              )}
              {score < 40
                ? 'Needs attention'
                : score <= 70
                  ? 'Getting there'
                  : 'Looking great'}
            </span>
          )}
        </div>
      </div>

      {/* Missing fields list */}
      {missing.length > 0 && (
        <div className="border-t border-[--border-primary] pt-3">
          <p className="text-xs text-[--text-quaternary] font-medium mb-2 uppercase tracking-wider">
            Add the following:
          </p>
          <ul className="space-y-1">
            {missing.map((label) => {
              const fieldKey = Object.entries(
                /* map label back to key */ {},
              ).find(([, v]) => v === label)?.[0]
              const link = fieldLinks?.[label]
              return (
                <li key={label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (onFieldClick) onFieldClick(label, label)
                    }}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      link || onFieldClick
                        ? 'hover:bg-[--bg-tertiary] cursor-pointer text-[--school-primary]'
                        : 'text-[--text-secondary] cursor-default'
                    }`}
                  >
                    <span>{label}</span>
                    {(link || onFieldClick) && (
                      <ChevronRight size={14} className="shrink-0 opacity-50" />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {missing.length === 0 && (
        <div className="border-t border-[--border-primary] pt-3 text-center">
          <CheckCircle size={18} className="text-green-400 inline-block mr-1.5 align-text-bottom" />
          <span className="text-sm text-[--text-secondary]">
            All fields complete
          </span>
        </div>
      )}
    </div>
  )
}
