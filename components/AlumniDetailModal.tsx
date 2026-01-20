'use client'

import { useState } from 'react'
import {
  X,
  Linkedin,
  Plus,
  Check,
  MapPin,
  GraduationCap,
  Building2,
  Users,
  Briefcase,
  Loader2
} from 'lucide-react'

// Base alumni type with only fields used by this modal
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

const industryBadgeClass: Record<string, string> = {
  Finance: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Technology: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Consulting: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Healthcare: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Law: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Media: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[--bg-primary] border border-[--border-primary] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl animate-scale-in">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[--text-quaternary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] rounded-lg transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6 overflow-y-auto max-h-[90vh]">
          {/* Main Info */}
          <div className="mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-[--text-primary] mb-2">
                  {alumni.full_name}
                </h2>

                {alumni.industry && (
                  <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${
                    industryBadgeClass[alumni.industry] || 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
                  }`}>
                    {alumni.industry}
                  </span>
                )}
              </div>
            </div>

            {/* Career Info */}
            {(alumni.role || alumni.company) && (
              <div className="flex items-center gap-2 text-[--text-secondary] mb-3">
                <Briefcase size={16} className="text-[--text-quaternary]" />
                <span>
                  {alumni.role}{alumni.role && alumni.company && ' @ '}{alumni.company}
                </span>
              </div>
            )}

            {/* Details */}
            <div className="flex flex-wrap gap-4 text-sm text-[--text-tertiary]">
              {alumni.graduation_year && (
                <div className="flex items-center gap-1.5">
                  <GraduationCap size={14} />
                  <span>Class of {alumni.graduation_year}</span>
                </div>
              )}
              {alumni.sport && (
                <div className="flex items-center gap-1.5">
                  <Users size={14} />
                  <span>{alumni.sport}</span>
                </div>
              )}
              {alumni.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin size={14} />
                  <span>{alumni.location}</span>
                </div>
              )}
              {alumni.company && (
                <div className="flex items-center gap-1.5">
                  <Building2 size={14} />
                  <span>{alumni.company}</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 mb-6">
            {addedToNetwork ? (
              <button className="flex-1 btn-success flex items-center justify-center gap-2 cursor-default">
                <Check size={16} />
                In Your Network
              </button>
            ) : (
              <button
                onClick={handleAddToNetwork}
                disabled={isAdding}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {isAdding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Plus size={16} />
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
                <Linkedin size={16} />
                LinkedIn
              </a>
            )}
          </div>

          {/* Similar Alumni Section */}
          {similarAlumni.length > 0 && (
            <div className="border-t border-[--border-primary] pt-6">
              <h3 className="text-sm font-medium text-[--text-secondary] mb-4">Similar Alumni</h3>
              <div className="space-y-2">
                {similarAlumni.map((similar) => (
                  <button
                    key={similar.id}
                    onClick={() => onSelectAlumni?.(similar)}
                    className="w-full flex items-center justify-between p-3 rounded-lg bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[--text-primary] truncate">
                          {similar.full_name}
                        </span>
                        {networkIds.has(similar.id) && (
                          <span className="text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            In Network
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[--text-tertiary] truncate">
                        {similar.role && similar.company
                          ? `${similar.role} @ ${similar.company}`
                          : similar.company || similar.role || similar.sport}
                      </p>
                    </div>
                    {similar.industry && (
                      <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${
                        industryBadgeClass[similar.industry]?.split(' ').slice(0, 2).join(' ') || 'bg-[--bg-tertiary] text-[--text-secondary]'
                      }`}>
                        {similar.industry}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
