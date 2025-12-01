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
  Finance: 'badge-finance',
  Technology: 'badge-technology',
  Consulting: 'badge-consulting',
  Healthcare: 'badge-healthcare',
  Law: 'badge-law',
  Media: 'badge-media',
}

export default function AlumniCard({
  alumni,
  isInNetwork = false,
  onAddToNetwork,
  isLoading = false,
}: AlumniCardProps) {
  return (
    <div className="alumni-card bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">{alumni.full_name}</h3>
          <p className="text-white/50 text-sm">
            {alumni.sport} • Class of {alumni.graduation_year}
          </p>
        </div>
        {alumni.industry && (
          <span
            className={`px-3 py-1 rounded-md text-xs font-semibold ${
              industryBadgeClass[alumni.industry] || 'bg-white/10 text-white/70'
            }`}
          >
            {alumni.industry}
          </span>
        )}
      </div>

      <div className="mb-5">
        <p className="text-[15px] font-medium mb-0.5">{alumni.role}</p>
        <p className="text-white/50 text-sm">{alumni.company}</p>
        {alumni.location && (
          <p className="text-white/35 text-sm mt-1 flex items-center gap-1">
            <MapPin size={12} />
            {alumni.location}
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onAddToNetwork?.(alumni.id)}
          disabled={isInNetwork || isLoading}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all ${
            isInNetwork
              ? 'bg-green-500/15 text-green-500 cursor-default'
              : 'bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/30 hover:shadow-cornell-red/50'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
            className="p-3 rounded-xl bg-white/5 hover:bg-[#0077b5]/20 hover:text-[#0077b5] transition-all"
            title="View LinkedIn"
          >
            <Linkedin size={18} />
          </a>
        )}
      </div>
    </div>
  )
}
