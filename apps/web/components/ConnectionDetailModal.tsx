'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@scout/shared/types/database'
import MessageModal from '@/components/MessageModal'
import Avatar from '@/components/Avatar'
import { cleanField } from '@/lib/cleanField'
import { X, Linkedin, Mail, Phone, Coffee, Users, Calendar, Copy, Check, ExternalLink } from 'lucide-react'

interface ConnectionDetailModalProps {
  connection: UserNetwork
  userProfile: { name: string; sport: string }
  onClose: () => void
  onUpdate: (connection: UserNetwork) => void
  onRemove: (connectionId: string) => void
}

type ConnectionStatus = 'interested' | 'awaiting_reply' | 'response_needed' | 'meeting_scheduled' | 'met'
type InteractionType = 'email' | 'call' | 'coffee' | 'meeting' | 'other'

interface Interaction {
  id: string
  type: InteractionType
  date: string
  created_at: string
}

const STATUS_STEPS: { key: ConnectionStatus; label: string; dot: string }[] = [
  { key: 'interested',        label: 'New',     dot: 'bg-blue-400' },
  { key: 'awaiting_reply',    label: 'Sent',    dot: 'bg-amber-400' },
  { key: 'response_needed',   label: 'Replied', dot: 'bg-red-400' },
  { key: 'meeting_scheduled', label: 'Meeting', dot: 'bg-purple-400' },
  { key: 'met',               label: 'Met',     dot: 'bg-emerald-400' },
]

const INTERACTION_LABELS: Record<InteractionType, string> = {
  email:   'Email',
  call:    'Call',
  coffee:  'Coffee',
  meeting: 'Meeting',
  other:   'Other',
}

