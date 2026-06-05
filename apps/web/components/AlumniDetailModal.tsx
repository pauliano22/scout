'use client'

import { useState } from 'react'
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
} from 'lucide-react'
import Avatar from '@/components/Avatar'
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
              <Avatar
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
              </div>
            </div>
          </div>

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
          </div>

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
                      <Avatar
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
