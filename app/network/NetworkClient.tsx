'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import MessageModal from '@/components/MessageModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import Avatar from '@/components/Avatar'
import { Search, Users, ChevronRight, MessageSquare, Clock, AlertCircle, Calendar, CheckCircle2, Send, FileText, Phone } from 'lucide-react'

interface NetworkClientProps {
  initialNetwork: UserNetwork[]
  userId: string
  userProfile: {
    name: string
    sport: string
    interests: string
  }
}

type CRMStatus = 'interested' | 'awaiting_reply' | 'response_needed' | 'meeting_scheduled' | 'met'
type StatusFilter = 'all' | CRMStatus

const statusConfig: Record<CRMStatus, { label: string; color: string; bgClass: string; borderClass: string; textClass: string; icon: typeof Clock }> = {
  interested: {
    label: 'Interested',
    color: 'blue',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    textClass: 'text-blue-400',
    icon: Users,
  },
  awaiting_reply: {
    label: 'Awaiting Reply',
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
    icon: Clock,
  },
  response_needed: {
    label: 'Response Needed',
    color: 'red',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
    textClass: 'text-red-400',
    icon: AlertCircle,
  },
  meeting_scheduled: {
    label: 'Meeting',
    color: 'purple',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    textClass: 'text-purple-400',
    icon: Calendar,
  },
  met: {
    label: 'Met',
    color: 'emerald',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    icon: CheckCircle2,
  },
}

const nextActionConfig: Record<CRMStatus, { label: string; icon: typeof Send }> = {
  interested: { label: 'Send Message', icon: Send },
  awaiting_reply: { label: 'Follow Up', icon: Send },
  response_needed: { label: 'Reply', icon: MessageSquare },
  meeting_scheduled: { label: 'Prep for Call', icon: Phone },
  met: { label: 'Add Notes', icon: FileText },
}

