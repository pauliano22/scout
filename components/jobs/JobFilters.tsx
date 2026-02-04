'use client'

import { JobFilters as FilterType } from '@/types/database'
import { Search, X, Filter } from 'lucide-react'
import { useState } from 'react'

interface JobFiltersProps {
  filters: FilterType
  onFiltersChange: (filters: FilterType) => void
  totalJobs?: number
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
  { value: 'entry', label: 'Entry Level' },
  { value: 'mid', label: 'Mid Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'executive', label: 'Executive' },
]

export default function JobFilters({
  filters,
  onFiltersChange,
  totalJobs,
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
    <>
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search || ''}
          onChange={(e) => updateFilter('search', e.target.value || undefined)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {/* Industry */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Industry</label>
        <div className="flex flex-wrap gap-2">
          {INDUSTRIES.map((industry) => (
            <button
              key={industry}
              onClick={() =>
                updateFilter('industry', filters.industry === industry ? undefined : industry)
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                filters.industry === industry
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {industry}
            </button>
          ))}
        </div>
      </div>

      {/* Job Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Work Type</label>
        <div className="flex flex-wrap gap-2">
          {JOB_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('job_type', filters.job_type === value ? undefined : value as FilterType['job_type'])
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                filters.job_type === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Seniority */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Experience Level</label>
        <div className="flex flex-wrap gap-2">
          {SENIORITY_LEVELS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() =>
                updateFilter('seniority_level', filters.seniority_level === value ? undefined : value)
              }
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                filters.seniority_level === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Location */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
        <input
          type="text"
          placeholder="City, State, or Country"
          value={filters.location || ''}
          onChange={(e) => updateFilter('location', e.target.value || undefined)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        />
      </div>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="w-full py-2 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Clear all filters
        </button>
      )}

      {/* Results count */}
      {totalJobs !== undefined && (
        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{totalJobs}</span> jobs found
          </p>
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Mobile filter button */}
      <button
        onClick={() => setShowMobileFilters(true)}
        className="md:hidden fixed bottom-4 right-4 z-40 bg-primary-600 text-white px-4 py-3 rounded-full shadow-lg flex items-center gap-2"
      >
        <Filter className="w-5 h-5" />
        Filters
        {hasActiveFilters && (
          <span className="w-2 h-2 bg-white rounded-full" />
        )}
      </button>

      {/* Mobile filters drawer */}
      {showMobileFilters && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50" onClick={() => setShowMobileFilters(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-80 bg-white p-6 space-y-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">Filters</h2>
              <button onClick={() => setShowMobileFilters(false)}>
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            <FilterContent />
          </div>
        </div>
      )}

      {/* Desktop filters */}
      <div className="hidden md:block space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <FilterContent />
      </div>
    </>
  )
}
