'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import { 
  X, 
  Mail, 
  Linkedin, 
  Phone, 
  Coffee, 
  Video, 
  Users, 
  MessageSquare,
  Plus,
  Calendar,
  MapPin,
  Briefcase,
  GraduationCap,
  StickyNote,
  Trash2,
  Edit2,
  Check
} from 'lucide-react'

interface Interaction {
  id: string
  type: 'email' | 'linkedin' | 'phone' | 'coffee' | 'video_call' | 'in_person' | 'other'
  title: string | null
  notes: string | null
  interaction_date: string
  created_at: string
}

interface ConnectionDetailModalProps {
  connection: UserNetwork
  onClose: () => void
  onUpdate: (updatedConnection: UserNetwork) => void
}

const interactionTypes = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'phone', label: 'Phone Call', icon: Phone },
  { value: 'coffee', label: 'Coffee Chat', icon: Coffee },
  { value: 'video_call', label: 'Video Call', icon: Video },
  { value: 'in_person', label: 'In Person', icon: Users },
  { value: 'other', label: 'Other', icon: MessageSquare },
]

const getInteractionIcon = (type: string) => {
  const found = interactionTypes.find(t => t.value === type)
  return found ? found.icon : MessageSquare
}

const getInteractionLabel = (type: string) => {
  const found = interactionTypes.find(t => t.value === type)
  return found ? found.label : 'Other'
}

