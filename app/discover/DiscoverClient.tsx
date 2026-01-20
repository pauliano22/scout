'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Alumni } from '@/types/database'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import { Search, Check, ChevronRight, Users } from 'lucide-react'

interface DiscoverClientProps {
  initialAlumni: Alumni[]
  networkAlumniIds: string[]
  userId: string
  userSport: string | null
  totalAlumniCount: number
}

const ITEMS_PER_PAGE = 50

const industries = ['All', 'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media']

const industryBadgeClass: Record<string, string> = {
  Finance: 'bg-emerald-500/10 text-emerald-400',
  Technology: 'bg-blue-500/10 text-blue-400',
  Consulting: 'bg-purple-500/10 text-purple-400',
  Healthcare: 'bg-pink-500/10 text-pink-400',
  Law: 'bg-amber-500/10 text-amber-400',
  Media: 'bg-orange-500/10 text-orange-400',
}

export default function DiscoverClient({
  initialAlumni,
  networkAlumniIds: initialNetworkIds,
  userId,
  userSport,
  totalAlumniCount,
}: DiscoverClientProps) {
  const supabase = createClient()

  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('All')
  const [sportFilter, setSportFilter] = useState<string | null>(null)
  const [networkIds, setNetworkIds] = useState<Set<string>>(new Set(initialNetworkIds))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)
  const [selectedAlumni, setSelectedAlumni] = useState<Alumni | null>(null)

  // Filter alumni based on search and filters
  const filteredAlumni = useMemo(() => {
    return initialAlumni.filter((person) => {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        searchQuery === '' ||
        person.full_name.toLowerCase().includes(searchLower) ||
        person.company?.toLowerCase().includes(searchLower) ||
        person.role?.toLowerCase().includes(searchLower) ||
        person.industry?.toLowerCase().includes(searchLower)

      const matchesIndustry =
        industryFilter === 'All' || person.industry === industryFilter

      // Use partial matching for sports (e.g., "Football" matches "Football (Men's)")
      const matchesSport =
        !sportFilter ||
        person.sport?.toLowerCase().includes(sportFilter.toLowerCase()) ||
        sportFilter.toLowerCase().includes(person.sport?.toLowerCase() || '')

      return matchesSearch && matchesIndustry && matchesSport
    })
  }, [initialAlumni, searchQuery, industryFilter, sportFilter])

  // Reset visible count when filters/search change
  useMemo(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [searchQuery, industryFilter, sportFilter])

  // Get only the visible portion of filtered alumni
  const visibleAlumni = useMemo(() => {
    return filteredAlumni.slice(0, visibleCount)
  }, [filteredAlumni, visibleCount])

  const hasMore = visibleCount < filteredAlumni.length

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
  }

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

  // Find similar alumni for the modal
  const getSimilarAlumni = (alumni: Alumni): Alumni[] => {
    const similar: Alumni[] = []

    // Find alumni with same industry
    const sameIndustry = initialAlumni.filter(
      a => a.id !== alumni.id && a.industry === alumni.industry && a.industry
    ).slice(0, 2)
    similar.push(...sameIndustry)

    // Find alumni with same sport (if we don't have enough)
    if (similar.length < 4) {
      const sameSport = initialAlumni.filter(
        a => a.id !== alumni.id && a.sport === alumni.sport && !similar.includes(a)
      ).slice(0, 4 - similar.length)
      similar.push(...sameSport)
    }

    // Find alumni at same company
    if (similar.length < 4 && alumni.company) {
      const sameCompany = initialAlumni.filter(
        a => a.id !== alumni.id && a.company === alumni.company && !similar.includes(a)
      ).slice(0, 4 - similar.length)
      similar.push(...sameCompany)
    }

    return similar.slice(0, 4)
  }

  const handleMySportFilter = () => {
    if (sportFilter === userSport) {
      setSportFilter(null)
    } else if (userSport) {
      setSportFilter(userSport)
      setIndustryFilter('All') // Reset industry filter when selecting sport
    }
  }

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Connect with Cornell Athlete Alumni
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Search <span className="text-[--school-primary] font-medium">{totalAlumniCount.toLocaleString()}</span> verified alumni to find mentors in your target industry
        </p>
      </div>

      {/* Search Section - Hero/Focus */}
      <div className="card p-6 mb-6">
        {/* Large Search Bar */}
        <div className="relative mb-5">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, company, role, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3.5 pl-12 pr-4 text-base bg-[--bg-primary] border border-[--border-primary] rounded-xl focus:border-[--border-secondary] focus:outline-none transition-colors"
          />
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <button
              key={industry}
              onClick={() => {
                setIndustryFilter(industry)
                setSportFilter(null) // Clear sport filter when selecting industry
              }}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all ${
                industryFilter === industry
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover] border border-[--border-primary]'
              }`}
            >
              {industry}
            </button>
          ))}

          {/* My Sport Button */}
          {userSport && (
            <button
              onClick={handleMySportFilter}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 ${
                sportFilter === userSport
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-tertiary] text-[--school-primary] hover:bg-[--bg-hover] border border-[--school-primary]'
              }`}
            >
              <Users size={14} />
              My Sport
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[--text-quaternary] text-sm mb-4">
        Showing {visibleAlumni.length} of {filteredAlumni.length} alumni
        {sportFilter && <span className="text-[--school-primary]"> in {sportFilter}</span>}
      </p>

      {/* Alumni List */}
      {filteredAlumni.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-base text-[--text-secondary] mb-1">No alumni found</p>
          <p className="text-[--text-quaternary] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {visibleAlumni.map((alumni) => (
              <button
                key={alumni.id}
                onClick={() => setSelectedAlumni(alumni)}
                className="w-full card p-4 flex items-center justify-between hover:bg-[--bg-tertiary] transition-colors text-left"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-medium text-[--text-primary] truncate">
                        {alumni.full_name}
                      </h3>
                      {networkIds.has(alumni.id) && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex-shrink-0">
                          <Check size={10} />
                          In Network
                        </span>
                      )}
                    </div>

                    {/* Role @ Company */}
                    <p className="text-sm text-[--text-secondary] truncate">
                      {alumni.role && alumni.company
                        ? `${alumni.role} @ ${alumni.company}`
                        : alumni.company || alumni.role || 'No career info yet'}
                    </p>

                    {/* Sport */}
                    <p className="text-xs text-[--text-quaternary] mt-0.5">
                      {alumni.sport}
                    </p>
                  </div>

                  {/* Industry Badge */}
                  {alumni.industry && (
                    <span
                      className={`hidden sm:inline-flex px-2.5 py-1 rounded-md text-xs font-medium flex-shrink-0 ${
                        industryBadgeClass[alumni.industry] || 'bg-[--bg-tertiary] text-[--text-secondary]'
                      }`}
                    >
                      {alumni.industry}
                    </span>
                  )}
                </div>

                <ChevronRight size={18} className="text-[--text-quaternary] flex-shrink-0 ml-3" />
              </button>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                className="px-6 py-3 bg-[--bg-tertiary] hover:bg-[--bg-quaternary] text-[--text-secondary] rounded-lg transition-colors text-sm font-medium"
              >
                Load More ({filteredAlumni.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      )}

      {/* Alumni Detail Modal */}
      {selectedAlumni && (
        <AlumniDetailModal
          alumni={selectedAlumni}
          isInNetwork={networkIds.has(selectedAlumni.id)}
          onAddToNetwork={handleAddToNetwork}
          onClose={() => setSelectedAlumni(null)}
          similarAlumni={getSimilarAlumni(selectedAlumni)}
          onSelectAlumni={(alumni) => setSelectedAlumni(alumni)}
          networkIds={networkIds}
        />
      )}
    </main>
  )
}
