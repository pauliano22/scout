'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork, PlanCustomContact } from '@scout/shared/types/database'
import MessageModal from '@/components/MessageModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import Avatar from '@/components/Avatar'
import SportAvatar from '@/components/SportAvatar'
import { type CRMStatus } from '@/lib/statusConfig'
import { Search, Plus, X, Linkedin, Loader2, ChevronRight } from 'lucide-react'
import { cleanField } from '@/lib/cleanField'
import { trackEvent } from '@/lib/track'

type Outcome = NonNullable<UserNetwork['outcome']>

const OUTCOME_OPTIONS: Array<{ value: Outcome; label: string }> = [
  { value: 'helpful_convo', label: 'Good convo' },
  { value: 'referral', label: 'Referral' },
  { value: 'interview', label: 'Interview' },
  { value: 'offer', label: 'Offer' },
]

interface NetworkClientProps {
  initialNetwork: UserNetwork[]
  userId: string
  userProfile: { name: string; sport: string }
  initialCustomContacts: PlanCustomContact[]
}

type StatusFilter = 'all' | CRMStatus

// One accent: neutral dots everywhere, red reserved for the state that needs
// the student's attention. The filter tabs carry the rest of the meaning.
const STATUS_DOT: Record<CRMStatus, string> = {
  interested:        'bg-[--border-secondary]',
  awaiting_reply:    'bg-[--text-quaternary]',
  response_needed:   'bg-[--school-primary]',
  meeting_scheduled: 'bg-[--text-quaternary]',
  met:               'bg-[--text-tertiary]',
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
  const highlightId = searchParams?.get('highlight')

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
  // Sent rows where the student dismissed the "did they reply?" prompt this
  // session, so it stops nagging without persisting a misleading state.
  const [dismissedReplyPrompts, setDismissedReplyPrompts] = useState<Set<string>>(new Set())
  // Same, for the "did it lead to anything?" prompt on Met rows.
  const [dismissedOutcomePrompts, setDismissedOutcomePrompts] = useState<Set<string>>(new Set())
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

  // 'proposed'/'not_interested' (mig 026) aren't CRM columns — they live in the
  // campaign home, not this board — so they fall back to 'interested' here.
  const CRM_STATUSES: readonly string[] = ['interested', 'awaiting_reply', 'response_needed', 'meeting_scheduled', 'met']
  const getStatus = (conn: UserNetwork): CRMStatus =>
    conn.status && CRM_STATUSES.includes(conn.status) ? (conn.status as CRMStatus) : 'interested'

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
      // contacted_at is a first-touch marker: a repeat send must not reset the
      // reply-time clock (adReport's median depends on it).
      const patch: { contacted: true; status: 'awaiting_reply'; contacted_at?: string } = { contacted: true, status: 'awaiting_reply' }
      if (!connection.contacted_at) patch.contacted_at = new Date().toISOString()
      await supabase.from('user_networks').update(patch).eq('id', connectionId)
      await supabase.from('messages').insert({ user_id: userId, alumni_id: connection.alumni_id, message_content: message, sent_via: sentVia })
      setNetwork(prev => prev.map(c => c.id === connectionId ? { ...c, ...patch } : c))
    } catch (err) { console.error('handleSendMessage:', err) }
    if (sentVia === 'marked') setSelectedConnection(null)
  }

  // Reply-outcome logging: the student marks that an alum wrote back. Advances
  // the Sent row into the "Replied" lane and stamps replied_at (the one success
  // metric Scout can capture, since sends happen off-platform).
  const handleMarkReplied = async (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation()
    // replied_at is a first-touch marker: re-marking after a follow-up send
    // must not move it (it would inflate days-to-reply).
    const existing = network.find(c => c.id === connectionId)
    const patch: { status: 'response_needed'; replied_at?: string } = { status: 'response_needed' }
    if (!existing?.replied_at) patch.replied_at = new Date().toISOString()
    // Optimistic update; own-row RLS on user_networks permits this write.
    setNetwork(prev => prev.map(c =>
      c.id === connectionId ? { ...c, ...patch } : c
    ))
    try {
      await supabase
        .from('user_networks')
        .update(patch)
        .eq('id', connectionId)
    } catch (err) {
      console.error('handleMarkReplied:', err)
    }
  }

  const handleDismissReplyPrompt = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation()
    setDismissedReplyPrompts(prev => new Set(prev).add(connectionId))
  }

  // Outcome logging: after a meeting, the student marks what it led to —
  // the referral/interview/offer numbers behind the AD report (migration 058).
  const handleLogOutcome = async (e: React.MouseEvent, connectionId: string, outcome: Outcome) => {
    e.stopPropagation()
    const now = new Date().toISOString()
    setNetwork(prev => prev.map(c =>
      c.id === connectionId ? { ...c, outcome, outcome_at: now } : c
    ))
    const { error } = await supabase
      .from('user_networks')
      .update({ outcome, outcome_at: now })
      .eq('id', connectionId)
    if (error) {
      // Revert the optimistic update — a silently-lost outcome is worse than
      // the prompt reappearing.
      console.error('handleLogOutcome:', error.message)
      setNetwork(prev => prev.map(c =>
        c.id === connectionId ? { ...c, outcome: null, outcome_at: null } : c
      ))
    } else {
      trackEvent('outcome_logged', { connection_id: connectionId, outcome })
    }
  }

  const handleDismissOutcomePrompt = (e: React.MouseEvent, connectionId: string) => {
    e.stopPropagation()
    setDismissedOutcomePrompts(prev => new Set(prev).add(connectionId))
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
          <h1 className="text-2xl font-semibold tracking-tight text-[--text-primary]">Network</h1>
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
        <div className="relative w-36 sm:w-52 flex-shrink-0">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[--bg-secondary] border border-[--border-primary] rounded-xl pl-9 pr-3 py-2 text-sm text-[--text-primary] placeholder:text-[--text-quaternary] focus:outline-none focus:border-[--school-primary] focus:ring-1 focus:ring-[--school-primary]/30 transition-colors"
          />
        </div>
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-[--border-primary]">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
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
              <p className="text-[--text-secondary] mb-1">No one saved yet.</p>
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
        <div className="space-y-1">
          {filteredNetwork.map(connection => {
            const status = getStatus(connection)
            const role = cleanField(connection.alumni?.role)
            const company = cleanField(connection.alumni?.company)
            const lastTouched = formatRelativeDate(connection.contacted_at || connection.created_at)
            const isUrgent = status === 'response_needed'
            const firstName = connection.alumni?.full_name?.split(' ')[0]
            const showReplyPrompt = status === 'awaiting_reply' && !dismissedReplyPrompts.has(connection.id)
            const showOutcomePrompt = status === 'met' && !connection.outcome && !dismissedOutcomePrompts.has(connection.id)

            return (
              <div
                key={connection.id}
                ref={el => setRowRef(connection.id, el)}
                onClick={() => setDetailConnection(connection)}
                className={`group flex items-center gap-3.5 px-3 py-4 cursor-pointer transition-colors hover:bg-[--bg-secondary] rounded-xl -mx-1 ${
                  highlightedId === connection.id ? 'ring-2 ring-[--school-primary] rounded-xl bg-[--bg-secondary]' : ''
                }`}
              >
                <SportAvatar
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
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
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

                  {/* Reply-outcome prompt — only on Sent rows, one tap to log */}
                  {showReplyPrompt && (
                    <div className="flex items-center gap-2 mt-1.5" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-[--text-quaternary]">
                        Heard back{firstName ? ` from ${firstName}` : ''}?
                      </span>
                      <button
                        onClick={e => handleMarkReplied(e, connection.id)}
                        className="text-xs font-medium text-[--school-primary] hover:opacity-80 transition-colors"
                      >
                        Yes
                      </button>
                      <span className="text-[--text-quaternary] text-xs">·</span>
                      <button
                        onClick={e => handleDismissReplyPrompt(e, connection.id)}
                        className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
                      >
                        Not yet
                      </button>
                    </div>
                  )}

                  {/* Outcome prompt — only on Met rows with nothing logged yet */}
                  {showOutcomePrompt && (
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap" onClick={e => e.stopPropagation()}>
                      <span className="text-xs text-[--text-quaternary]">Did it lead to anything?</span>
                      {OUTCOME_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          onClick={e => handleLogOutcome(e, connection.id, opt.value)}
                          className="text-xs font-medium text-[--school-primary] hover:opacity-80 transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                      <span className="text-[--text-quaternary] text-xs">·</span>
                      <button
                        onClick={e => handleDismissOutcomePrompt(e, connection.id)}
                        className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
                      >
                        Not yet
                      </button>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button
                  onClick={e => handleNextAction(e, connection)}
                  className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${
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
          <div className="bg-[--bg-secondary] shadow-[var(--shadow-soft)] rounded-xl p-4 mb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
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
          <div className="space-y-1">
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
          <p className="text-xs text-[--text-quaternary] py-4">None yet.</p>
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
