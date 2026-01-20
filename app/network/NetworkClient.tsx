'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import MessageModal from '@/components/MessageModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import { Search, Users, ChevronRight, Flame, Sun, Snowflake } from 'lucide-react'

interface NetworkClientProps {
  initialNetwork: UserNetwork[]
  userId: string
  userProfile: {
    name: string
    sport: string
    interests: string
  }
}

type StatusFilter = 'all' | 'hot' | 'warm' | 'cold'

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

  // Get connections by status
  const hotConnections = useMemo(() => network.filter(c => c.status === 'hot'), [network])
  const warmConnections = useMemo(() => network.filter(c => c.status === 'warm'), [network])
  const coldConnections = useMemo(() => network.filter(c => !c.status || c.status === 'cold'), [network])

  const filteredNetwork = useMemo(() => {
    let filtered = network

    // Apply status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'cold') {
        filtered = filtered.filter(c => !c.status || c.status === 'cold')
      } else {
        filtered = filtered.filter(c => c.status === statusFilter)
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

  const contactedCount = network.filter((c) => c.contacted).length
  const priorityCount = hotConnections.length + warmConnections.length

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

  const handleSendMessage = async (connectionId: string, message: string) => {
    try {
      const now = new Date().toISOString()
      const { error } = await supabase
        .from('user_networks')
        .update({ 
          contacted: true,
          contacted_at: now
        })
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId 
            ? { ...c, contacted: true, contacted_at: now } 
            : c
        )
      )
    } catch (error) {
      console.error('Error marking as contacted:', error)
    }

    setSelectedConnection(null)
  }

  // Helper to set ref for each row
  const setRowRef = (id: string, element: HTMLDivElement | null) => {
    if (element) {
      rowRefs.current.set(id, element)
    } else {
      rowRefs.current.delete(id)
    }
  }

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          My Network
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Manage your connections and track your outreach.
        </p>
      </div>

      {/* Priority Connections Panel */}
      {priorityCount > 0 && (
        <div className="card p-5 mb-6 bg-gradient-to-r from-[--bg-secondary] to-[--bg-tertiary]">
          <h2 className="text-sm font-medium text-[--text-secondary] mb-4 flex items-center gap-2">
            <Flame size={16} className="text-red-400" />
            Priority Connections
          </h2>
          <div className="flex flex-wrap gap-3">
            {hotConnections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => setDetailConnection(conn)}
                className="flex items-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors text-left"
              >
                <span className="text-red-400">🔥</span>
                <span className="text-sm font-medium text-[--text-primary]">
                  {conn.alumni?.full_name}
                </span>
              </button>
            ))}
            {warmConnections.map((conn) => (
              <button
                key={conn.id}
                onClick={() => setDetailConnection(conn)}
                className="flex items-center gap-2 px-3 py-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors text-left"
              >
                <span className="text-amber-400">🌤️</span>
                <span className="text-sm font-medium text-[--text-primary]">
                  {conn.alumni?.full_name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2 text-[--text-tertiary] text-sm">
          <Users size={14} />
          <span>{network.length} connections</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-500 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{contactedCount} contacted</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            statusFilter === 'all'
              ? 'bg-[--bg-tertiary] text-[--text-primary] border border-[--border-secondary]'
              : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
          }`}
        >
          All ({network.length})
        </button>
        <button
          onClick={() => setStatusFilter('hot')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            statusFilter === 'hot'
              ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
          }`}
        >
          <Flame size={14} /> Hot ({hotConnections.length})
        </button>
        <button
          onClick={() => setStatusFilter('warm')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            statusFilter === 'warm'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
          }`}
        >
          <Sun size={14} /> Warm ({warmConnections.length})
        </button>
        <button
          onClick={() => setStatusFilter('cold')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
            statusFilter === 'cold'
              ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              : 'text-[--text-secondary] hover:bg-[--bg-tertiary]'
          }`}
        >
          <Snowflake size={14} /> Cold ({coldConnections.length})
        </button>
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
          <p className="text-4xl mb-3">👥</p>
          {network.length === 0 ? (
            <>
              <p className="text-base text-[--text-secondary] mb-1">Your network is empty</p>
              <p className="text-[--text-quaternary] text-sm">
                Go to Alumni to add connections to your network
              </p>
            </>
          ) : (
            <>
              <p className="text-base text-[--text-secondary] mb-1">No matches found</p>
              <p className="text-[--text-quaternary] text-sm">Try a different search term</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredNetwork.map((connection) => (
            <div
              key={connection.id}
              ref={(el) => setRowRef(connection.id, el)}
              className={`transition-all duration-500 ${
                highlightedId === connection.id 
                  ? 'ring-2 ring-[--school-primary]' 
                  : ''
              }`}
            >
              <button
                onClick={() => setDetailConnection(connection)}
                className="w-full card p-4 flex items-center justify-between hover:bg-[--bg-tertiary] transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  {/* Name */}
                  <h3 className="font-medium text-[--text-primary] truncate">
                    {connection.alumni?.full_name}
                  </h3>
                  
                  {/* Company + Role */}
                  <p className="text-sm text-[--text-secondary] truncate">
                    {connection.alumni?.role && connection.alumni?.company
                      ? `${connection.alumni.role} @ ${connection.alumni.company}`
                      : connection.alumni?.company || connection.alumni?.role || 'No career info yet'}
                  </p>
                  
                  {/* Sport */}
                  <p className="text-xs text-[--text-quaternary] mt-1">
                    {connection.alumni?.sport || 'Unknown sport'}
                  </p>
                </div>

                <ChevronRight size={20} className="text-[--text-quaternary] flex-shrink-0 ml-4" />
              </button>
            </div>
          ))}
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