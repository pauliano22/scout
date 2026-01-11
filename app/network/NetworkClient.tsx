'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import MessageModal from '@/components/MessageModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import { Search, Users, ChevronRight } from 'lucide-react'

interface NetworkClientProps {
  initialNetwork: UserNetwork[]
  userId: string
  userProfile: {
    name: string
    sport: string
    interests: string
  }
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

  const filteredNetwork = useMemo(() => {
    if (!searchQuery) return network
    const query = searchQuery.toLowerCase()
    return network.filter((conn) => {
      const alumni = conn.alumni
      if (!alumni) return false
      return (
        alumni.full_name.toLowerCase().includes(query) ||
        alumni.company?.toLowerCase().includes(query) ||
        alumni.role?.toLowerCase().includes(query) ||
        alumni.sport?.toLowerCase().includes(query)
      )
    })
  }, [network, searchQuery])

  const contactedCount = network.filter((c) => c.contacted).length

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