'use client'

import { UserNetwork } from '@/types/database'
import { Check, Mail, X, Linkedin } from 'lucide-react'

interface NetworkRowProps {
  connection: UserNetwork
  onSendMessage: (connection: UserNetwork) => void
  onRemove: (id: string) => void
  isRemoving?: boolean
}

const industryBadgeClass: Record<string, string> = {
  Finance: 'badge-finance',
  Technology: 'badge-technology',
  Consulting: 'badge-consulting',
  Healthcare: 'badge-healthcare',
  Law: 'badge-law',
  Media: 'badge-media',
}

export default function NetworkRow({
  connection,
  onSendMessage,
  onRemove,
  isRemoving = false,
}: NetworkRowProps) {
  const alumni = connection.alumni

  if (!alumni) return null

  return (
    <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 flex items-center justify-between gap-5 flex-wrap animate-fade-in">
      <div className="flex items-center gap-4 flex-1 min-w-0">
        {/* Contacted status indicator */}
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0 ${
            connection.contacted
              ? 'bg-gradient-to-br from-green-500 to-green-600'
              : 'bg-white/10'
          }`}
        >
          {connection.contacted && <Check size={14} />}
        </div>

        <div className="min-w-0">
          <h3 className="text-base font-semibold truncate">{alumni.full_name}</h3>
          <p className="text-white/50 text-sm truncate">
            {alumni.role} at {alumni.company}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {alumni.industry && (
          <span
            className={`px-3 py-1 rounded-md text-xs font-semibold hidden sm:block ${
              industryBadgeClass[alumni.industry] || 'bg-white/10 text-white/70'
            }`}
          >
            {alumni.industry}
          </span>
        )}

        {alumni.linkedin_url && (
          <a
            href={alumni.linkedin_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2.5 rounded-xl bg-white/5 hover:bg-[#0077b5]/20 hover:text-[#0077b5] transition-all"
            title="View LinkedIn"
          >
            <Linkedin size={16} />
          </a>
        )}

        <button
          onClick={() => onSendMessage(connection)}
          disabled={connection.contacted}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            connection.contacted
              ? 'bg-green-500/15 text-green-500 cursor-default'
              : 'bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/30'
          }`}
        >
          {connection.contacted ? (
            <>
              <Check size={14} />
              Contacted
            </>
          ) : (
            <>
              <Mail size={14} />
              Message
            </>
          )}
        </button>

        <button
          onClick={() => onRemove(connection.id)}
          disabled={isRemoving}
          className="p-2.5 rounded-xl border border-white/10 bg-transparent text-white/40 hover:border-red-500 hover:text-red-500 transition-all"
          title="Remove from network"
        >
          {isRemoving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <X size={16} />
          )}
        </button>
      </div>
    </div>
  )
}
