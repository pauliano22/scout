'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork, PlanCustomContact } from '@/types/database'
import MessageModal from '@/components/MessageModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import Avatar from '@/components/Avatar'
import { statusConfig, type CRMStatus } from '@/lib/statusConfig'
import { Search, Plus, X, Linkedin, Loader2, ChevronRight } from 'lucide-react'
import { cleanField } from '@/lib/cleanField'

interface NetworkClientProps {
  initialNetwork: UserNetwork[]
  userId: string
  userProfile: { name: string; sport: string }
  initialCustomContacts: PlanCustomContact[]
}

type StatusFilter = 'all' | CRMStatus

const STATUS_DOT: Record<CRMStatus, string> = {
  interested:        'bg-blue-400',
  awaiting_reply:    'bg-amber-400',
  response_needed:   'bg-red-400',
  meeting_scheduled: 'bg-purple-400',
  met:               'bg-emerald-400',
}

const NEXT_ACTION: Record<CRMStatus, string> = {
  interested:        'Send Intro',
  awaiting_reply:    'Follow Up',
  response_needed:   'Reply',
  meeting_scheduled: 'Prep Call',
  met:               'Log Notes',
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

export default function NetworkClient({
  initialNetwork,
  userId,
  userProfile,
  initialCustomContacts,
}: NetworkClientProps) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const highlightId = searchParams.get('highlight')

  const [network, setNetwork] = useState<UserNetwork[]>(initialNetwork)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selectedConnection, setSelectedConnection] = useState<UserNetwork | null>(null)
  const [detailConnection, setDetailConnection] = useState<UserNetwork | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [customContacts, setCustomContacts] = useState<PlanCustomContact[]>(initialCustomContacts)
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', company: '', role: '', linkedin_url: '', notes: '' })
  const [isAddingContact, setIsAddingContact] = useState(false)
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    if (!highlightId) return
    const connection = network.find(c => c.alumni_id === highlightId)
    if (!connection) return
    setHighlightedId(connection.id)
    setTimeout(() => {
      rowRefs.current.get(connection.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 100)
    setTimeout(() => setHighlightedId(null), 3000)
  }, [highlightId, network])

  const getStatus = (conn: UserNetwork): CRMStatus => conn.status || 'interested'

  const statusCounts = useMemo(() => {
    const counts: Record<CRMStatus, number> = {
      interested: 0, awaiting_reply: 0, response_needed: 0, meeting_scheduled: 0, met: 0,
    }
    network.forEach(c => { counts[getStatus(c)]++ })
    return counts
  }, [network])

  const filteredNetwork = useMemo(() => {
    let filtered = network
    if (statusFilter !== 'all') {
      if (statusFilter === 'meeting_scheduled') {
        filtered = filtered.filter(c => getStatus(c) === 'meeting_scheduled' || getStatus(c) === 'met')
      } else {
        filtered = filtered.filter(c => getStatus(c) === statusFilter)
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(({ alumni }) =>
        alumni?.full_name.toLowerCase().includes(q) ||
        alumni?.company?.toLowerCase().includes(q) ||
        alumni?.role?.toLowerCase().includes(q)
      )
    }
    return filtered
  }, [network, searchQuery, statusFilter])

  const handleUpdateConnection = (updated: UserNetwork) => {
    setNetwork(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (detailConnection?.id === updated.id) setDetailConnection(updated)
  }

  const handleRemoveConnection = (id: string) => {
    setNetwork(prev => prev.filter(c => c.id !== id))
    setDetailConnection(null)
  }

  const handleSendMessage = async (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => {
    try {
      const connection = network.find(c => c.id === connectionId)
      if (!connection) return
      const now = new Date().toISOString()
      await supabase.from('user_networks').update({ contacted: true, contacted_at: now, status: 'awaiting_reply' }).eq('id', connectionId)
      await supabase.from('messages').insert({ user_id: userId, alumni_id: connection.alumni_id, message_content: message, sent_via: sentVia })
      setNetwork(prev => prev.map(c => c.id === connectionId ? { ...c, contacted: true, contacted_at: now, status: 'awaiting_reply' as const } : c))
    } catch (err) { console.error('handleSendMessage:', err) }
    if (sentVia === 'marked') setSelectedConnection(null)
  }

  const handleNextAction = (e: React.MouseEvent, connection: UserNetwork) => {
    e.stopPropagation()
    const status = getStatus(connection)
    if (status === 'interested' || status === 'awaiting_reply') {
      setSelectedConnection(connection)
    } else {
      setDetailConnection(connection)
    }
  }

  const setRowRef = (id: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(id, el)
    else rowRefs.current.delete(id)
  }

  const handleAddCustomContact = async () => {
    if (!contactForm.name.trim()) return
    setIsAddingContact(true)
    const { data, error } = await supabase
      .from('plan_custom_contacts')
      .insert({ plan_id: null, user_id: userId, ...contactForm, company: contactForm.company || null, role: contactForm.role || null, linkedin_url: contactForm.linkedin_url || null, notes: contactForm.notes || null })
      .select().single()
    if (!error && data) {
      setCustomContacts(prev => [...prev, data])
      setContactForm({ name: '', company: '', role: '', linkedin_url: '', notes: '' })
      setShowAddContact(false)
    }
    setIsAddingContact(false)
  }

  // Filter tab config
  const tabs: { key: StatusFilter; label: string; count?: number }[] = [
    { key: 'all',               label: 'All',     count: network.length },
    { key: 'interested',        label: 'New',     count: statusCounts.interested },
    { key: 'awaiting_reply',    label: 'Sent',    count: statusCounts.awaiting_reply },
    { key: 'response_needed',   label: 'Replied', count: statusCounts.response_needed },
    { key: 'meeting_scheduled', label: 'Met',     count: statusCounts.meeting_scheduled + statusCounts.met },
  ]

  const urgentCount = statusCounts.response_needed

  return (
    <main className="max-w-3xl mx-auto px-5 md:px-8 py-10">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[--text-primary]">My Network</h1>
          <p className="text-sm text-[--text-quaternary] mt-0.5">
            {network.length} {network.length === 1 ? 'connection' : 'connections'}
            {urgentCount > 0 && (
              <span className="ml-2 text-red-400">
                · {urgentCount} need{urgentCount === 1 ? 's' : ''} your reply
              </span>
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-52 flex-shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-lg pl-9 pr-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-quaternary] focus:outline-none focus:border-[--school-primary] focus:ring-1 focus:ring-[--school-primary]/30 transition-colors"
          />
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-[--border-primary]">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`relative px-3 pb-2.5 text-sm font-medium transition-colors ${
              statusFilter === tab.key
                ? 'text-[--text-primary]'
                : 'text-[--text-quaternary] hover:text-[--text-secondary]'
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={`ml-1.5 text-xs tabular-nums ${statusFilter === tab.key ? 'text-[--text-secondary]' : 'text-[--text-quaternary]'}`}>
                {tab.count}
              </span>
            )}
            {statusFilter === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--school-primary] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* ── Connection List ── */}
      {filteredNetwork.length === 0 ? (
        <div className="text-center py-20">
          {network.length === 0 ? (
            <>
              <p className="text-[--text-secondary] mb-1">Your network is empty</p>
              <p className="text-xs text-[--text-quaternary] mb-5">Discover alumni to start building your network</p>
              <a href="/discover" className="btn-primary inline-flex items-center gap-2 text-sm">
                Browse Alumni <ChevronRight size={14} />
              </a>
            </>
          ) : (
            <p className="text-sm text-[--text-quaternary]">No matches for "{searchQuery}"</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-[--border-primary]">
          {filteredNetwork.map(connection => {
            const status = getStatus(connection)
            const sConfig = statusConfig[status]
            const role = cleanField(connection.alumni?.role)
            const company = cleanField(connection.alumni?.company)
            const lastTouched = formatRelativeDate(connection.contacted_at || connection.created_at)
            const isUrgent = status === 'response_needed'

            return (
              <div
                key={connection.id}
                ref={el => setRowRef(connection.id, el)}
                onClick={() => setDetailConnection(connection)}
                className={`group flex items-center gap-3.5 px-1 py-3.5 cursor-pointer transition-colors hover:bg-[--bg-secondary] rounded-xl -mx-1 ${
                  highlightedId === connection.id ? 'ring-2 ring-[--school-primary] rounded-xl bg-[--bg-secondary]' : ''
                }`}
              >
                <Avatar
                  name={connection.alumni?.full_name || '?'}
                  sport={connection.alumni?.sport}
                  imageUrl={connection.alumni?.avatar_url || connection.alumni?.photo_url}
                  size="md"
                />

                <div className="flex-1 min-w-0">
                  {/* Name + status */}
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[--text-primary] truncate text-sm">
                      {connection.alumni?.full_name}
                    </span>
                    <span className="flex items-center gap-1 flex-shrink-0">
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
                      <span className={`text-xs ${isUrgent ? 'text-red-400 font-medium' : 'text-[--text-quaternary]'}`}>
                        {sConfig.label}
                      </span>
                    </span>
                  </div>

                  {/* Role + Company */}
                  {(role || company) && (
                    <p className="text-xs text-[--text-secondary] truncate mt-0.5">
                      {role && company ? `${role} · ${company}` : role || company}
                    </p>
                  )}

                  {/* Meta row */}
                  <p className="text-xs text-[--text-quaternary] mt-0.5">
                    {[
                      connection.alumni?.sport,
                      connection.alumni?.graduation_year ? `'${String(connection.alumni.graduation_year).slice(-2)}` : null,
                      lastTouched ? `· ${lastTouched}` : null,
                    ].filter(Boolean).join(' ')}
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={e => handleNextAction(e, connection)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isUrgent
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'text-[--text-quaternary] hover:text-[--text-secondary] hover:bg-[--bg-tertiary]'
                  }`}
                >
                  {NEXT_ACTION[status]}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Custom Contacts ── */}
      <div className="mt-14 pt-8 border-t border-[--border-primary]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-semibold text-[--text-primary]">Custom Contacts</h2>
            <p className="text-xs text-[--text-quaternary] mt-0.5">People outside the alumni directory</p>
          </div>
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="flex items-center gap-1.5 text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
          >
            {showAddContact ? <X size={13} /> : <Plus size={13} />}
            {showAddContact ? 'Cancel' : 'Add'}
          </button>
        </div>

        {showAddContact && (
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-2.5 mb-2.5">
              <input type="text" placeholder="Name *" value={contactForm.name} onChange={e => setContactForm(p => ({ ...p, name: e.target.value }))} className="input-field text-sm" />
              <input type="text" placeholder="Company" value={contactForm.company} onChange={e => setContactForm(p => ({ ...p, company: e.target.value }))} className="input-field text-sm" />
              <input type="text" placeholder="Role" value={contactForm.role} onChange={e => setContactForm(p => ({ ...p, role: e.target.value }))} className="input-field text-sm" />
              <input type="text" placeholder="LinkedIn URL" value={contactForm.linkedin_url} onChange={e => setContactForm(p => ({ ...p, linkedin_url: e.target.value }))} className="input-field text-sm" />
            </div>
            <input type="text" placeholder="Notes" value={contactForm.notes} onChange={e => setContactForm(p => ({ ...p, notes: e.target.value }))} className="input-field text-sm mb-3" />
            <button
              onClick={handleAddCustomContact}
              disabled={!contactForm.name.trim() || isAddingContact}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {isAddingContact ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {isAddingContact ? 'Adding…' : 'Add Contact'}
            </button>
          </div>
        )}

        {customContacts.length > 0 ? (
          <div className="divide-y divide-[--border-primary]">
            {customContacts.map(contact => (
              <div key={contact.id} className="flex items-center gap-3 py-3">
                <Avatar name={contact.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[--text-primary]">{contact.name}</p>
                  {(contact.role || contact.company) && (
                    <p className="text-xs text-[--text-secondary]">
                      {contact.role && contact.company ? `${contact.role} · ${contact.company}` : contact.role || contact.company}
                    </p>
                  )}
                  {contact.notes && <p className="text-xs text-[--text-quaternary] mt-0.5 truncate">{contact.notes}</p>}
                </div>
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-[--text-quaternary] hover:text-[#0077b5] transition-colors p-1">
                    <Linkedin size={14} />
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : !showAddContact && (
          <p className="text-xs text-[--text-quaternary] py-4">No custom contacts yet.</p>
        )}
      </div>

      {selectedConnection && (
        <MessageModal connection={selectedConnection} userSport={userProfile.sport} onClose={() => setSelectedConnection(null)} onSend={handleSendMessage} />
      )}
      {detailConnection && (
        <ConnectionDetailModal connection={detailConnection} userProfile={userProfile} onClose={() => setDetailConnection(null)} onUpdate={handleUpdateConnection} onRemove={handleRemoveConnection} />
      )}
    </main>
  )
}
