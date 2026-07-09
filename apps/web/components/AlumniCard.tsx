'use client'

import { Alumni } from '@scout/shared/types/database'
import { MapPin, Plus, Check, Linkedin, ArrowRight } from 'lucide-react'
import Link from '@/components/Link'
import SportAvatar from '@/components/SportAvatar'
import { cleanField } from '@/lib/cleanField'

// Student-facing labels for alumni.engagement_intent (mig 056): tells the
// student whether to ask this alum for help or treat them as a fellow seeker.
const INTENT_BADGES: Record<string, { label: string; className: string }> = {
  here_to_help: {
    label: 'Here to help',
    className: 'bg-green-500/10 text-green-700 dark:text-green-500',
  },
  seeking_employment: {
    label: 'Open to opportunities',
    className: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  },
  both: {
    label: 'Here to help · Also looking',
    className: 'bg-green-500/10 text-green-700 dark:text-green-500',
  },
}

interface AlumniCardProps {
  alumni: Alumni | {
    id: string
    full_name: string
    company: string | null
    role: string | null
    industry: string | null
    sport: string
    graduation_year: number
    linkedin_url: string | null
    location: string | null
    photo_url?: string | null
    avatar_url?: string | null
    engagement_intent?: string | null
  }
  isInNetwork?: boolean
  onAddToNetwork?: (id: string) => void
  onClick?: () => void
  isLoading?: boolean
  /** e.g. "Jeff Bassell can introduce you" */
  warmNote?: string | null
}

export default function AlumniCard({
  alumni,
  isInNetwork = false,
  onAddToNetwork,
  onClick,
  isLoading = false,
  warmNote = null,
}: AlumniCardProps) {
  return (
    <div
      onClick={onClick}
      className={`card p-5 flex flex-col items-center text-center gap-2.5 transition-colors hover:bg-[--bg-tertiary] ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Avatar */}
      <SportAvatar
        name={alumni.full_name}
        sport={alumni.sport}
        imageUrl={alumni.avatar_url || alumni.photo_url}
        size="xl"
        className="mt-1"
      />

      {/* Name */}
      <div className="mt-1">
        <h3 className="text-sm font-semibold text-[--text-primary] leading-tight">{alumni.full_name}</h3>
        <p className="text-[--text-quaternary] text-xs mt-0.5">
          {alumni.sport} · {alumni.graduation_year}
        </p>
      </div>

      {(() => {
        const badge = 'engagement_intent' in alumni && alumni.engagement_intent
          ? INTENT_BADGES[alumni.engagement_intent]
          : null
        if (!badge) return null
        return (
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
            {badge.label}
          </span>
        )
      })()}

      {/* Role + Company */}
      <div className="flex flex-col items-center flex-1 w-full justify-start">
        {(() => {
          const role = cleanField(alumni.role)
          const company = cleanField(alumni.company)
          if (!role && !company) {
            return <p className="text-[--text-quaternary] text-xs italic">No career info</p>
          }
          return (
            <>
              {role    && <p className="text-xs text-[--text-secondary] leading-snug">{role}</p>}
              {company && <p className="text-xs text-[--text-tertiary] leading-snug">{company}</p>}
            </>
          )
        })()}
      </div>

      {warmNote && (
        <p className="text-[11px] font-semibold text-green-700 dark:text-green-500 leading-snug">
          {warmNote}
        </p>
      )}

      {/* Location */}
      {alumni.location && (
        <p className="text-[--text-quaternary] text-xs flex items-center gap-0.5">
          <MapPin size={10} />
          {alumni.location}
        </p>
      )}

      {/* Actions */}
      <div
        className="flex gap-2 w-full mt-auto pt-2.5 border-t border-[--border-primary]"
        onClick={e => e.stopPropagation()}
      >
        {isInNetwork ? (
          <Link
            href={`/network?highlight=${alumni.id}`}
            className="flex-1 btn-success flex items-center justify-center gap-1.5 text-xs py-2"
          >
            <Check size={12} />
            In Network
            <ArrowRight size={11} />
          </Link>
        ) : (
          <button
            onClick={() => onAddToNetwork?.(alumni.id)}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-1.5 btn-primary text-xs py-2"
          >
            {isLoading ? (
              <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <>
                <Plus size={12} />
                Add to Network
              </>
            )}
          </button>
        )}

        {alumni.linkedin_url && (
          <a
            href={alumni.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost p-2 hover:text-[#0077b5]"
            title="View LinkedIn"
            onClick={e => e.stopPropagation()}
          >
            <Linkedin size={13} />
          </a>
        )}
      </div>
    </div>
  )
}
