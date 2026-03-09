'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import Avatar from '@/components/Avatar'
import { Search, Check, ChevronRight, Users, ChevronDown, X, Loader2, MapPin, Flame } from 'lucide-react'
import { trackEvent } from '@/lib/track'
import { SPORTS_LIST } from '@/lib/sportUtils'

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
  photo_url?: string | null
  avatar_url?: string | null
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

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [industryFilter, setIndustryFilter] = useState('All')
  const [sportFilter, setSportFilter] = useState<string | null>(null)
  const [locationFilter, setLocationFilter] = useState('')

  // Data state
  const [alumni, setAlumni] = useState<DiscoverAlumni[]>(initialAlumni)
  const [totalCount, setTotalCount] = useState(totalAlumniCount)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialAlumni.length < totalAlumniCount)

  // Loading state
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Network & modal state
  const [networkIds, setNetworkIds] = useState<Set<string>>(new Set(initialNetworkIds))
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [selectedAlumni, setSelectedAlumni] = useState<DiscoverAlumni | null>(null)
  const [similarAlumni, setSimilarAlumni] = useState<DiscoverAlumni[]>([])

  // Debounce ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Track whether this is the initial render (no filters applied yet)
  const isInitialRender = useRef(true)

  // Fetch alumni from server
  const fetchAlumni = useCallback(async (
    search: string,
    industry: string,
    sport: string | null,
    location: string,
    page: number,
    append: boolean
  ) => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (industry !== 'All') params.set('industry', industry)
    if (sport) params.set('sport', sport)
    if (location.trim()) params.set('location', location.trim())
    params.set('page', String(page))
    params.set('limit', String(ITEMS_PER_PAGE))

    const res = await fetch(`/api/alumni/search?${params.toString()}`)
    if (!res.ok) throw new Error('Search failed')

    const data = await res.json()

    if (append) {
      setAlumni(prev => [...prev, ...data.alumni])
    } else {
      setAlumni(data.alumni)
    }
    setTotalCount(data.total)
    setCurrentPage(page)
    setHasMore(data.hasMore)
  }, [])

  // Debounced search - fires when search/filters change
  useEffect(() => {
    // Skip the initial render - we already have SSR data
    if (isInitialRender.current) {
      isInitialRender.current = false
      return
    }

    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        await fetchAlumni(searchQuery, industryFilter, sportFilter, locationFilter, 1, false)
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery, industryFilter, sportFilter, locationFilter, fetchAlumni])

  // Load more handler
  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      await fetchAlumni(searchQuery, industryFilter, sportFilter, locationFilter, currentPage + 1, true)
    } catch (err) {
      console.error('Load more error:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // Add to network
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
      trackEvent('alumni_added_to_network', { alumni_id: alumniId, source: 'discover' })
    } catch (error) {
      console.error('Error adding to network:', error)
      alert('Failed to add to network. Please try again.')
    } finally {
      setLoadingId(null)
    }
  }

  // Fetch similar alumni when modal opens
  const handleSelectAlumni = async (selected: DiscoverAlumni) => {
    setSelectedAlumni(selected)
    setSimilarAlumni([])

    try {
      const params = new URLSearchParams({ alumni_id: selected.id })
      if (selected.industry) params.set('industry', selected.industry)
      if (selected.sport) params.set('sport', selected.sport)
      if (selected.company) params.set('company', selected.company)

      const res = await fetch(`/api/alumni/similar?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setSimilarAlumni(data.similar || [])
      }
    } catch {
      // Similar alumni are non-critical, silently fail
    }
  }

  const handleMySportFilter = () => {
    if (sportFilter === userSport) {
      setSportFilter(null)
    } else if (userSport) {
      setSportFilter(userSport)
    }
  }

  const handleClearAllFilters = () => {
    setSearchQuery('')
    setIndustryFilter('All')
    setSportFilter(null)
    setLocationFilter('')
  }

  const hasActiveFilters = industryFilter !== 'All' || sportFilter !== null || searchQuery !== '' || locationFilter !== ''

  // Active filter summary for results line
  const activeFilterParts: string[] = []
  if (sportFilter) activeFilterParts.push(sportFilter)
  if (industryFilter !== 'All') activeFilterParts.push(industryFilter)
  if (locationFilter.trim()) activeFilterParts.push(locationFilter.trim())

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="text-center mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Connect with Cornell Athlete Alumni
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Search <span className="text-[--school-primary] font-medium">{totalAlumniCount.toLocaleString()}</span> alumni to find mentors in your target industry
        </p>
      </div>

      {/* Search Section - Hero/Focus */}
      <div className="card p-6 mb-6">
        {/* Large Search Bar */}
        <div className="relative mb-4">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, company, role, or industry..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3.5 pl-12 pr-4 text-base bg-[--bg-primary] border border-[--border-primary] rounded-xl focus:border-[--border-secondary] focus:outline-none transition-colors"
          />
          {isSearching && (
            <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] animate-spin" />
          )}
        </div>

        {/* Location Search Bar */}
        <div className="relative mb-5">
          <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by location (e.g. San Diego, New York)"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className="w-full py-2.5 pl-11 pr-4 text-sm bg-[--bg-primary] border border-[--border-primary] rounded-xl focus:border-[--border-secondary] focus:outline-none transition-colors"
          />
          {locationFilter && (
            <button
              onClick={() => setLocationFilter('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-quaternary] hover:text-[--text-secondary]"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {industries.map((industry) => (
            <button
              key={industry}
              onClick={() => setIndustryFilter(industry)}
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

          {/* Sport Dropdown */}
          <div className="relative">
            <select
              value={sportFilter || ''}
              onChange={(e) => setSportFilter(e.target.value || null)}
              className={`px-3.5 py-1.5 pr-8 rounded-full text-sm font-medium transition-all cursor-pointer appearance-none ${
                sportFilter && sportFilter !== userSport
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-hover] border border-[--border-primary]'
              }`}
            >
              <option value="">All Sports</option>
              {SPORTS_LIST.map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className={`absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                sportFilter && sportFilter !== userSport ? 'text-white/70' : 'text-[--text-quaternary]'
              }`}
            />
          </div>

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="px-3.5 py-1.5 rounded-full text-sm font-medium transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5"
            >
              <X size={14} />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <p className="text-[--text-quaternary] text-sm mb-4">
        Showing {alumni.length} of {totalCount.toLocaleString()} alumni
        {activeFilterParts.length > 0 && (
          <span> matching <span className="text-[--school-primary]">{activeFilterParts.join(' + ')}</span></span>
        )}
      </p>

      {/* Alumni List */}
      {isSearching && alumni.length === 0 ? (
        <div className="text-center py-16">
          <Loader2 size={32} className="mx-auto text-[--text-quaternary] animate-spin mb-3" />
          <p className="text-[--text-secondary]">Searching alumni...</p>
        </div>
      ) : alumni.length === 0 ? (
        <div className="text-center py-16">
          <div className="empty-state-icon">
            <Search size={32} className="text-[--text-quaternary]" />
          </div>
          <p className="text-base text-[--text-secondary] mb-1">No alumni found</p>
          <p className="text-[--text-quaternary] text-sm">Try adjusting your search or filters</p>
        </div>
      ) : (
        <>
          <div className={`flex flex-col gap-3 ${isSearching ? 'opacity-50 pointer-events-none' : ''}`}>
            {alumni.map((alumniItem) => {
              const isSameSport = userSport && alumniItem.sport && alumniItem.sport.toLowerCase() === userSport.toLowerCase()

              return (
                <button
                  key={alumniItem.id}
                  onClick={() => handleSelectAlumni(alumniItem)}
                  className={`w-full card p-4 flex items-center gap-4 hover:bg-[--bg-tertiary] transition-all text-left group ${
                    isSameSport
                      ? 'border-[--school-primary]/40 hover:border-[--school-primary]/60'
                      : 'hover:border-[--border-secondary]'
                  }`}
                >
                  {/* Avatar */}
                  <Avatar name={alumniItem.full_name} sport={alumniItem.sport} imageUrl={alumniItem.photo_url || alumniItem.avatar_url} size="md" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-medium text-[--text-primary] truncate transition-colors">
                        {alumniItem.full_name}
                      </h3>
                      {networkIds.has(alumniItem.id) && (
                        <span className="flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full flex-shrink-0 border border-emerald-500/20">
                          <Check size={10} />
                          Connected
                        </span>
                      )}
                    </div>

                    {/* Role @ Company */}
                    <p className="text-sm text-[--text-secondary] truncate">
                      {alumniItem.role && alumniItem.role !== '...' && alumniItem.company && alumniItem.company !== '...'
                        ? `${alumniItem.role} @ ${alumniItem.company}`
                        : (alumniItem.role && alumniItem.role !== '...' ? alumniItem.role : '') || (alumniItem.company && alumniItem.company !== '...' ? alumniItem.company : '') || 'Cornell Athlete Alumni'}
                    </p>

                    {/* Sport badge + Year */}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {isSameSport ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border bg-[--school-primary]/10 text-[--school-primary] border-[--school-primary]/30 font-medium">
                          <Flame size={10} />
                          Played {alumniItem.sport} like you
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-[--bg-tertiary] text-[--text-quaternary] border-[--border-primary]">
                          {alumniItem.sport}
                        </span>
                      )}
                      {alumniItem.graduation_year && (
                        <span className="text-xs text-[--text-quaternary]">
                          Class of {alumniItem.graduation_year}
                        </span>
                      )}
                      {alumniItem.location && (
                        <span className="text-xs text-[--text-quaternary] flex items-center gap-1">
                          <MapPin size={10} />
                          {alumniItem.location}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Industry Badge - only show if it's a valid/verified industry */}
                  {alumniItem.industry && validIndustries.has(alumniItem.industry) && (
                    <span
                      className={`hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium flex-shrink-0 border ${
                        industryBadgeClass[alumniItem.industry] || 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
                      }`}
                    >
                      {alumniItem.industry}
                    </span>
                  )}

                  <ChevronRight size={18} className="text-[--text-quaternary] flex-shrink-0 group-hover:text-[--text-secondary] group-hover:translate-x-0.5 transition-all" />
                </button>
              )
            })}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="mt-8 text-center">
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="btn-secondary px-8 py-3"
              >
                {isLoadingMore ? (
                  <span className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `Load More (${(totalCount - alumni.length).toLocaleString()} remaining)`
                )}
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
          onClose={() => { setSelectedAlumni(null); setSimilarAlumni([]) }}
          similarAlumni={similarAlumni}
          onSelectAlumni={(a) => handleSelectAlumni(a as DiscoverAlumni)}
          networkIds={networkIds}
        />
      )}
    </main>
  )
}
