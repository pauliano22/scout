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
  Finance: 'bg-emerald-500/10 text-emerald-400',
  Technology: 'bg-blue-500/10 text-blue-400',
  Consulting: 'bg-purple-500/10 text-purple-400',
  Healthcare: 'bg-pink-500/10 text-pink-400',
  Law: 'bg-amber-500/10 text-amber-400',
  Media: 'bg-orange-500/10 text-orange-400',
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
    <div className="bg-[#111113] border border-[#27272a] rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap hover:border-[#3f3f46] transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Contacted status indicator */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            connection.contacted
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-[#18181b] border border-[#27272a]'
          }`}
        >
          {connection.contacted && <Check size={12} />}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{alumni.full_name}</h3>
          <p className="text-[#71717a] text-sm truncate">
            {alumni.role} at {alumni.company}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {alumni.industry && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium hidden sm:block ${
              industryBadgeClass[alumni.industry] || 'bg-[#18181b] text-[#a1a1aa]'
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
            className="btn-ghost p-2 hover:text-[#0077b5]"
            title="View LinkedIn"
          >
            <Linkedin size={14} />
          </a>
        )}

        <button
          onClick={() => onSendMessage(connection)}
          disabled={connection.contacted}
          className={`flex items-center gap-1.5 ${
            connection.contacted ? 'btn-success' : 'btn-primary'
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
          className="btn-ghost p-2 text-[#52525b] hover:text-red-500"
          title="Remove from network"
        >
          {isRemoving ? (
            <div className="w-3.5 h-3.5 border-2 border-[#52525b] border-t-[#a1a1aa] rounded-full animate-spin" />
          ) : (
            <X size={14} />
          )}
        </button>
      </div>
    </div>
  )
}