'use client'

import { Alumni } from '@/types/database'
import { MapPin, Plus, Check, Linkedin } from 'lucide-react'

interface AlumniCardProps {
  alumni: Alumni
  isInNetwork?: boolean
  onAddToNetwork?: (id: string) => void
  isLoading?: boolean
}

const industryBadgeClass: Record<string, string> = {
  Finance: 'bg-emerald-500/10 text-emerald-400',
  Technology: 'bg-blue-500/10 text-blue-400',
  Consulting: 'bg-purple-500/10 text-purple-400',
  Healthcare: 'bg-pink-500/10 text-pink-400',
  Law: 'bg-amber-500/10 text-amber-400',
  Media: 'bg-orange-500/10 text-orange-400',
}

export default function AlumniCard({
  alumni,
  isInNetwork = false,
  onAddToNetwork,
  isLoading = false,
}: AlumniCardProps) {
  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 hover:border-[--border-secondary] transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-base font-semibold mb-0.5">{alumni.full_name}</h3>
          <p className="text-[--text-tertiary] text-sm">
            {alumni.sport} • Class of {alumni.graduation_year}
          </p>
        </div>
        {alumni.industry && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${
              industryBadgeClass[alumni.industry] || 'bg-[--bg-tertiary] text-[--text-secondary]'
            }`}
          >
            {alumni.industry}
          </span>
        )}
      </div>

      <div className="mb-4">
        <p className="text-sm font-medium text-[--text-primary] mb-0.5">{alumni.role}</p>
        <p className="text-[--text-tertiary] text-sm">{alumni.company}</p>
        {alumni.location && (
          <p className="text-[--text-quaternary] text-sm mt-1 flex items-center gap-1">
            <MapPin size={12} />
            {alumni.location}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAddToNetwork?.(alumni.id)}
          disabled={isInNetwork || isLoading}
          className={`flex-1 flex items-center justify-center gap-2 ${
            isInNetwork ? 'btn-success' : 'btn-primary'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : isInNetwork ? (
            <>
              <Check size={16} />
              In Network
            </>
          ) : (
            <>
              <Plus size={16} />
              Add to Network
            </>
          )}
        </button>
        
        {alumni.linkedin_url && (
          <a
            href={alumni.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost p-2.5 hover:text-[#0077b5]"
            title="View LinkedIn"
          >
            <Linkedin size={16} />
          </a>
        )}
      </div>
    </div>
  )
}