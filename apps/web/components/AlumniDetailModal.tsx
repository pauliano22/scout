'use client'

import { useEffect, useState } from 'react'
import {
  X,
  Linkedin,
  Plus,
  Check,
  MapPin,
  GraduationCap,
  Users,
  Loader2,
  Briefcase,
  Mail,
  Flag,
} from 'lucide-react'
import SportAvatar from '@/components/SportAvatar'
import ShareProfileButton from '@/components/ShareProfileButton'
import { cleanField } from '@/lib/cleanField'
import type { WorkHistoryEntry } from '@scout/shared/types/database'

// Base alumni type with only fields used by this modal. The richer career
// fields are optional so search callers passing a lightweight object still work;
// the campaign home passes the fully-hydrated alum so they render.
export interface AlumniBase {
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
  email?: string | null
  display_headline?: string | null
  bio?: string | null
  work_history?: WorkHistoryEntry[] | null
  engagement_intent?: string | null
}

// Student-facing labels for alumni.engagement_intent (mig 056).
const INTENT_LABELS: Record<string, string> = {
  here_to_help: 'Here to help — open to advice and intros',
  seeking_employment: 'Open to opportunities themselves',
  both: 'Here to help · Also exploring opportunities',
}

interface AlumniDetailModalProps {
  alumni: AlumniBase
  isInNetwork: boolean
  onAddToNetwork: (id: string) => Promise<void>
  onClose: () => void
  similarAlumni?: AlumniBase[]
  onSelectAlumni?: (alumni: AlumniBase) => void
  networkIds?: Set<string>
}


