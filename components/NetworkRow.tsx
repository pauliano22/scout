'use client'

import { useState } from 'react'
import { UserNetwork } from '@/types/database'
import { Check, Mail, X, Linkedin, StickyNote, Calendar } from 'lucide-react'

interface NetworkRowProps {
  connection: UserNetwork
  onSendMessage: (connection: UserNetwork) => void
  onRemove: (id: string) => void
  onOpenNotes: (connection: UserNetwork) => void
  onUpdateContactedDate: (connectionId: string, date: string | null) => void
  onOpenDetail: (connection: UserNetwork) => void
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

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function toInputDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function NetworkRow({
  connection,
  onSendMessage,
  onRemove,
  onOpenNotes,
  onUpdateContactedDate,
  onOpenDetail,
  isRemoving = false,
}: NetworkRowProps) {
  const [showDatePicker, setShowDatePicker] = useState(false)
  const alumni = connection.alumni

  if (!alumni) return null

  const hasNotes = connection.notes && connection.notes.trim().length > 0

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value
    if (newDate) {
      const [year, month, day] = newDate.split('-').map(Number)
      const localDate = new Date(year, month - 1, day, 12, 0, 0)
      onUpdateContactedDate(connection.id, localDate.toISOString())
    }
    setShowDatePicker(false)
  }

  return (
    <div 
      className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap hover:border-[--border-secondary] transition-colors cursor-pointer"
      onClick={() => onOpenDetail(connection)}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Contacted status indicator */}
        <div
          className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
            connection.contacted
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-[--bg-tertiary] border border-[--border-primary]'
          }`}
        >
          {connection.contacted && <Check size={12} />}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold truncate">{alumni.full_name}</h3>
          <p className="text-[--text-tertiary] text-sm truncate">
            {alumni.role} at {alumni.company}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {alumni.industry && (
          <span
            className={`px-2 py-1 rounded text-xs font-medium hidden sm:block ${
              industryBadgeClass[alumni.industry] || 'bg-[--bg-tertiary] text-[--text-secondary]'
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

        {/* Notes button */}
        <button
          onClick={() => onOpenNotes(connection)}
          className={`btn-ghost p-2 ${hasNotes ? 'text-amber-400' : ''}`}
          title={hasNotes ? 'View notes' : 'Add notes'}
        >
          <StickyNote size={14} />
        </button>

        {/* Contacted button with date */}
        <div className="relative">
          <button
            onClick={() => {
              if (connection.contacted) {
                setShowDatePicker(!showDatePicker)
              } else {
                onSendMessage(connection)
              }
            }}
            className={`flex items-center gap-1.5 ${
              connection.contacted ? 'btn-success' : 'btn-primary'
            }`}
          >
            {connection.contacted ? (
              <>
                <Check size={14} />
                <span className="hidden sm:inline">
                  {connection.contacted_at ? formatDate(connection.contacted_at) : 'Contacted'}
                </span>
                <span className="sm:hidden">
                  {connection.contacted_at ? formatDate(connection.contacted_at) : '✓'}
                </span>
              </>
            ) : (
              <>
                <Mail size={14} />
                Message
              </>
            )}
          </button>

          {/* Date picker dropdown */}
          {showDatePicker && connection.contacted && (
            <div className="absolute top-full mt-1 right-0 bg-[--bg-secondary] border border-[--border-primary] rounded-lg p-3 shadow-lg z-10 animate-fade-in">
              <label className="block text-xs text-[--text-tertiary] mb-1.5">
                <Calendar size={10} className="inline mr-1" />
                Contacted on
              </label>
              <input
                type="date"
                value={toInputDate(connection.contacted_at)}
                onChange={handleDateChange}
                className="input-field text-sm py-1.5 px-2"
                autoFocus
                onBlur={() => setShowDatePicker(false)}
              />
            </div>
          )}
        </div>

        <button
          onClick={() => onRemove(connection.id)}
          disabled={isRemoving}
          className="btn-ghost p-2 text-[--text-quaternary] hover:text-red-500"
          title="Remove from network"
        >
          {isRemoving ? (
            <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : (
            <X size={14} />
          )}
        </button>
      </div>
    </div>
  )
}