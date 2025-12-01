'use client'

import { Search } from 'lucide-react'

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
      <div className="relative flex-1 min-w-[300px]">
        <Search
          size={18}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
        />
        <input
          type="text"
          placeholder="Search by name, company, or role..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="input-field pl-11"
        />
      </div>

      <select
        value={industryFilter}
        onChange={(e) => onIndustryChange(e.target.value)}
        className="input-field w-auto min-w-[160px] cursor-pointer"
      >
        {industries.map((ind) => (
          <option key={ind} value={ind}>
            {ind}
          </option>
        ))}
      </select>

      <select
        value={sportFilter}
        onChange={(e) => onSportChange(e.target.value)}
        className="input-field w-auto min-w-[160px] cursor-pointer"
      >
        {sports.map((sport) => (
          <option key={sport} value={sport}>
            {sport}
          </option>
        ))}
      </select>
    </div>
  )
}