const INTERACTION_ICONS: Record<InteractionType, typeof Mail> = {
  email:   Mail,
  call:    Phone,
  coffee:  Coffee,
  meeting: Users,
  other:   Calendar,
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatRelativeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

export default function ConnectionDetailModal({
  connection,
  userProfile,
  onClose,
  onUpdate,
  onRemove,
}: ConnectionDetailModalProps) {
  const supabase = createClient()
  const alumni = connection.alumni

  const [status, setStatus] = useState<ConnectionStatus>((connection.status as ConnectionStatus) || 'interested')
  const [notes, setNotes] = useState(connection.notes || '')
  const [savedNotes, setSavedNotes] = useState(connection.notes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  const [interactions, setInteractions] = useState<Interaction[]>(
    connection.interactions ? JSON.parse(connection.interactions) : []
  )
  const [logType, setLogType] = useState<InteractionType>('email')
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0])

  const handleStatusChange = async (newStatus: ConnectionStatus) => {
    setStatus(newStatus)
    // Stamp the first-touch timestamps the status implies — this dropdown used
    // to write status alone, which left contacted_at/replied_at forever null
    // and blinded the AD report's reply metrics. Conditions live in JS and the
    // mutation stays a plain .eq update (.or() on mutations 400s here).
    const patch: Partial<UserNetwork> = { status: newStatus }
    const nowIso = new Date().toISOString()
    if (['awaiting_reply', 'response_needed', 'meeting_scheduled', 'met'].includes(newStatus) && !connection.contacted_at) {
      patch.contacted = true
      patch.contacted_at = nowIso
    }
    if (['response_needed', 'meeting_scheduled', 'met'].includes(newStatus) && !connection.replied_at) {
      patch.replied_at = nowIso
    }
    try {
      const { error } = await supabase.from('user_networks').update(patch).eq('id', connection.id)
      if (error) throw error
      onUpdate({ ...connection, ...patch })
    } catch (err) { console.error('status update:', err) }
  }

  const handleSaveNotes = async () => {
    if (notes === savedNotes) return
    setIsSavingNotes(true)
    try {
      const { error } = await supabase.from('user_networks').update({ notes }).eq('id', connection.id)
      if (error) throw error
      setSavedNotes(notes)
      onUpdate({ ...connection, notes })
    } catch (err) { console.error('save notes:', err) }
    finally { setIsSavingNotes(false) }
  }

  const handleCopyEmail = async () => {
    if (!alumni?.email) return
    await navigator.clipboard.writeText(alumni.email)
    setCopiedEmail(true)
    setTimeout(() => setCopiedEmail(false), 2000)
  }

  const handleLogInteraction = async () => {
    const entry: Interaction = {
      id: Date.now().toString(),
      type: logType,
      date: logDate,
      created_at: new Date().toISOString(),
    }
    const updated = [...interactions, entry]
    setInteractions(updated)
    try {
      const { error } = await supabase.from('user_networks').update({
        interactions: JSON.stringify(updated),
        contacted: true,
        contacted_at: new Date().toISOString(),
      }).eq('id', connection.id)
      if (error) throw error
      onUpdate({ ...connection, interactions: JSON.stringify(updated), contacted: true, contacted_at: new Date().toISOString() })
    } catch (err) { console.error('log interaction:', err) }
  }

  const handleRemove = async () => {
    setIsRemoving(true)
    try {
      const { error } = await supabase.from('user_networks').delete().eq('id', connection.id)
      if (error) throw error
      onRemove(connection.id)
    } catch (err) {
      console.error('remove:', err)
      setIsRemoving(false)
    }
  }

  const handleOpenCalendar = () => {
    const title = encodeURIComponent(`Meeting with ${alumni?.full_name || 'Contact'}`)
    const details = encodeURIComponent(`Networking call with ${alumni?.full_name}${alumni?.role ? ` (${alumni.role})` : ''}${alumni?.company ? ` at ${alumni.company}` : ''}\n\nCornell Athletics Alumni Network`)
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); tomorrow.setHours(10, 0, 0, 0)
    const end = new Date(tomorrow); end.setMinutes(end.getMinutes() + 30)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    window.open(`https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&dates=${fmt(tomorrow)}/${fmt(end)}&details=${details}`, '_blank')
  }

  const role = cleanField(alumni?.role)
  const company = cleanField(alumni?.company)
  const lastTouched = formatRelativeDate(connection.contacted_at)
  const currentStep = STATUS_STEPS.find(s => s.key === status)

  const sortedInteractions = [...interactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[--bg-primary] border border-[--border-primary] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg overflow-hidden">
        {/* Close */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-[--text-quaternary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] rounded-lg transition-colors z-10">
          <X size={17} />
        </button>

        <div className="overflow-y-auto max-h-[92vh]">

          {/* ── Header ── */}
          <div className="px-6 pt-6 pb-5">
            <div className="flex items-start gap-4 mb-5">
              <Avatar
                name={alumni?.full_name || '?'}
                sport={alumni?.sport}
                imageUrl={alumni?.avatar_url || alumni?.photo_url}
                size="xl"
                className="flex-shrink-0 mt-0.5"
              />
              <div className="flex-1 min-w-0 pr-7">
                <h2 className="text-xl font-semibold text-[--text-primary] leading-tight">{alumni?.full_name}</h2>
                {(role || company) && (
                  <p className="text-sm text-[--text-secondary] mt-0.5 leading-snug">
                    {role && company ? `${role} · ${company}` : role || company}
                  </p>
                )}
                <p className="text-xs text-[--text-quaternary] mt-1.5 flex flex-wrap gap-x-2">
                  {alumni?.sport && <span>{alumni.sport}</span>}
                  {alumni?.graduation_year && <span>'{String(alumni.graduation_year).slice(-2)}</span>}
                  {alumni?.location && <span>{alumni.location}</span>}
                  {lastTouched && <span className="text-[--text-quaternary]">· Last contacted {lastTouched}</span>}
                </p>
              </div>
            </div>

            {/* ── Status track ── */}
            <div className="flex items-center gap-1 bg-[--bg-secondary] rounded-xl p-1">
              {STATUS_STEPS.map(step => (
                <button
                  key={step.key}
                  onClick={() => handleStatusChange(step.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    status === step.key
                      ? 'bg-[--bg-primary] text-[--text-primary] shadow-sm'
                      : 'text-[--text-quaternary] hover:text-[--text-secondary]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${step.dot} ${status !== step.key ? 'opacity-40' : ''}`} />
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Primary CTA ── */}
          <div className="px-6 pb-4 flex flex-col gap-2">
            <button
              onClick={() => setShowMessageModal(true)}
              className="w-full btn-primary py-2.5 text-sm font-medium"
            >
              Write Message
            </button>

            {/* Secondary links */}
            <div className="flex items-center gap-2">
              {alumni?.linkedin_url && (
                <a href={alumni.linkedin_url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[--text-secondary] hover:text-[--text-primary] bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] rounded-lg py-2 transition-colors">
                  <Linkedin size={13} /> LinkedIn
                </a>
              )}
              {alumni?.email && (
                <a href={`mailto:${alumni.email}`}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[--text-secondary] hover:text-[--text-primary] bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] rounded-lg py-2 transition-colors">
                  <Mail size={13} /> Email
                </a>
              )}
              {alumni?.email && (
                <button onClick={handleCopyEmail}
                  className="px-3 py-2 text-xs text-[--text-secondary] hover:text-[--text-primary] bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] rounded-lg transition-colors"
                  title="Copy email">
                  {copiedEmail ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                </button>
              )}
              {!alumni?.linkedin_url && !alumni?.email && (
                <span className="flex-1 text-center text-xs text-[--text-quaternary] py-2">
                  Contact available when this alum joins Scout
                </span>
              )}
              {(status === 'meeting_scheduled' || status === 'met') && (
                <button onClick={handleOpenCalendar}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[--text-secondary] hover:text-[--text-primary] bg-[--bg-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary] rounded-lg py-2 transition-colors">
                  <Calendar size={13} /> Calendar <ExternalLink size={10} className="opacity-50" />
                </button>
              )}
            </div>
          </div>

          {/* ── Notes ── */}
          <div className="px-6 pb-5 border-t border-[--border-primary] pt-5">
            <p className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-2">Notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="What did you talk about? What's your plan? Any context that'll help next time…"
              rows={4}
              className="w-full bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-quaternary] resize-none outline-none leading-relaxed"
            />
            {isSavingNotes && <p className="text-xs text-[--text-quaternary] mt-1">Saving…</p>}
            {!isSavingNotes && notes !== savedNotes && (
              <p className="text-xs text-[--text-quaternary] mt-1">Unsaved changes</p>
            )}
          </div>

          {/* ── Interactions ── */}
          <div className="px-6 pb-5 border-t border-[--border-primary] pt-5">
            <p className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-3">Interactions</p>

            {/* Log row */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1">
                {(Object.keys(INTERACTION_LABELS) as InteractionType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setLogType(type)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      logType === type
                        ? 'bg-[--school-primary] text-white'
                        : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary]'
                    }`}
                  >
                    {INTERACTION_LABELS[type]}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={logDate}
                onChange={e => setLogDate(e.target.value)}
                className="flex-1 bg-[--bg-secondary] border border-[--border-primary] rounded-lg px-2.5 py-1 text-xs text-[--text-primary] focus:outline-none focus:border-[--school-primary] transition-colors min-w-0"
              />
              <button onClick={handleLogInteraction} className="btn-primary text-xs px-3 py-1.5 flex-shrink-0">
                Log
              </button>
            </div>

            {/* Timeline */}
            {sortedInteractions.length === 0 ? (
              <p className="text-xs text-[--text-quaternary]">No interactions logged yet.</p>
            ) : (
              <div className="space-y-2">
                {sortedInteractions.map((item, i) => {
                  const Icon = INTERACTION_ICONS[item.type]
                  return (
                    <div key={item.id} className="flex items-center gap-3 text-xs text-[--text-secondary]">
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-[--border-secondary]" />
                        {i < sortedInteractions.length - 1 && (
                          <div className="w-px h-4 bg-[--border-primary] mt-1" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 pb-2">
                        <Icon size={12} className="text-[--text-quaternary]" />
                        <span>{INTERACTION_LABELS[item.type]}</span>
                        <span className="text-[--text-quaternary]">{formatDate(item.date)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Danger zone ── */}
          <div className="px-6 pb-6 border-t border-[--border-primary] pt-4">
            {showRemoveConfirm ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-[--text-secondary]">Remove this connection?</span>
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="text-xs text-red-400 hover:text-red-300 font-medium transition-colors"
                >
                  {isRemoving ? 'Removing…' : 'Yes, remove'}
                </button>
                <button onClick={() => setShowRemoveConfirm(false)} className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowRemoveConfirm(true)}
                className="text-xs text-[--text-quaternary] hover:text-red-400 transition-colors"
              >
                Remove from network
              </button>
            )}
          </div>
        </div>
      </div>

      {showMessageModal && (
        <MessageModal
          connection={connection}
          userSport={userProfile.sport}
          onClose={() => setShowMessageModal(false)}
          onSend={async (connectionId, message) => {
            try {
              const now = new Date().toISOString()
              await supabase.from('user_networks').update({ contacted: true, contacted_at: now, status: 'awaiting_reply' }).eq('id', connectionId)
              setStatus('awaiting_reply')
              onUpdate({ ...connection, contacted: true, contacted_at: now, status: 'awaiting_reply' })
            } catch (err) { console.error('send message:', err) }
            setShowMessageModal(false)
          }}
        />
      )}
    </div>
  )
}
