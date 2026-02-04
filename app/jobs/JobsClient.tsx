'use client'

import { useState, useEffect, useCallback } from 'react'
import { Job, JobFilters as FilterType, UserJobInteraction } from '@/types/database'
import JobCard from '@/components/jobs/JobCard'
import JobFilters from '@/components/jobs/JobFilters'
import JobDetail from '@/components/jobs/JobDetail'
import { Loader2, Sparkles, List, Bookmark, Briefcase } from 'lucide-react'

type ViewMode = 'all' | 'recommended' | 'saved'

export default function JobsClient() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterType>({})
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [savedJobIds, setSavedJobIds] = useState<Set<string>>(new Set())
  const [appliedJobIds, setAppliedJobIds] = useState<Set<string>>(new Set())
  const [totalJobs, setTotalJobs] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)

  // Fetch jobs
  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.search) params.set('search', filters.search)
      if (filters.industry) params.set('industry', filters.industry)
      if (filters.location) params.set('location', filters.location)
      if (filters.job_type) params.set('job_type', filters.job_type)
      if (filters.seniority_level) params.set('seniority_level', filters.seniority_level)
      params.set('page', String(page))

      const endpoint = viewMode === 'recommended' ? '/api/jobs/recommendations' : '/api/jobs'
      const response = await fetch(`${endpoint}?${params}`)
      const data = await response.json()

      if (viewMode === 'saved') {
        // Fetch saved jobs specifically
        const savedResponse = await fetch('/api/jobs/interactions?type=saved')
        const savedData = await savedResponse.json()
        const savedJobs = savedData.interactions
          ?.map((i: UserJobInteraction) => i.job)
          .filter(Boolean) || []
        setJobs(savedJobs)
        setTotalJobs(savedJobs.length)
        setHasMore(false)
      } else {
        setJobs(data.jobs || [])
        setTotalJobs(data.total || 0)
        setHasMore(data.hasMore || false)
      }
    } catch (error) {
      console.error('Error fetching jobs:', error)
    } finally {
      setLoading(false)
    }
  }, [filters, viewMode, page])

  // Fetch user's interactions
  const fetchInteractions = useCallback(async () => {
    try {
      const [savedRes, appliedRes] = await Promise.all([
        fetch('/api/jobs/interactions?type=saved'),
        fetch('/api/jobs/interactions?type=applied'),
      ])

      const savedData = await savedRes.json()
      const appliedData = await appliedRes.json()

      setSavedJobIds(new Set(savedData.interactions?.map((i: UserJobInteraction) => i.job_id) || []))
      setAppliedJobIds(new Set(appliedData.interactions?.map((i: UserJobInteraction) => i.job_id) || []))
    } catch (error) {
      console.error('Error fetching interactions:', error)
    }
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  useEffect(() => {
    fetchInteractions()
  }, [fetchInteractions])

  // Reset page when filters change
  useEffect(() => {
    setPage(1)
  }, [filters, viewMode])

  // Save/unsave job
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
      // Refresh if viewing saved jobs
      if (viewMode === 'saved') {
        fetchJobs()
      }
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Board</h1>
          <p className="text-gray-600">
            Discover opportunities matched to your profile and interests
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setViewMode('all')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              viewMode === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <List className="w-4 h-4" />
            All Jobs
          </button>
          <button
            onClick={() => setViewMode('recommended')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              viewMode === 'recommended'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            For You
          </button>
          <button
            onClick={() => setViewMode('saved')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${
              viewMode === 'saved'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            Saved ({savedJobIds.size})
          </button>
        </div>

        <div className="flex gap-8">
          {/* Filters Sidebar */}
          {viewMode !== 'saved' && (
            <aside className="hidden md:block w-72 flex-shrink-0">
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-8">
                <JobFilters
                  filters={filters}
                  onFiltersChange={setFilters}
                  totalJobs={totalJobs}
                />
              </div>
            </aside>
          )}

          {/* Jobs Grid */}
          <main className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-xl border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {viewMode === 'saved' ? 'No saved jobs yet' : 'No jobs found'}
                </h3>
                <p className="text-gray-600">
                  {viewMode === 'saved'
                    ? 'Save jobs you\'re interested in to see them here'
                    : 'Try adjusting your filters to see more results'}
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      isSaved={savedJobIds.has(job.id)}
                      onSave={handleSave}
                      onUnsave={handleUnsave}
                      onClick={setSelectedJob}
                      showMatchScore={viewMode === 'recommended'}
                    />
                  ))}
                </div>

                {/* Load More */}
                {hasMore && (
                  <div className="mt-6 text-center">
                    <button
                      onClick={() => setPage(p => p + 1)}
                      className="px-6 py-3 bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Load More Jobs
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>

        {/* Mobile Filters */}
        {viewMode !== 'saved' && (
          <JobFilters
            filters={filters}
            onFiltersChange={setFilters}
            totalJobs={totalJobs}
          />
        )}
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
    </div>
  )
}

