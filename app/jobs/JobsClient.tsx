'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Job, JobFilters as FilterType } from '@/types/database'
import JobCard from '@/components/jobs/JobCard'
import JobFilters from '@/components/jobs/JobFilters'
import JobDetail from '@/components/jobs/JobDetail'
import { Loader2, Sparkles, List, Bookmark, Briefcase, Search } from 'lucide-react'

interface JobsClientProps {
  initialJobs: Job[]
  initialSavedIds: string[]
  initialAppliedIds: string[]
  userId: string
  userProfile: {
    sport: string | null
    industry: string | null
    interests: string | null
  }
}

type ViewMode = 'all' | 'recommended' | 'saved'

export default function JobsClient({
  initialJobs,
  initialSavedIds,
  initialAppliedIds,
  userId,
  userProfile,
}: JobsClientProps) {
  const supabase = createClient()
  const [jobs, setJobs] = useState<Job[]>(initialJobs)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<FilterType>({})
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set(initialSavedIds))
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set(initialAppliedIds))

  // Filter jobs based on current filters
  const filteredJobs = useMemo(() => {
    let result = jobs

    if (viewMode === 'saved') {
      result = result.filter(job => savedJobIds.has(job.id))
    }

    if (filters.search) {
      const search = filters.search.toLowerCase()
      result = result.filter(job =>
        job.title.toLowerCase().includes(search) ||
        job.company.toLowerCase().includes(search) ||
        job.description?.toLowerCase().includes(search)
      )
    }

    if (filters.industry) {
      result = result.filter(job => job.industry === filters.industry)
    }

    if (filters.location) {
      const loc = filters.location.toLowerCase()
      result = result.filter(job => job.location?.toLowerCase().includes(loc))
    }

    if (filters.job_type) {
      result = result.filter(job => job.job_type === filters.job_type)
    }

    if (filters.seniority_level) {
      result = result.filter(job => job.seniority_level === filters.seniority_level)
    }

    return result
  }, [jobs, filters, viewMode, savedJobIds])

  // Fetch recommendations
  const fetchRecommendations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/jobs/recommendations')
      const data = await response.json()
      if (data.jobs) {
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch all jobs
  const fetchAllJobs = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/jobs')
      const data = await response.json()
      if (data.jobs) {
        setJobs(data.jobs)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'recommended') {
      fetchRecommendations()
    } else if (mode === 'all') {
      fetchAllJobs()
    }
  }

  // Save job
  const handleSave = async (jobId: string) => {
    try {
      await fetch('/api/jobs/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, interaction_type: 'saved' }),
      })
      setSavedJobIds(prev => new Set([...prev, jobId]))
    } catch (error) {
      console.error('Error saving job:', error)
    }
  }

  // Unsave job
  const handleUnsave = async (jobId: string) => {
    try {
      await fetch(`/api/jobs/interactions?job_id=${jobId}&type=saved`, {
        method: 'DELETE',
      })
      setSavedJobIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    } catch (error) {
      console.error('Error unsaving job:', error)
    }
  }

  // Apply to job
  const handleApply = async (jobId: string) => {
    try {
      await fetch('/api/jobs/interactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, interaction_type: 'applied' }),
      })
      setAppliedJobIds(prev => new Set([...prev, jobId]))
    } catch (error) {
      console.error('Error marking as applied:', error)
    }
  }

  return (
    <main className="min-h-screen bg-[--bg-primary]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[--text-primary] mb-1">Job Board</h1>
          <p className="text-[--text-secondary]">
            Discover opportunities matched to your profile and interests
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => handleViewModeChange('all')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
              viewMode === 'all'
                ? 'bg-[--school-primary] text-white'
                : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary]'
            }`}
          >
            <List className="w-4 h-4" />
            All Jobs
          </button>
          <button
            onClick={() => handleViewModeChange('recommended')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
              viewMode === 'recommended'
                ? 'bg-[--school-primary] text-white'
                : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary]'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            For You
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-colors ${
              viewMode === 'saved'
                ? 'bg-[--school-primary] text-white'
                : 'bg-[--bg-secondary] text-[--text-secondary] hover:bg-[--bg-tertiary] border border-[--border-primary]'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved ({savedJobIds.size})
          </button>
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <aside className="hidden lg:block w-72 flex-shrink-0">
            <div className="bg-[--bg-secondary] rounded-xl border border-[--border-primary] p-5 sticky top-20">
              <JobFilters
                filters={filters}
                onFiltersChange={setFilters}
                totalJobs={filteredJobs.length}
              />
            </div>
          </aside>

          {/* Jobs Grid */}
          <div className="flex-1 min-w-0">
            {/* Mobile Search */}
            <div className="lg:hidden mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--text-quaternary]" />
                <input
                  type="text"
                  placeholder="Search jobs..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value || undefined }))}
                  className="w-full pl-10 pr-4 py-2.5 bg-[--bg-secondary] border border-[--border-primary] rounded-lg text-[--text-primary] placeholder-[--text-quaternary] focus:ring-2 focus:ring-[--school-primary] focus:border-[--school-primary] outline-none"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-[--school-primary] animate-spin" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <div className="text-center py-16 bg-[--bg-secondary] rounded-xl border border-[--border-primary]">
                <div className="w-16 h-16 bg-[--bg-tertiary] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-[--text-quaternary]" />
                </div>
                <h3 className="text-lg font-semibold text-[--text-primary] mb-2">
                  {viewMode === 'saved' ? 'No saved jobs yet' : 'No jobs found'}
                </h3>
                <p className="text-[--text-secondary]">
                  {viewMode === 'saved'
                    ? 'Save jobs you\'re interested in to see them here'
                    : 'Try adjusting your filters to see more results'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    isSaved={savedJobIds.has(job.id)}
                    isApplied={appliedJobIds.has(job.id)}
                    onSave={handleSave}
                    onUnsave={handleUnsave}
                    onClick={setSelectedJob}
                    showMatchScore={viewMode === 'recommended'}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Filters */}
        <JobFilters
          filters={filters}
          onFiltersChange={setFilters}
          totalJobs={filteredJobs.length}
          isMobile
        />
      </div>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          isSaved={savedJobIds.has(selectedJob.id)}
          isApplied={appliedJobIds.has(selectedJob.id)}
          onClose={() => setSelectedJob(null)}
          onSave={handleSave}
          onUnsave={handleUnsave}
          onApply={handleApply}
        />
      )}
    </main>
  )
}
