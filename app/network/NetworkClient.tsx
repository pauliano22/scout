'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import NetworkRow from '@/components/NetworkRow'
import MessageModal from '@/components/MessageModal'
import NotesModal from '@/components/NotesModal'
import ConnectionDetailModal from '@/components/ConnectionDetailModal'
import { Search, Users } from 'lucide-react'

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
  const [interests, setInterests] = useState(userProfile.interests)
  const [selectedConnection, setSelectedConnection] = useState<UserNetwork | null>(null)
  const [notesConnection, setNotesConnection] = useState<UserNetwork | null>(null)
  const [detailConnection, setDetailConnection] = useState<UserNetwork | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  
  // Refs for scrolling to highlighted item
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Handle highlight parameter - scroll to and highlight the connection
  useEffect(() => {
    if (highlightId) {
      // Find the connection with this alumni_id
      const connection = network.find(c => c.alumni_id === highlightId)
      if (connection) {
        setHighlightedId(connection.id)
        
        // Scroll to the element after a short delay to ensure render
        setTimeout(() => {
          const element = rowRefs.current.get(connection.id)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 100)
        
        // Remove highlight after 3 seconds
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
        alumni.role?.toLowerCase().includes(query)
      )
    })
  }, [network, searchQuery])

  const contactedCount = network.filter((c) => c.contacted).length

  const handleRemove = async (connectionId: string) => {
    setRemovingId(connectionId)
    try {
      const { error } = await supabase
        .from('user_networks')
        .delete()
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) => prev.filter((c) => c.id !== connectionId))
    } catch (error) {
      console.error('Error removing connection:', error)
      alert('Failed to remove connection. Please try again.')
    } finally {
      setRemovingId(null)
    }
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

  const handleUpdateInterests = async () => {
    try {
      await supabase
        .from('profiles')
        .update({ interests })
        .eq('id', userId)
    } catch (error) {
      console.error('Error updating interests:', error)
    }
  }

  const handleSaveNotes = async (connectionId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ notes })
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, notes } : c
        )
      )
    } catch (error) {
      console.error('Error saving notes:', error)
      throw error
    }
  }

  const handleUpdateContactedDate = async (connectionId: string, date: string | null) => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ contacted_at: date })
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, contacted_at: date } : c
        )
      )
    } catch (error) {
      console.error('Error updating contacted date:', error)
    }
  }

  const handleUpdateStatus = async (connectionId: string, status: 'cold' | 'warm' | 'hot') => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ status })
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, status } : c
        )
      )
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleUndoContacted = async (connectionId: string) => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .update({ contacted: false, contacted_at: null })
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) =>
        prev.map((c) =>
          c.id === connectionId ? { ...c, contacted: false, contacted_at: null } : c
        )
      )
    } catch (error) {
      console.error('Error undoing contacted status:', error)
    }
  }

  const handleUpdateConnection = (updatedConnection: UserNetwork) => {
    setNetwork((prev) =>
      prev.map((c) =>
        c.id === updatedConnection.id ? updatedConnection : c
      )
    )
    // Also update the detail connection if it's open
    if (detailConnection?.id === updatedConnection.id) {
      setDetailConnection(updatedConnection)
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

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          My Network
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Manage your connections and send personalized outreach messages.
        </p>
      </div>

      {/* Interests Setting */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <span className="text-[--text-tertiary] text-sm">Your interests:</span>
        <input
          type="text"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          onBlur={handleUpdateInterests}
          placeholder="e.g., investment banking, product management..."
          className="input-field flex-1 min-w-[250px]"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-6">
        <div className="flex items-center gap-2 text-[--text-tertiary] text-sm">
          <Users size={14} />
          <span>{network.length} connections</span>
        </div>
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>{contactedCount} contacted</span>
        </div>
      </div>

      {/* Search */}
      <div className="search-input-wrapper max-w-sm mb-6">
        <Search size={16} className="search-icon" />
        <input
          type="text"
          placeholder="Search your network..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field"
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
                Go to Discover to add alumni to your network
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
        <div className="flex flex-col gap-3">
          {filteredNetwork.map((connection) => (
            <div
              key={connection.id}
              ref={(el) => setRowRef(connection.id, el)}
              className={`transition-all duration-500 rounded-xl ${
                highlightedId === connection.id 
                  ? 'ring-2 ring-[--school-primary] bg-[--school-primary]/5' 
                  : ''
              }`}
            >
              <NetworkRow
                connection={connection}
                onSendMessage={setSelectedConnection}
                onRemove={handleRemove}
                onOpenNotes={setNotesConnection}
                onUpdateContactedDate={handleUpdateContactedDate}
                onUpdateStatus={handleUpdateStatus}
                onUndoContacted={handleUndoContacted}
                onOpenDetail={setDetailConnection}
                isRemoving={removingId === connection.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Message Modal */}
      {selectedConnection && (
        <MessageModal
          connection={selectedConnection}
          userInterests={interests}
          userName={userProfile.name}
          userSport={userProfile.sport}
          onClose={() => setSelectedConnection(null)}
          onSend={handleSendMessage}
        />
      )}

      {/* Notes Modal */}
      {notesConnection && (
        <NotesModal
          connection={notesConnection}
          onClose={() => setNotesConnection(null)}
          onSave={handleSaveNotes}
        />
      )}

      {/* Connection Detail Modal */}
      {detailConnection && (
        <ConnectionDetailModal
          connection={detailConnection}
          onClose={() => setDetailConnection(null)}
          onUpdate={handleUpdateConnection}
        />
      )}
    </main>
  )
}