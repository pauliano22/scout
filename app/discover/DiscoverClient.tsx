'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import Avatar from '@/components/Avatar'
import { Search, Check, ChevronRight, Users, Sparkles } from 'lucide-react'

// Partial Alumni type for discover page (only fields we fetch)
export interface DiscoverAlumni {
  id: string
  full_name: string
  company: string | null
  role: string | null
  industry: string | null
  sport: string
  graduation_year: number
  linkedin_url: string | null
  location: string | null
}

interface DiscoverClientProps {
  initialAlumni: DiscoverAlumni[]
  networkAlumniIds: string[]
  userId: string
  userSport: string | null
  totalAlumniCount: number
}

const ITEMS_PER_PAGE = 50

const industries = ['All', 'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media']

// Only these specific industries get colored badges - prevents showing incorrect/inferred industries
const validIndustries = new Set(['Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media', 'Sports', 'Education', 'Real Estate', 'Government', 'Nonprofit'])

const industryBadgeClass: Record<string, string> = {
  Finance: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Technology: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Consulting: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Healthcare: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Law: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Media: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Sports: 'bg-red-500/10 text-red-400 border-red-500/20',
  Education: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  'Real Estate': 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Government: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Nonprofit: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
  const [selectedAlumni, setSelectedAlumni] = useState<DiscoverAlumni | null>(null)

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
  const getSimilarAlumni = (alumni: DiscoverAlumni): DiscoverAlumni[] => {
    const similar: DiscoverAlumni[] = []

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
          <div className="empty-state-icon">
            <Search size={32} className="text-[--text-quaternary]" />
          </div>
          <p className="text-base text-[--text-secondary] mb-1">No alumni found</p>
          <p className="text-[--text-quaternary] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {visibleAlumni.map((alumni) => (
              <button
                key={alumni.id}
                onClick={() => setSelectedAlumni(alumni)}
                className="w-full card p-4 flex items-center gap-4 hover:bg-[--bg-tertiary] hover:border-[--border-secondary] transition-all text-left group"
              >
                {/* Avatar */}
                <Avatar name={alumni.full_name} sport={alumni.sport} imageUrl={alumni.avatar_url} size="md" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h3 className="font-medium text-[--text-primary] truncate transition-colors">
                      {alumni.full_name}
                    </h3>
                    {networkIds.has(alumni.id) && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0 border border-emerald-500/20">
                        <Check size={10} />
                        Connected
                      </span>
                    )}
                  </div>

                  {/* Role @ Company */}
                  <p className="text-sm text-[--text-secondary] truncate">
                    {alumni.role && alumni.company
                      ? `${alumni.role} @ ${alumni.company}`
                      : alumni.company || alumni.role || 'Cornell Athlete Alumni'}
                  </p>

                  {/* Sport & Year */}
                  <p className="text-xs text-[--text-quaternary] mt-1 flex items-center gap-2">
                    <span>{alumni.sport}</span>
                    {alumni.graduation_year && (
                      <>
                        <span className="w-1 h-1 rounded-full bg-[--text-quaternary]" />
                        <span>Class of {alumni.graduation_year}</span>
                      </>
                    )}
                  </p>
                </div>

                {/* Industry Badge - only show if it's a valid/verified industry */}
                {alumni.industry && validIndustries.has(alumni.industry) && (
                  <span
                    className={`hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 border ${
                      industryBadgeClass[alumni.industry] || 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
                    }`}
                  >
                    {alumni.industry}
                  </span>
                )}

                <ChevronRight size={18} className="text-[--text-quaternary] flex-shrink-0 group-hover:text-[--text-secondary] group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                className="btn-secondary px-8 py-3"
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
