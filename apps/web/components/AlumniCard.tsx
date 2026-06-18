'use client'

import { Alumni } from '@scout/shared/types/database'
import { MapPin, Plus, Check, Linkedin, ArrowRight, Flag } from 'lucide-react'
import Link from '@/components/Link'
import SportAvatar from '@/components/SportAvatar'
import { cleanField } from '@/lib/cleanField'
import { useState } from 'react'

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
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSubmitted, setFlagSubmitted] = useState(false)
  const [flagError, setFlagError] = useState('')
  const [flagLoading, setFlagLoading] = useState(false)

  const handleFlag = async () => {
    if (flagReason.trim().length < 5) return
    setFlagLoading(true)
    setFlagError('')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alumniId: alumni.id, reason: flagReason.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to submit')
      setFlagSubmitted(true)
      setShowFlagForm(false)
    } catch (e: any) {
      setFlagError(e.message)
    } finally {
      setFlagLoading(false)
    }
  }

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

      {/* Flag form — inline, appears below location */}
      {showFlagForm && (
        <div className="w-full mt-1" onClick={e => e.stopPropagation()}>
          <textarea
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="What's wrong with this profile?"
            className="w-full text-xs p-2 rounded-lg bg-[--bg-primary] border border-[--border-primary] resize-none min-h-[60px] focus:outline-none focus:border-red-400"
            autoFocus
          />
          {flagError && (
            <p className="text-[10px] text-red-400 mt-1">{flagError}</p>
          )}
          <div className="flex gap-2 mt-1.5">
            <button
              onClick={handleFlag}
              disabled={flagLoading || flagReason.trim().length < 5}
              className="flex-1 text-xs py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-500 disabled:opacity-40 transition-colors"
            >
              {flagLoading ? 'Submitting...' : 'Submit Report'}
            </button>
            <button
              onClick={() => { setShowFlagForm(false); setFlagError('') }}
              className="text-xs py-1.5 px-3 rounded-lg bg-[--bg-tertiary] text-[--text-tertiary] hover:text-[--text-secondary] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {flagSubmitted && (
        <p className="text-[10px] text-emerald-500 mt-1">Flag submitted — thanks for helping keep Scout accurate</p>
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

        {/* Flag button */}
        <button
          onClick={() => setShowFlagForm(!showFlagForm)}
          className={`btn-ghost p-2 transition-colors ${showFlagForm ? 'text-red-500' : 'text-[--text-quaternary] hover:text-red-400'}`}
          title="Flag this profile"
        >
          <Flag size={13} />
        </button>
      </div>