// Sport color mapping for color-coded sport labels
function getSportColor(sport: string): string {
  const s = sport.toLowerCase()
  if (s.includes('football')) return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  if (s.includes('basketball')) return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
  if (s.includes('soccer')) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  if (s.includes('lacrosse')) return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  if (s.includes('hockey')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
  if (s.includes('tennis')) return 'bg-lime-500/10 text-lime-400 border-lime-500/20'
  if (s.includes('baseball') || s.includes('softball')) return 'bg-red-500/10 text-red-400 border-red-500/20'
  if (s.includes('volleyball')) return 'bg-pink-500/10 text-pink-400 border-pink-500/20'
  if (s.includes('swimming') || s.includes('diving')) return 'bg-sky-500/10 text-sky-400 border-sky-500/20'
  if (s.includes('track') || s.includes('cross country')) return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
  if (s.includes('rowing') || s.includes('crew')) return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
  if (s.includes('wrestling')) return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  if (s.includes('golf')) return 'bg-teal-500/10 text-teal-400 border-teal-500/20'
  if (s.includes('fencing')) return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
  if (s.includes('gymnastics')) return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20'
  if (s.includes('field hockey')) return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
  return 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
}

export default function NetworkClient({
  initialNetwork,
  userId,
  userProfile,
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

  // Refs for scrolling to highlighted item
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Handle highlight parameter - scroll to and highlight the connection
  useEffect(() => {
    if (highlightId) {
      const connection = network.find(c => c.alumni_id === highlightId)
      if (connection) {
        setHighlightedId(connection.id)

        setTimeout(() => {
          const element = rowRefs.current.get(connection.id)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)

        setTimeout(() => {
          setHighlightedId(null)
        }, 3000)
      }
    }
  }, [highlightId, network])

  // Get connection status (default to 'interested')
  const getStatus = (conn: UserNetwork): CRMStatus => conn.status || 'interested'

  // Count connections by status
  const statusCounts = useMemo(() => {
    const counts: Record<CRMStatus, number> = {
      interested: 0,
      awaiting_reply: 0,
      response_needed: 0,
      meeting_scheduled: 0,
      met: 0,
    }
    network.forEach(c => {
      counts[getStatus(c)]++
    })
    return counts
  }, [network])

  const filteredNetwork = useMemo(() => {
    let filtered = network

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'meeting_scheduled') {
        // "Meeting" tab shows both meeting_scheduled and met
        filtered = filtered.filter(c => getStatus(c) === 'meeting_scheduled' || getStatus(c) === 'met')
      } else {
        filtered = filtered.filter(c => getStatus(c) === statusFilter)
      }
    }

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((conn) => {
        const alumni = conn.alumni
        if (!alumni) return false
        return (
          alumni.full_name.toLowerCase().includes(query) ||
          alumni.company?.toLowerCase().includes(query) ||
          alumni.role?.toLowerCase().includes(query) ||
          alumni.sport?.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [network, searchQuery, statusFilter])

  // Count items needing attention (response_needed is most urgent)
  const needsAttentionCount = statusCounts.response_needed

  const handleUpdateConnection = (updatedConnection: UserNetwork) => {
    setNetwork((prev) =>
      prev.map((c) =>
        c.id === updatedConnection.id ? updatedConnection : c
      )
    )
    if (detailConnection?.id === updatedConnection.id) {
      setDetailConnection(updatedConnection)
    }
  }

  const handleRemoveConnection = (connectionId: string) => {
    setNetwork((prev) => prev.filter((c) => c.id !== connectionId))
    setDetailConnection(null)
  }

  const handleSendMessage = async (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => {
    try {
      const connection = network.find(c => c.id === connectionId)
      if (!connection) return

      const now = new Date().toISOString()

      // Update user_networks: mark as contacted and move to awaiting_reply
      const { error: networkError } = await supabase
        .from('user_networks')
        .update({
          contacted: true,
          contacted_at: now,
          status: 'awaiting_reply'
        })
        .eq('id', connectionId)

      if (networkError) throw networkError

      // Insert into messages table to track the interaction
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          user_id: userId,
          alumni_id: connection.alumni_id,
          message_content: message,
          sent_via: sentVia
        })

      if (messageError) {
        console.error('Error saving message:', messageError)
      }

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId
            ? { ...c, contacted: true, contacted_at: now, status: 'awaiting_reply' as const }
            : c
        )
      )
    } catch (error) {
      console.error('Error marking as contacted:', error)
    }

    // Only close modal for 'marked' action (Mark as Sent button)
    if (sentVia === 'marked') {
      setSelectedConnection(null)
    }
  }

  // Handle next action button click
  const handleNextAction = (e: React.MouseEvent, connection: UserNetwork) => {
    e.stopPropagation()
    const status = getStatus(connection)
    if (status === 'interested' || status === 'awaiting_reply') {
      setSelectedConnection(connection)
    } else {
      setDetailConnection(connection)
    }
  }

  // Helper to set ref for each row
  const setRowRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      rowRefs.current.set(id, element)
    } else {
      rowRefs.current.delete(id)
    }
  }

  // Filter tab definitions
  const filterTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: `All (${network.length})` },
    { key: 'interested', label: `Interested (${statusCounts.interested})` },
    { key: 'awaiting_reply', label: `Awaiting Reply (${statusCounts.awaiting_reply})` },
    { key: 'response_needed', label: `Response Needed (${statusCounts.response_needed})` },
    { key: 'meeting_scheduled', label: `Meeting (${statusCounts.meeting_scheduled + statusCounts.met})` },
  ]

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          My Network
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Track your outreach pipeline and manage connections.
        </p>
      </div>

      {/* Stats Row */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2 text-[--text-tertiary] text-sm">
          <Users size={14} />
          <span>{network.length} connections</span>
        </div>
        {needsAttentionCount > 0 && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle size={14} />
            <span>{needsAttentionCount} need{needsAttentionCount === 1 ? 's' : ''} your reply</span>
          </div>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {filterTabs.map((tab) => {
          const isActive = statusFilter === tab.key
          const config = tab.key !== 'all' && tab.key !== 'meeting_scheduled' ? statusConfig[tab.key as CRMStatus] : null
          return (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                isActive
                  ? tab.key === 'all'
                    ? 'bg-[--bg-tertiary] text-[--text-primary] border border-[--border-secondary]'
                    : tab.key === 'meeting_scheduled'
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : `${config!.bgClass} ${config!.textClass} border ${config!.borderClass}`
                  : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-6">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
        <input
          type="text"
          placeholder="Search your network..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field !pl-11"
        />
      </div>

      {/* Network List */}
      {filteredNetwork.length === 0 ? (
        <div className="text-center py-16">
          <div className="empty-state-icon">
            <Users size={32} className="text-[--text-quaternary]" />
          </div>
          {network.length === 0 ? (
            <>
              <p className="text-base text-[--text-secondary] mb-2">Your network is empty</p>
              <p className="text-[--text-quaternary] text-sm mb-4">
                Start building your network by discovering alumni
              </p>
              <a href="/discover" className="btn-primary inline-flex items-center gap-2">
                Browse Alumni
                <ChevronRight size={16} />
              </a>
            </>
          ) : (
            <>
              <p className="text-base text-[--text-secondary] mb-1">No matches found</p>
              <p className="text-[--text-quaternary] text-sm">Try a different search or filter</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredNetwork.map((connection) => {
            const status = getStatus(connection)
            const sConfig = statusConfig[status]
            const action = nextActionConfig[status]
            const ActionIcon = action.icon

            return (
              <div
                key={connection.id}
                ref={(el) => setRowRef(connection.id, el)}
                className={`transition-all duration-500 ${
                  highlightedId === connection.id
                    ? 'ring-2 ring-[--school-primary] rounded-xl'
                    : ''
                }`}
              >
                <div
                  onClick={() => setDetailConnection(connection)}
                  className="w-full card p-4 flex items-center gap-4 hover:bg-[--bg-tertiary] hover:border-[--border-secondary] transition-all text-left group cursor-pointer"
                >
                  {/* Avatar */}
                  <Avatar name={connection.alumni?.full_name || 'Unknown'} sport={connection.alumni?.sport} imageUrl={connection.alumni?.avatar_url} size="md" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-[--text-primary] truncate transition-colors">
                        {connection.alumni?.full_name}
                      </h3>
                      {/* Status badge */}
                      <span className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${sConfig.bgClass} ${sConfig.textClass} ${sConfig.borderClass}`}>
                        {sConfig.label}
                      </span>
                    </div>

                    {/* Company + Role */}
                    <p className="text-sm text-[--text-secondary] truncate">
                      {connection.alumni?.role && connection.alumni?.company
                        ? `${connection.alumni.role} @ ${connection.alumni.company}`
                        : connection.alumni?.company || connection.alumni?.role || 'Cornell Athlete Alumni'}
                    </p>

                    {/* Sport (color-coded) */}
                    <div className="flex items-center gap-2 mt-1.5">
                      {connection.alumni?.sport && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${getSportColor(connection.alumni.sport)}`}>
                          {connection.alumni.sport}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Next Action Button */}
                  <button
                    onClick={(e) => handleNextAction(e, connection)}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${sConfig.bgClass} ${sConfig.textClass} ${sConfig.borderClass} hover:opacity-80`}
                  >
                    <ActionIcon size={12} />
                    {action.label}
                  </button>

                  <ChevronRight size={20} className="text-[--text-quaternary] flex-shrink-0 group-hover:text-[--text-secondary] group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Message Modal */}
      {selectedConnection && (
        <MessageModal
          connection={selectedConnection}
          userInterests={userProfile.interests}
          userName={userProfile.name}
          userSport={userProfile.sport}
          onClose={() => setSelectedConnection(null)}
          onSend={handleSendMessage}
        />
      )}

      {/* Connection Detail Modal */}
      {detailConnection && (
        <ConnectionDetailModal
          connection={detailConnection}
          userProfile={userProfile}
          onClose={() => setDetailConnection(null)}
          onUpdate={handleUpdateConnection}
          onRemove={handleRemoveConnection}
        />
      )}
    </main>
  )
}
