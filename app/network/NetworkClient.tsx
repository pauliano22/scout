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
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold font-display mb-3 tracking-tight">
          My Network
        </h1>
        <p className="text-white/50 text-lg max-w-xl">
          Manage your connections and send personalized outreach messages.
        </p>
      </div>

      {/* Interests Setting */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 mb-8 flex items-center gap-4 flex-wrap">
        <span className="text-white/60 text-sm">Your interests (for AI messages):</span>
        <input
          type="text"
          value={interests}
          onChange={(e) => setInterests(e.target.value)}
          onBlur={handleUpdateInterests}
          placeholder="e.g., investment banking, product management..."
          className="flex-1 min-w-[250px] px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white text-sm outline-none focus:border-cornell-red/50"
        />
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-8">
        <div className="flex items-center gap-2 text-white/50 text-sm">
          <Users size={16} />
          <span>{network.length} connections</span>
        </div>
        <div className="flex items-center gap-2 text-green-500/80 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>{contactedCount} contacted</span>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md mb-6">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="text"
          placeholder="Search your network..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-11"
        />
      </div>

      {/* Network List */}
      {filteredNetwork.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-5xl mb-4">👥</p>
          {network.length === 0 ? (
            <>
              <p className="text-xl text-white/60 mb-2">Your network is empty</p>
              <p className="text-white/40">
                Go to Discover to add alumni to your network
              </p>
            </>
          ) : (
            <>
              <p className="text-xl text-white/60 mb-2">No matches found</p>
              <p className="text-white/40">Try a different search term</p>
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