export default function ConnectionDetailModal({ 
  connection, 
  onClose,
  onUpdate 
}: ConnectionDetailModalProps) {
  const supabase = createClient()
  const alumni = connection.alumni

  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [isLoadingInteractions, setIsLoadingInteractions] = useState(true)
  const [notes, setNotes] = useState(connection.notes || '')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  
  // New interaction form
  const [showAddInteraction, setShowAddInteraction] = useState(false)
  const [newInteraction, setNewInteraction] = useState({
    type: 'email' as Interaction['type'],
    title: '',
    notes: '',
    interaction_date: new Date().toISOString().split('T')[0]
  })
  const [isAddingInteraction, setIsAddingInteraction] = useState(false)

  useEffect(() => {
    loadInteractions()
  }, [connection.id])

  const loadInteractions = async () => {
    setIsLoadingInteractions(true)
    try {
      const { data, error } = await supabase
        .from('interactions')
        .select('*')
        .eq('network_id', connection.id)
        .order('interaction_date', { ascending: false })

      if (error) throw error
      setInteractions(data || [])
    } catch (error) {
      console.error('Error loading interactions:', error)
    } finally {
      setIsLoadingInteractions(false)
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
      setIsEditingNotes(false)
    } catch (error) {
      console.error('Error saving notes:', error)
    } finally {
      setIsSavingNotes(false)
    }
  }

  const handleAddInteraction = async () => {
    if (!newInteraction.type) return
    
    setIsAddingInteraction(true)
    try {
      const { data, error } = await supabase
        .from('interactions')
        .insert({
          user_id: connection.user_id,
          alumni_id: connection.alumni_id,
          network_id: connection.id,
          type: newInteraction.type,
          title: newInteraction.title || null,
          notes: newInteraction.notes || null,
          interaction_date: new Date(newInteraction.interaction_date + 'T12:00:00').toISOString()
        })
        .select()
        .single()

      if (error) throw error

      setInteractions([data, ...interactions])
      setShowAddInteraction(false)
      setNewInteraction({
        type: 'email',
        title: '',
        notes: '',
        interaction_date: new Date().toISOString().split('T')[0]
      })

      // Update contacted status if not already
      if (!connection.contacted) {
        await supabase
          .from('user_networks')
          .update({ 
            contacted: true, 
            contacted_at: new Date(newInteraction.interaction_date + 'T12:00:00').toISOString() 
          })
          .eq('id', connection.id)
        
        onUpdate({ 
          ...connection, 
          contacted: true, 
          contacted_at: new Date(newInteraction.interaction_date + 'T12:00:00').toISOString() 
        })
      }
    } catch (error) {
      console.error('Error adding interaction:', error)
    } finally {
      setIsAddingInteraction(false)
    }
  }

  const handleDeleteInteraction = async (interactionId: string) => {
    if (!confirm('Delete this interaction?')) return

    try {
      const { error } = await supabase
        .from('interactions')
        .delete()
        .eq('id', interactionId)

      if (error) throw error

      setInteractions(interactions.filter(i => i.id !== interactionId))
    } catch (error) {
      console.error('Error deleting interaction:', error)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  if (!alumni) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-[--border-primary]">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold mb-1">{alumni.full_name}</h2>
              <p className="text-[--text-secondary] text-sm">
                {alumni.role} at {alumni.company}
              </p>
            </div>
            <button onClick={onClose} className="btn-ghost p-1.5">
              <X size={20} />
            </button>
          </div>

          {/* Quick info */}
          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            {alumni.industry && (
              <div className="flex items-center gap-1.5 text-[--text-tertiary]">
                <Briefcase size={14} />
                {alumni.industry}
              </div>
            )}
            {alumni.location && (
              <div className="flex items-center gap-1.5 text-[--text-tertiary]">
                <MapPin size={14} />
                {alumni.location}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[--text-tertiary]">
              <GraduationCap size={14} />
              {alumni.sport} • Class of {alumni.graduation_year}
            </div>
          </div>

          {/* Contact links */}
          <div className="flex gap-2 mt-4">
            {alumni.linkedin_url && (
              <a
                href={alumni.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <Linkedin size={14} />
                LinkedIn
              </a>
            )}
            {alumni.email && (
              <a
                href={`mailto:${alumni.email}`}
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <Mail size={14} />
                Email
              </a>
            )}
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="overflow-y-auto max-h-[calc(90vh-220px)]">
          {/* Notes Section */}
          <div className="p-6 border-b border-[--border-primary]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <StickyNote size={16} className="text-amber-400" />
                Notes
              </h3>
              {!isEditingNotes && (
                <button
                  onClick={() => setIsEditingNotes(true)}
                  className="btn-ghost p-1.5 text-xs"
                >
                  <Edit2 size={14} />
                </button>
              )}
            </div>

            {isEditingNotes ? (
              <div>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this connection..."
                  rows={3}
                  className="input-field resize-none mb-2"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setNotes(connection.notes || '')
                      setIsEditingNotes(false)
                    }}
                    className="btn-ghost text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    {isSavingNotes ? (
                      <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : (
                      <Check size={14} />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-[--text-tertiary] text-sm">
                {notes || 'No notes yet. Click edit to add some.'}
              </p>
            )}
          </div>

          {/* Timeline Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Calendar size={16} className="text-blue-400" />
                Interaction Timeline
              </h3>
              <button
                onClick={() => setShowAddInteraction(!showAddInteraction)}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {/* Add Interaction Form */}
            {showAddInteraction && (
              <div className="bg-[--bg-primary] border border-[--border-primary] rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-xs text-[--text-tertiary] mb-1.5">Type</label>
                    <select
                      value={newInteraction.type}
                      onChange={(e) => setNewInteraction({ ...newInteraction, type: e.target.value as Interaction['type'] })}
                      className="input-field text-sm"
                    >
                      {interactionTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[--text-tertiary] mb-1.5">Date</label>
                    <input
                      type="date"
                      value={newInteraction.interaction_date}
                      onChange={(e) => setNewInteraction({ ...newInteraction, interaction_date: e.target.value })}
                      className="input-field text-sm"
                    />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-[--text-tertiary] mb-1.5">Title (optional)</label>
                  <input
                    type="text"
                    value={newInteraction.title}
                    onChange={(e) => setNewInteraction({ ...newInteraction, title: e.target.value })}
                    placeholder="e.g., Initial outreach, Follow-up call"
                    className="input-field text-sm"
                  />
                </div>
                <div className="mb-3">
                  <label className="block text-xs text-[--text-tertiary] mb-1.5">Notes (optional)</label>
                  <textarea
                    value={newInteraction.notes}
                    onChange={(e) => setNewInteraction({ ...newInteraction, notes: e.target.value })}
                    placeholder="What did you discuss?"
                    rows={2}
                    className="input-field text-sm resize-none"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowAddInteraction(false)}
                    className="btn-ghost text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddInteraction}
                    disabled={isAddingInteraction}
                    className="btn-primary text-sm flex items-center gap-1.5"
                  >
                    {isAddingInteraction ? (
                      <div className="w-3.5 h-3.5 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    ) : (
                      <Plus size={14} />
                    )}
                    Add Interaction
                  </button>
                </div>
              </div>
            )}

            {/* Timeline */}
            {isLoadingInteractions ? (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-[--border-primary] border-t-[--text-secondary] rounded-full animate-spin mx-auto" />
              </div>
            ) : interactions.length === 0 ? (
              <div className="text-center py-8 text-[--text-quaternary] text-sm">
                <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                <p>No interactions yet</p>
                <p className="text-xs mt-1">Add your first interaction above</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-px bg-[--border-primary]" />

                {/* Timeline items */}
                <div className="space-y-4">
                  {interactions.map((interaction) => {
                    const IconComponent = getInteractionIcon(interaction.type)
                    return (
                      <div key={interaction.id} className="relative flex gap-4 group">
                        {/* Icon */}
                        <div className="relative z-10 w-10 h-10 rounded-lg bg-[--bg-tertiary] border border-[--border-primary] flex items-center justify-center flex-shrink-0">
                          <IconComponent size={16} className="text-[--text-secondary]" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 bg-[--bg-primary] border border-[--border-primary] rounded-lg p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">
                                {interaction.title || getInteractionLabel(interaction.type)}
                              </p>
                              <p className="text-xs text-[--text-quaternary]">
                                {formatDate(interaction.interaction_date)}
                              </p>
                            </div>
                            <button
                              onClick={() => handleDeleteInteraction(interaction.id)}
                              className="btn-ghost p-1 opacity-0 group-hover:opacity-100 text-[--text-quaternary] hover:text-red-500"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          {interaction.notes && (
                            <p className="text-sm text-[--text-tertiary] mt-2">
                              {interaction.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}