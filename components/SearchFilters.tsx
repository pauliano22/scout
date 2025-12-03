'use client'

import { Search, ChevronDown } from 'lucide-react'

interface SearchFiltersProps {
  searchQuery: string
  onSearchChange: (value: string) => void
  industryFilter: string
  onIndustryChange: (value: string) => void
  sportFilter: string
  onSportChange: (value: string) => void
}

const industries = [
  'All Industries',
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
]

const sports = [
  'All Sports',
  'Basketball',
  'Soccer',
  'Football',
  'Lacrosse',
  'Tennis',
  'Swimming',
  'Baseball',
  'Volleyball',
  'Hockey',
  'Track & Field',
  'Rowing',
  'Wrestling',
  'Golf',
  'Field Hockey',
  'Cross Country',
  'Fencing',
  'Gymnastics',
]

export default function SearchFilters({
  searchQuery,
  onSearchChange,
  industryFilter,
  onIndustryChange,
  sportFilter,
  onSportChange,
}: SearchFiltersProps) {
  return (
    <div className="flex gap-4 mb-8 flex-wrap">
      {/* Search Input with proper icon layering */}
      <div className="search-input-wrapper relative flex-1 min-w-[300px]">
        <Search
          size={18}
          className="search-icon"
        />
        <input
          type="text"
          placeholder="Search by name, company, or role..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-12"
        />
      </div>

      {/* Industry Filter */}
      <div className="relative">
        <select
          value={industryFilter}
          onChange={(e) => onIndustryChange(e.target.value)}
          className="input-field w-auto min-w-[160px] cursor-pointer appearance-none pr-10"
        >
          {industries.map((ind) => (
            <option key={ind} value={ind}>
              {ind}
            </option>
          ))}
        </select>
        <ChevronDown 
          size={16} 
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
      </div>

      {/* Sport Filter */}
      <div className="relative">
        <select
          value={sportFilter}
          onChange={(e) => onSportChange(e.target.value)}
          className="input-field w-auto min-w-[160px] cursor-pointer appearance-none pr-10"
        >
          {sports.map((sport) => (
            <option key={sport} value={sport}>
              {sport}
            </option>
          ))}
        </select>
        <ChevronDown 
          size={16} 
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
      </div>
    </div>
  )
}