export default function AlumniDetailModal({
  alumni,
  isInNetwork,
  onAddToNetwork,
  onClose,
  similarAlumni = [],
  onSelectAlumni,
  networkIds = new Set(),
}: AlumniDetailModalProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [addedToNetwork, setAddedToNetwork] = useState(isInNetwork)
  const [warm, setWarm] = useState<{ count: number; topName: string; topRelation: string; topSeasons?: number; topSports?: string[] } | null>(null)
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [flagSubmitted, setFlagSubmitted] = useState(false)
  const [flagError, setFlagError] = useState('')
  const [flagLoading, setFlagLoading] = useState(false)

  // Warm path through the viewer's saved network — best-effort enrichment.
  useEffect(() => {
    let cancelled = false
    setWarm(null)
    fetch('/api/alumni/warm-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alumniIds: [alumni.id] }),
    })
      .then(r => (r.ok ? r.json() : null))
      .then(body => { if (!cancelled && body?.paths?.[alumni.id]) setWarm(body.paths[alumni.id]) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [alumni.id])

  const role = cleanField(alumni.role)
  const company = cleanField(alumni.company)

  const handleAddToNetwork = async () => {
    setIsAdding(true)
    try {
      await onAddToNetwork(alumni.id)
      setAddedToNetwork(true)
    } catch (error) {
      console.error('Error adding to network:', error)
    } finally {
      setIsAdding(false)
    }
  }

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — sheet on mobile, centered card on desktop */}
      <div className="relative bg-[--bg-primary] border border-[--border-primary] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-hidden animate-scale-in">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-[--text-quaternary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] rounded-lg transition-colors z-10"
        >
          <X size={18} />
        </button>

        <div className="overflow-y-auto max-h-[92vh]">
          {/* Hero header — avatar left, info right */}
          <div className="p-6 pb-4">
            <div className="flex items-start gap-4">
              <SportAvatar
                name={alumni.full_name}
                sport={alumni.sport}
                imageUrl={alumni.avatar_url || alumni.photo_url}
                size="xl"
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0 pr-6">
                <h2 className="text-xl font-bold text-[--text-primary] leading-tight mb-1">
                  {alumni.full_name}
                </h2>

                {/* Role + Company */}
                {(role || company) && (
                  <p className="text-sm text-[--text-secondary] mb-2 leading-snug">
                    {role}{role && company && ' · '}{company}
                  </p>
                )}

                {/* Trust meta: sport, year, location */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[--text-quaternary]">
                  {alumni.sport && (
                    <span className="flex items-center gap-1">
                      <Users size={11} />
                      {alumni.sport}
                    </span>
                  )}
                  {alumni.graduation_year && (
                    <span className="flex items-center gap-1">
                      <GraduationCap size={11} />
                      {alumni.graduation_year}
                    </span>
                  )}
                  {alumni.location && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {alumni.location}
                    </span>
                  )}
                </div>

                {/* Industry */}
                {alumni.industry && (
                  <span className="inline-block mt-1 text-xs text-[--text-quaternary]">
                    {alumni.industry}
                  </span>
                )}

                {/* Engagement intent */}
                {alumni.engagement_intent && INTENT_LABELS[alumni.engagement_intent] && (
                  <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-500">
                    {INTENT_LABELS[alumni.engagement_intent]}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warm path — your way in through someone you already saved */}
          {warm && (
            <div className="px-6 pb-3">
              <div className="flex items-start gap-2 text-xs bg-[--school-primary]/8 border border-[--school-primary]/20 rounded-lg px-3 py-2.5">
                <Users size={14} className="text-[--school-primary] flex-shrink-0 mt-0.5" />
                <span className="text-[--text-secondary] leading-snug">
                  <span className="font-semibold text-[--text-primary]">{warm.topName}</span>
                  {warm.count > 1 ? ` +${warm.count - 1} more` : ''} in your network can introduce you
                  {warm.topRelation === 'teammate' && (warm.topSeasons ?? 0) > 0
                    ? ` · played ${warm.topSeasons} season${(warm.topSeasons ?? 0) > 1 ? 's' : ''} together`
                    : ''}
                </span>
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="px-6 pb-5 flex gap-2.5">
            {addedToNetwork ? (
              <button className="flex-1 btn-success flex items-center justify-center gap-2 cursor-default">
                <Check size={15} />
                In Your Network
              </button>
            ) : (
              <button
                onClick={handleAddToNetwork}
                disabled={isAdding}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
                Add to Network
              </button>
            )}

            {alumni.linkedin_url && (
              <a
                href={alumni.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary flex items-center justify-center gap-2 px-4"
              >
                <Linkedin size={15} />
                <span className="hidden sm:inline">LinkedIn</span>
              </a>
            )}

            {alumni.email && (
              <a
                href={`mailto:${alumni.email}`}
                className="btn-secondary flex items-center justify-center gap-2 px-4"
              >
                <Mail size={15} />
                <span className="hidden sm:inline">Email</span>
              </a>
            )}

            {/* Share */}
            <ShareProfileButton
              alumni={{
                full_name: alumni.full_name,
                sport: alumni.sport,
                graduation_year: alumni.graduation_year,
                company: alumni.company,
                role: alumni.role,
                location: alumni.location,
                photo_url: alumni.photo_url || alumni.avatar_url,
              }}
            />

            {/* Flag button */}
            <button
              onClick={() => setShowFlagForm(!showFlagForm)}
              className={`btn-ghost px-3 transition-colors ${showFlagForm ? 'text-red-500 bg-red-500/10' : 'text-[--text-quaternary] hover:text-red-400'}`}
              title="Flag this profile"
            >
              <Flag size={15} />
            </button>
          </div>

          {/* Inline flag form */}
          {showFlagForm && (
            <div className="px-6 pb-4" onClick={e => e.stopPropagation()}>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="What's wrong with this profile?"
                className="w-full text-xs p-2.5 rounded-lg bg-[--bg-primary] border border-[--border-primary] resize-none min-h-[70px] focus:outline-none focus:border-red-400"
                autoFocus
              />
              {flagError && (
                <p className="text-[10px] text-red-400 mt-1">{flagError}</p>
              )}
              <div className="flex gap-2 mt-2">
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
            <p className="text-[11px] text-emerald-500 px-6 pb-4">Flag submitted — thanks for helping keep Scout accurate</p>
          )}

          {/* Career: headline, bio, work history (the full-profile expand) */}
          {(alumni.display_headline || alumni.bio || (alumni.work_history && alumni.work_history.length > 0)) && (
            <div className="border-t border-[--border-primary] px-6 py-5 space-y-4">
              {alumni.display_headline && (
                <p className="text-sm text-[--text-secondary] leading-snug">{alumni.display_headline}</p>
              )}

              {alumni.bio && (
                <div>
                  <h3 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-2">About</h3>
                  <p className="text-sm text-[--text-secondary] leading-relaxed whitespace-pre-line">{alumni.bio}</p>
                </div>
              )}

              {alumni.work_history && alumni.work_history.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-2.5">Experience</h3>
                  <div className="space-y-3">
                    {alumni.work_history.map((w, i) => (
                      <div key={i} className="flex gap-3">
                        <Briefcase size={13} className="text-[--text-quaternary] mt-0.5 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-[--text-primary] leading-snug">
                            {w.title || '—'}{w.title && w.company && ' · '}{w.company || ''}
                          </p>
                          {(w.duration || w.location) && (
                            <p className="text-xs text-[--text-quaternary] mt-0.5">
                              {[w.duration, w.location].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Similar Alumni */}
          {similarAlumni.length > 0 && (
            <div className="border-t border-[--border-primary] px-6 py-5">
              <h3 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-3">
                Similar Alumni
              </h3>
              <div className="space-y-1.5">
                {similarAlumni.map((similar) => {
                  const simRole = cleanField(similar.role)
                  const simCompany = cleanField(similar.company)
                  return (
                    <button
                      key={similar.id}
                      onClick={() => onSelectAlumni?.(similar)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] transition-colors text-left group"
                    >
                      <SportAvatar
                        name={similar.full_name}
                        sport={similar.sport}
                        imageUrl={similar.avatar_url || similar.photo_url}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[--text-primary] truncate">
                            {similar.full_name}
                          </span>
                          {networkIds.has(similar.id) && (
                            <span className="text-xs text-emerald-400 flex-shrink-0">· Connected</span>
                          )}
                        </div>
                        <p className="text-xs text-[--text-tertiary] truncate">
                          {simRole && simCompany ? `${simRole} · ${simCompany}` : simRole || simCompany || similar.sport}
                        </p>
                      </div>
                      {similar.industry && (
                        <span className="flex-shrink-0 text-xs text-[--text-quaternary]">
                          {similar.industry}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
