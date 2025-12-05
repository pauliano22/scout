'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Alumni } from '@/types/database'
import AlumniCard from '@/components/AlumniCard'
import SearchFilters from '@/components/SearchFilters'

interface DiscoverClientProps {
  initialAlumni: Alumni[]
  networkAlumniIds: string[]
  userId: string
}

export default function DiscoverClient({
  initialAlumni,
  networkAlumniIds: initialNetworkIds,
  userId,
}: DiscoverClientProps) {
  const supabase = createClient()
  
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('All Industries')
  const [sportFilter, setSportFilter] = useState('All Sports')
  const [networkIds, setNetworkIds] = useState<Set<string>>(new Set(initialNetworkIds))
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Filter alumni based on search and filters
  const filteredAlumni = useMemo(() => {
    return initialAlumni.filter((person) => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === '' ||
        person.full_name.toLowerCase().includes(searchLower) ||
        person.company?.toLowerCase().includes(searchLower) ||
        person.role?.toLowerCase().includes(searchLower)

      const matchesIndustry =
        industryFilter === 'All Industries' || person.industry === industryFilter

      const matchesSport =
        sportFilter === 'All Sports' || person.sport === sportFilter

      return matchesSearch && matchesIndustry && matchesSport
    })
  }, [initialAlumni, searchQuery, industryFilter, sportFilter])

  const handleAddToNetwork = async (alumniId: string) => {
    setLoadingId(alumniId)
    
    try {
      const { error } = await supabase
        .from('user_networks')
        .insert({
          user_id: userId,
          alumni_id: alumniId,
        })

      if (error) throw error

      setNetworkIds((prev) => new Set([...prev, alumniId]))
    } catch (error) {
      console.error('Error adding to network:', error)
      alert('Failed to add to network. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <main className="px-6 md:px-12 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Discover Alumni
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Search the Cornell athlete alumni network to find mentors in your target industry.
        </p>
      </div>

      {/* Search & Filters */}
      <SearchFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        industryFilter={industryFilter}
        onIndustryChange={setIndustryFilter}
        sportFilter={sportFilter}
        onSportChange={setSportFilter}
      />

      {/* Results count */}
      <p className="text-[--text-quaternary] text-sm mb-6">
        Showing {filteredAlumni.length} alumni
      </p>

      {/* Alumni Grid */}
      {filteredAlumni.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base text-[--text-secondary] mb-1">No alumni found</p>
          <p className="text-[--text-quaternary] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlumni.map((alumni) => (
            <AlumniCard
              key={alumni.id}
              alumni={alumni}
              isInNetwork={networkIds.has(alumni.id)}
              onAddToNetwork={handleAddToNetwork}
              isLoading={loadingId === alumni.id}
            />
          ))}
        </div>
      )}
    </main>
  )
}