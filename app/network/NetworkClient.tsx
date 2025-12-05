'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserNetwork } from '@/types/database'
import NetworkRow from '@/components/NetworkRow'
import MessageModal from '@/components/MessageModal'
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
  
  const [network, setNetwork] = useState<UserNetwork[]>(initialNetwork)
  const [searchQuery, setSearchQuery] = useState('')
  const [interests, setInterests] = useState(userProfile.interests)
  const [selectedConnection, setSelectedConnection] = useState<UserNetwork | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)

  // Filter network based on search
  const filteredNetwork = useMemo(() => {
    if (searchQuery === '') return network
    const searchLower = searchQuery.toLowerCase()
    return network.filter((conn) => {
      const alumni = conn.alumni
      if (!alumni) return false
      return (
        alumni.full_name.toLowerCase().includes(searchLower) ||
        alumni.company?.toLowerCase().includes(searchLower)
      )
    })
  }, [network, searchQuery])

  const handleRemove = async (connectionId: string) => {
    setRemovingId(connectionId)
    
    try {
      const { error } = await supabase
        .from('user_networks')
        .delete()
        .eq('id', connectionId)

      if (error) throw error

      setNetwork((prev) => prev.filter((conn) => conn.id !== connectionId))
    } catch (error) {
      console.error('Error removing from network:', error)
      alert('Failed to remove from network. Please try again.')
    } finally {
      setRemovingId(null)
    }
  }

  const handleSendMessage = async (connectionId: string, message: string) => {
    try {
      // Mark as contacted
      const { error: updateError } = await supabase
        .from('user_networks')
        .update({
          contacted: true,
          contacted_at: new Date().toISOString(),
        })
        .eq('id', connectionId)

      if (updateError) throw updateError

      // Log the message
      const connection = network.find((c) => c.id === connectionId)
      if (connection?.alumni_id) {
        await supabase.from('messages').insert({
          user_id: userId,
          alumni_id: connection.alumni_id,
          message_content: message,
          sent_via: 'linkedin',
        })
      }

      // Update local state
      setNetwork((prev) =>
        prev.map((conn) =>
          conn.id === connectionId
            ? { ...conn, contacted: true, contacted_at: new Date().toISOString() }
            : conn
        )
      )

      setSelectedConnection(null)
    } catch (error) {
      console.error('Error marking as contacted:', error)
      alert('Failed to update contact status. Please try again.')
    }
  }

  const handleUpdateInterests = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ interests })
        .eq('id', userId)

      if (error) throw error
    } catch (error) {
      console.error('Error updating interests:', error)
    }
  }

  const contactedCount = network.filter((c) => c.contacted).length

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          My Network
        </h1>
        <p className="text-[#71717a] text-sm">
          Manage your connections and send personalized outreach messages.
        </p>
      </div>

      {/* Interests Setting */}
      <div className="card p-4 mb-6 flex items-center gap-4 flex-wrap">
        <span className="text-[#71717a] text-sm">Your interests:</span>
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
        <div className="flex items-center gap-2 text-[#71717a] text-sm">
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
              <p className="text-base text-[#a1a1aa] mb-1">Your network is empty</p>
              <p className="text-[#52525b] text-sm">
                Go to Discover to add alumni to your network
              </p>
            </>
          ) : (
            <>
              <p className="text-base text-[#a1a1aa] mb-1">No matches found</p>
              <p className="text-[#52525b] text-sm">Try a different search term</p>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredNetwork.map((connection) => (
            <NetworkRow
              key={connection.id}
              connection={connection}
              onSendMessage={setSelectedConnection}
              onRemove={handleRemove}
              isRemoving={removingId === connection.id}
            />
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
    </main>
  )
}