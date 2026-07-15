'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import AlumniCard from '@/components/AlumniCard'
import { Search, Users, ChevronDown, X, Loader2, MapPin } from 'lucide-react'
import { trackEvent } from '@/lib/track'
import { fetchWithTimeout } from '@/lib/fetchWithTimeout'
import { SPORTS_LIST } from '@/lib/sportUtils'
import type { WorkHistoryEntry } from '@scout/shared/types/database'

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
  prestige_score?: number | null
  engagement_intent?: string | null
  display_headline?: string | null
  work_history?: WorkHistoryEntry[] | null
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
  const [actionError, setActionError] = useState<string | null>(null)
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
  const [warmPaths, setWarmPaths] = useState<Record<string, { count: number; topName: string; topRelation: string; topSeasons?: number; topSports?: string[] }>>({})
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

    const res = await fetchWithTimeout(`/api/alumni/search?${params.toString()}`, {}, 12_000)
    if (!res.ok) throw new Error('Search failed')

    const data = await res.json()
    const items: DiscoverAlumni[] = Array.isArray(data?.alumni) ? data.alumni : []

    if (append) {
      setAlumni(prev => {
        const existingIds = new Set(prev.map(a => a.id))
        const newItems = items.filter((a: DiscoverAlumni) => !existingIds.has(a.id))
        return [...prev, ...newItems]
      })
    } else {
      setAlumni(items)
    }
    setTotalCount(typeof data?.total === 'number' ? data.total : items.length)
    setCurrentPage(page)
    setHasMore(Boolean(data?.hasMore))
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
        if (searchQuery || industryFilter !== 'All' || sportFilter || locationFilter) {
          trackEvent('search_performed', { query: searchQuery, industry: industryFilter, sport: sportFilter, location: locationFilter })
        }
      } catch (err) {
        console.error('Search error:', err)
        setActionError('Search didn\u2019t go through \u2014 check your connection and try again.')
        setTimeout(() => setActionError(null), 6000)
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

  // Warm paths for visible results — "who in my network can introduce me"
  useEffect(() => {
    const ids = alumni.map((a) => a.id).filter((id) => !(id in warmPaths)).slice(0, 200)
    if (!ids.length) return
    fetch('/api/alumni/warm-paths', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alumniIds: ids }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (body?.paths) setWarmPaths((w) => ({ ...w, ...body.paths })) })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumni])

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
      // alert() is unreliable inside Instagram's in-app browser — show inline.
      console.error('Error adding to network:', error)
      setActionError('Couldn\u2019t add them to your network \u2014 try again.')
      setTimeout(() => setActionError(null), 6000)
    } finally {
      setLoadingId(null)
    }
  }

  // Fetch similar alumni when modal opens
  const handleSelectAlumni = async (selected: DiscoverAlumni) => {
    setSelectedAlumni(selected)
    setSimilarAlumni([])
    trackEvent('alumni_profile_opened', { alumni_id: selected.id, industry: selected.industry, sport: selected.sport })

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

  return (
    <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto">
      {actionError && (
        <button
          onClick={() => setActionError(null)}
          className="mb-4 w-full text-left rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-500"
        >
          {actionError}
        </button>
      )}
      {/* Search bar — hero element, no distracting headline */}
      <div className="mb-5">
        {/* Main search */}
        <div className="relative mb-2">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
          <input
            type="text"
            placeholder="Search alumni"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full py-3.5 pl-11 pr-10 text-sm bg-[--bg-secondary] shadow-[var(--shadow-soft)] rounded-xl focus:border-[--border-secondary] focus:outline-none transition-colors"
            autoFocus
          />
          {isSearching ? (
            <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[--text-quaternary] animate-spin" />
          ) : searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[--text-quaternary] hover:text-[--text-secondary]"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>

        {/* Filters row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Industry pills */}
          {industries.map((industry) => (
            <button
              key={industry}
              onClick={() => setIndustryFilter(industry)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                industryFilter === industry
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] shadow-[var(--shadow-soft)]'
              }`}
            >
              {industry}
            </button>
          ))}

          {/* Divider */}
          <div className="w-px h-4 bg-[--border-primary]" />

          {/* My Sport */}
          {userSport && (
            <button
              onClick={handleMySportFilter}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1 ${
                sportFilter === userSport
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-secondary] text-[--school-primary] hover:bg-[--bg-tertiary] border border-[--school-primary]/50'
              }`}
            >
              <Users size={12} />
              My Sport
            </button>
          )}

          {/* Sport Dropdown */}
          <div className="relative">
            <select
              value={sportFilter || ''}
              onChange={(e) => setSportFilter(e.target.value || null)}
              className={`px-3 py-1.5 pr-7 rounded-xl text-xs font-medium transition-colors cursor-pointer appearance-none ${
                sportFilter && sportFilter !== userSport
                  ? 'bg-[--school-primary] text-white'
                  : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] shadow-[var(--shadow-soft)]'
              }`}
            >
              <option value="">All Sports</option>
              {SPORTS_LIST.map((sport) => (
                <option key={sport} value={sport}>{sport}</option>
              ))}
            </select>
            <ChevronDown
              size={12}
              className={`absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                sportFilter && sportFilter !== userSport ? 'text-white/70' : 'text-[--text-quaternary]'
              }`}
            />
          </div>

          {/* Location inline */}
          <div className="relative">
            <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-quaternary] pointer-events-none" />
            <input
              type="text"
              placeholder="Location"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={`pl-7 pr-6 py-1.5 rounded-xl text-xs font-medium transition-colors border focus:outline-none w-full sm:w-28 sm:focus:w-36 ${
                locationFilter
                  ? 'bg-[--school-primary] text-white border-[--school-primary] placeholder-white/60'
                  : 'bg-[--bg-secondary] text-[--text-secondary] border-[--border-primary] hover:bg-[--bg-tertiary]'
              }`}
            />
            {locationFilter && (
              <button
                onClick={() => setLocationFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Clear all */}
          {hasActiveFilters && (
            <button
              onClick={handleClearAllFilters}
              className="text-xs text-[--text-quaternary] hover:text-red-400 transition-colors flex items-center gap-1 ml-1"
            >
              <X size={12} />
              Clear
            </button>
          )}

          {/* Results count — right-aligned */}
          <span className="ml-auto text-xs text-[--text-quaternary]">
            {totalCount.toLocaleString()} alumni
          </span>
        </div>
      </div>

      {/* Alumni List */}
      {isSearching && alumni.length === 0 ? (
        <div className="text-center py-16">
          <Loader2 size={32} className="mx-auto text-[--text-quaternary] animate-spin mb-3" />
          <p className="text-[--text-secondary]">Searching alumni...</p>
        </div>
      ) : alumni.length === 0 ? (
        <div className="text-center py-20">
          <Search size={28} className="mx-auto text-[--text-quaternary] mb-3" />
          <p className="text-sm font-medium text-[--text-secondary] mb-1">No alumni found</p>
          <p className="text-xs text-[--text-quaternary]">No matches for those filters. Try removing one, or search by company, industry, or sport instead.</p>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${isSearching ? 'opacity-50 pointer-events-none' : ''}`}>
            {alumni.map((alumniItem) => (
              <AlumniCard
                key={alumniItem.id}
                alumni={alumniItem as any}
                isInNetwork={networkIds.has(alumniItem.id)}
                onAddToNetwork={handleAddToNetwork}
                onClick={() => handleSelectAlumni(alumniItem)}
                isLoading={loadingId === alumniItem.id}
                warmNote={warmPaths[alumniItem.id]
                  ? `${warmPaths[alumniItem.id].topName}${warmPaths[alumniItem.id].count > 1 ? ` +${warmPaths[alumniItem.id].count - 1}` : ''} can introduce you${
                      warmPaths[alumniItem.id].topRelation === 'teammate' && (warmPaths[alumniItem.id].topSeasons ?? 0) > 0
                        ? ` · ${warmPaths[alumniItem.id].topSeasons} season${(warmPaths[alumniItem.id].topSeasons ?? 0) > 1 ? 's' : ''} together`
                        : ''
                    }`
                  : null}
              />
            ))}
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
