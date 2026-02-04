'use client'

import { JobFilters as FilterType } from '@/types/database'
import { Search, X, Filter } from 'lucide-react'
import { useState } from 'react'

interface JobFiltersProps {
  filters: FilterType
  onFiltersChange: (filters: FilterType) => void
  totalJobs?: number
  isMobile?: boolean
}

const INDUSTRIES = [
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
]

const JOB_TYPES = [
  { value: 'remote', label: 'Remote' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'onsite', label: 'On-site' },
]

const SENIORITY_LEVELS = [
  { value: 'internship', label: 'Internship' },
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
]

export default function JobFilters({
  filters,
  onFiltersChange,
  totalJobs,
  isMobile = false,
}: JobFiltersProps) {
  const [showMobileFilters, setShowMobileFilters] = useState(false)

  const updateFilter = (key: keyof FilterType, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value,
    })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  const hasActiveFilters = Object.values(filters).some(v => v)

  const FilterContent = () => (
    <div className="space-y-5">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-quaternary]" />
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
          className="w-full pl-10 pr-4 py-2 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder-[--text-quaternary] focus:ring-2 focus:ring-[--school-primary] focus:border-[--school-primary] outline-none text-sm"
        />
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-[--text-primary] mb-2">Industry</label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((industry) => (
            <button
              key={industry}
              onClick={() =>
                updateFilter('industry', filters.industry === industry ? undefined : industry)
              }
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${
                filters.industry === industry
                  ? 'bg-[--school-primary] text-white border-[--school-primary]'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] hover:border-[--border-hover]'
              }`}
            >
              {industry}
            </button>
          ))}
        </div>
      </div>

      {/* Job Type */}
      <div>
        <label className="block text-sm font-medium text-[--text-primary] mb-2">Work Type</label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('job_type', filters.job_type === value ? undefined : value as FilterType['job_type'])
              }
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${
                filters.job_type === value
                  ? 'bg-[--school-primary] text-white border-[--school-primary]'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] hover:border-[--border-hover]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Seniority */}
      <div>
        <label className="block text-sm font-medium text-[--text-primary] mb-2">Level</label>
        <div className="flex flex-wrap gap-2">
          {SENIORITY_LEVELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('seniority_level', filters.seniority_level === value ? undefined : value)
              }
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors border ${
                filters.seniority_level === value
                  ? 'bg-[--school-primary] text-white border-[--school-primary]'
                  : 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary] hover:border-[--border-hover]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-[--text-primary] mb-2">Location</label>
        <input
          type="text"
          placeholder="City, State..."
          value={filters.location || ''}
          onChange={(e) => updateFilter('location', e.target.value || undefined)}
          className="w-full px-3 py-2 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder-[--text-quaternary] focus:ring-2 focus:ring-[--school-primary] focus:border-[--school-primary] outline-none text-sm"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-2 text-sm text-[--text-secondary] hover:text-[--text-primary] flex items-center justify-center gap-2 transition-colors"
        >
          <X className="w-4 h-4" />
          Clear all filters
        </button>
      )}

      {/* Results count */}
      {totalJobs !== undefined && (
        <div className="pt-4 border-t border-[--border-primary]">
          <p className="text-sm text-[--text-secondary]">
            <span className="font-semibold text-[--text-primary]">{totalJobs}</span> jobs found
          </p>
        </div>
      )}
    </div>
  )

  // Mobile version - floating button and drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile filter button */}
        <button
          onClick={() => setShowMobileFilters(true)}
          className="lg:hidden fixed bottom-4 right-4 z-40 bg-[--school-primary] text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
        >
          <Filter className="w-5 h-5" />
          Filters
          {hasActiveFilters && (
            <span className="w-2 h-2 bg-white rounded-full" />
          )}
        </button>

        {/* Mobile filters drawer */}
        {showMobileFilters && (
          <div className="lg:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobileFilters(false)}>
            <div
              className="absolute right-0 top-0 bottom-0 w-80 bg-[--bg-secondary] p-5 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-5">
                <h2 className="text-lg font-semibold text-[--text-primary]">Filters</h2>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="p-1 rounded-lg hover:bg-[--bg-tertiary]"
                >
                  <X className="w-5 h-5 text-[--text-secondary]" />
                </button>
              </div>
              <FilterContent />
            </div>
          </div>
        )}
      </>
    )
  }

  // Desktop version
  return (
    <>
      <h2 className="text-base font-semibold text-[--text-primary] mb-4">Filters</h2>
      <FilterContent />
    </>
  )
}
