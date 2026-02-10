'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import MessageModal from '@/components/MessageModal'
import {
  X,
  Linkedin,
  Mail,
  MessageSquare,
  Copy,
  Check,
  Phone,
  Coffee,
  Users,
  MoreHorizontal,
  Calendar,
  Trash2,
  ExternalLink
} from 'lucide-react'

interface ConnectionDetailModalProps {
  connection: UserNetwork
  userProfile: {
    name: string
    sport: string
  }
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
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [copiedEmail, setCopiedEmail] = useState(false)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  
  // Interaction tracking
  const [interactions, setInteractions] = useState<Interaction[]>(
    connection.interactions ? JSON.parse(connection.interactions) : []
  )
  const [selectedInteractionType, setSelectedInteractionType] = useState<InteractionType>('email')
  const [interactionDate, setInteractionDate] = useState(new Date().toISOString().split('T')[0])

  const handleStatusChange = async (newStatus: ConnectionStatus) => {
    setStatus(newStatus)
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ status: newStatus })
        .eq('id', connection.id)

      if (error) throw error
      onUpdate({ ...connection, status: newStatus })
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleSaveNotes = async () => {
    setIsSavingNotes(true)
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ notes })
        .eq('id', connection.id)

      if (error) throw error
      onUpdate({ ...connection, notes })
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleCopyEmail = async () => {
    if (alumni?.email) {
      await navigator.clipboard.writeText(alumni.email)
      setCopiedEmail(true)
      setTimeout(() => setCopiedEmail(false), 2000)
    }
  }

  const handleAddInteraction = async () => {
    const newInteraction: Interaction = {
      id: Date.now().toString(),
      type: selectedInteractionType,
      date: interactionDate,
      created_at: new Date().toISOString()
    }
    
    const updatedInteractions = [...interactions, newInteraction]
    setInteractions(updatedInteractions)
    
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ 
          interactions: JSON.stringify(updatedInteractions),
          contacted: true,
          contacted_at: new Date().toISOString()
        })
        .eq('id', connection.id)

      if (error) throw error
      onUpdate({ 
        ...connection, 
        interactions: JSON.stringify(updatedInteractions),
        contacted: true,
        contacted_at: new Date().toISOString()
      })
    } catch (error) {
      console.error('Error adding interaction:', error)
    }
  }

  const handleRemove = async () => {
    if (!confirm('Are you sure you want to remove this connection?')) return
    
    setIsRemoving(true)
    try {
      const { error } = await supabase
        .from('user_networks')
        .delete()
        .eq('id', connection.id)

      if (error) throw error
      onRemove(connection.id)
    } catch (error) {
      console.error('Error removing connection:', error)
      setIsRemoving(false)
    }
  }

  const interactionIcons: Record<InteractionType, typeof Mail> = {
    email: Mail,
    call: Phone,
    coffee: Coffee,
    meeting: Users,
    other: MoreHorizontal
  }

  const interactionLabels: Record<InteractionType, string> = {
    email: 'Email',
    call: 'Call',
    coffee: 'Coffee Chat',
    meeting: 'Meeting',
    other: 'Other'
  }

  // Open Google Calendar to schedule a meeting
  const handleOpenGoogleCalendar = () => {
    const title = encodeURIComponent(`Meeting with ${alumni?.full_name || 'Contact'}`)
    const details = encodeURIComponent(`Networking call with ${alumni?.full_name}${alumni?.role ? ` (${alumni.role})` : ''}${alumni?.company ? ` at ${alumni.company}` : ''}\n\nCornell Athletics Alumni Network`)

    // Default to tomorrow at 10am, 30 min duration
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    const endTime = new Date(tomorrow)
    endTime.setMinutes(endTime.getMinutes() + 30)

    // Format dates for Google Calendar (YYYYMMDDTHHmmss)
    const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const dates = `${formatDate(tomorrow)}/${formatDate(endTime)}`

    const calendarUrl = `https://calendar.google.com/calendar/u/0/r/eventedit?text=${title}&dates=${dates}&details=${details}`
    window.open(calendarUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-[--bg-primary] border border-[--border-primary] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-[--text-quaternary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] rounded-lg transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-6 overflow-y-auto max-h-[90vh]">
          {/* Top Box - Main Info */}
          <div className="card p-6 mb-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Info */}
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-[--text-primary] mb-1">
                  {alumni?.full_name}
                </h2>
                
                {(alumni?.role || alumni?.company) && (
                  <p className="text-[--text-secondary] mb-2">
                    {alumni?.role}{alumni?.role && alumni?.company && ' @ '}{alumni?.company}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[--text-tertiary] mb-4">
                  {alumni?.graduation_year && (
                    <span>Class of {alumni.graduation_year}</span>
                  )}
                  {alumni?.location && (
                    <span>{alumni.location}</span>
                  )}
                  {alumni?.sport && (
                    <span>{alumni.sport}</span>
                  )}
                </div>

                {/* Status */}
                <div className="mt-4">
                  <p className="text-xs text-[--text-quaternary] uppercase tracking-wide mb-2">Status</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => handleStatusChange('interested')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        status === 'interested'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] border border-[--border-primary] hover:bg-[--bg-hover]'
                      }`}
                    >
                      Interested
                    </button>
                    <button
                      onClick={() => handleStatusChange('awaiting_reply')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        status === 'awaiting_reply'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] border border-[--border-primary] hover:bg-[--bg-hover]'
                      }`}
                    >
                      Awaiting Reply
                    </button>
                    <button
                      onClick={() => handleStatusChange('response_needed')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        status === 'response_needed'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] border border-[--border-primary] hover:bg-[--bg-hover]'
                      }`}
                    >
                      Response Needed
                    </button>
                    <button
                      onClick={() => handleStatusChange('meeting_scheduled')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        status === 'meeting_scheduled'
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] border border-[--border-primary] hover:bg-[--bg-hover]'
                      }`}
                    >
                      Meeting Scheduled
                    </button>
                    {status === 'meeting_scheduled' && (
                      <button
                        onClick={handleOpenGoogleCalendar}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30 hover:bg-purple-500/30 transition-all flex items-center gap-1"
                        title="Opens Google Calendar in a new tab"
                      >
                        <Calendar size={12} />
                        <ExternalLink size={10} />
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange('met')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        status === 'met'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] border border-[--border-primary] hover:bg-[--bg-hover]'
                      }`}
                    >
                      Met
                    </button>
                  </div>
                </div>
              </div>

              {/* Right side - Actions */}
              <div className="flex flex-col gap-2 md:min-w-[200px]">
                {alumni?.linkedin_url && (
                  <a
                    href={alumni.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary flex items-center justify-center gap-2"
                  >
                    <Linkedin size={16} />
                    LinkedIn
                  </a>
                )}
                
                {alumni?.email && (
                  <div className="flex gap-2">
                    <a
                      href={`mailto:${alumni.email}`}
                      className="btn-secondary flex-1 flex items-center justify-center gap-2"
                    >
                      <Mail size={16} />
                      Email
                    </a>
                    <button
                      onClick={handleCopyEmail}
                      className="btn-secondary px-3"
                      title="Copy email"
                    >
                      {copiedEmail ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                )}
                
                <button
                  onClick={() => setShowMessageModal(true)}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <MessageSquare size={16} />
                  Generate Message
                </button>

                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="btn-ghost text-red-500 hover:bg-red-500/10 flex items-center justify-center gap-2 mt-2"
                >
                  <Trash2 size={16} />
                  {isRemoving ? 'Removing...' : 'Remove'}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row - Two Boxes */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Notes Box */}
            <div className="card p-4">
              <h3 className="text-sm font-medium text-[--text-secondary] mb-3">Notes</h3>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes about this connection..."
                className="input-field min-h-[120px] resize-none text-sm"
              />
              {isSavingNotes && (
                <p className="text-xs text-[--text-quaternary] mt-2">Saving...</p>
              )}
            </div>

            {/* Interactions Box */}
            <div className="card p-4">
              <h3 className="text-sm font-medium text-[--text-secondary] mb-3">Interactions</h3>
              
              {/* Add interaction */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(Object.keys(interactionIcons) as InteractionType[]).map((type) => {
                  const Icon = interactionIcons[type]
                  return (
                    <button
                      key={type}
                      onClick={() => setSelectedInteractionType(type)}
                      className={`p-2 rounded-lg transition-all ${
                        selectedInteractionType === type
                          ? 'bg-[--school-primary] text-white'
                          : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover]'
                      }`}
                      title={interactionLabels[type]}
                    >
                      <Icon size={16} />
                    </button>
                  )
                })}
              </div>
              
              <div className="flex gap-2 mb-4">
                <div className="relative flex-1">
                  <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
                  <input
                    type="date"
                    value={interactionDate}
                    onChange={(e) => setInteractionDate(e.target.value)}
                    className="input-field !pl-10 text-sm"
                  />
                </div>
                <button
                  onClick={handleAddInteraction}
                  className="btn-primary text-sm px-4"
                >
                  Add
                </button>
              </div>

              {/* Google Calendar button for scheduling */}
              {(selectedInteractionType === 'meeting' || selectedInteractionType === 'call' || selectedInteractionType === 'coffee') && (
                <button
                  onClick={handleOpenGoogleCalendar}
                  className="w-full btn-secondary text-sm flex items-center justify-center gap-2 mb-4"
                  title="Opens Google Calendar in a new tab"
                >
                  <Calendar size={14} />
                  Add to Google Calendar
                  <ExternalLink size={10} className="opacity-50" />
                </button>
              )}

              {/* Interaction history */}
              <div className="space-y-2 max-h-[100px] overflow-y-auto">
                {interactions.length === 0 ? (
                  <p className="text-xs text-[--text-quaternary]">No interactions logged yet</p>
                ) : (
                  interactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((interaction) => {
                    const Icon = interactionIcons[interaction.type]
                    return (
                      <div key={interaction.id} className="flex items-center gap-2 text-sm text-[--text-secondary]">
                        <Icon size={14} className="text-[--text-quaternary]" />
                        <span>{interactionLabels[interaction.type]}</span>
                        <span className="text-[--text-quaternary]">•</span>
                        <span className="text-[--text-quaternary]">
                          {new Date(interaction.date).toLocaleDateString()}
                        </span>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Modal - Claude-powered with tone options */}
      {showMessageModal && (
        <MessageModal
          connection={connection}
          userSport={userProfile.sport}
          onClose={() => setShowMessageModal(false)}
          onSend={async (connectionId, message) => {
            // Mark as contacted and move to awaiting_reply
            try {
              const now = new Date().toISOString()
              await supabase
                .from('user_networks')
                .update({
                  contacted: true,
                  contacted_at: now,
                  status: 'awaiting_reply'
                })
                .eq('id', connectionId)

              setStatus('awaiting_reply')
              onUpdate({
                ...connection,
                contacted: true,
                contacted_at: now,
                status: 'awaiting_reply'
              })
            } catch (error) {
              console.error('Error marking as contacted:', error)
            }
            setShowMessageModal(false)
          }}
        />
      )}
    </div>
  )
}