'use client'

import { Job } from '@/types/database'
import { MapPin, Building2, Briefcase, DollarSign, Clock, Bookmark, BookmarkCheck, ExternalLink } from 'lucide-react'

interface JobCardProps {
  job: Job
  isSaved?: boolean
  onSave?: (jobId: string) => void
  onUnsave?: (jobId: string) => void
  onClick?: (job: Job) => void
  showMatchScore?: boolean
}

export default function JobCard({
  job,
  isSaved = false,
  onSave,
  onUnsave,
  onClick,
  showMatchScore = false,
}: JobCardProps) {
  const handleSaveClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSaved && onUnsave) {
      onUnsave(job.id)
    } else if (onSave) {
      onSave(job.id)
    }
  }

  const getJobTypeColor = (type: string | null) => {
    switch (type) {
      case 'remote':
        return 'bg-green-100 text-green-800'
      case 'hybrid':
        return 'bg-blue-100 text-blue-800'
      case 'onsite':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getSeniorityColor = (level: string | null) => {
    switch (level) {
      case 'entry':
        return 'bg-purple-100 text-purple-800'
      case 'mid':
        return 'bg-indigo-100 text-indigo-800'
      case 'senior':
        return 'bg-orange-100 text-orange-800'
      case 'executive':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all cursor-pointer group"
      onClick={() => onClick?.(job)}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and Company */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-gray-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors truncate">
                {job.title}
              </h3>
              <p className="text-sm text-gray-600">{job.company}</p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-3 text-sm text-gray-500 mb-3">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {job.location}
              </span>
            )}
            {job.industry && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {job.industry}
              </span>
            )}
            {job.salary_range && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-4 h-4" />
                {job.salary_range}
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {job.job_type && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getJobTypeColor(job.job_type)}`}>
                {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}
              </span>
            )}
            {job.seniority_level && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSeniorityColor(job.seniority_level)}`}>
                {job.seniority_level.charAt(0).toUpperCase() + job.seniority_level.slice(1)} Level
              </span>
            )}
            {showMatchScore && job.similarity && (
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getMatchScoreColor(job.similarity)}`}>
                {Math.round(job.similarity * 100)}% Match
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={handleSaveClick}
            className={`p-2 rounded-lg transition-colors ${
              isSaved
                ? 'bg-primary-100 text-primary-600'
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
            title={isSaved ? 'Remove from saved' : 'Save job'}
          >
            {isSaved ? (
              <BookmarkCheck className="w-5 h-5" />
            ) : (
              <Bookmark className="w-5 h-5" />
            )}
          </button>
          <a
            href={job.external_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-lg bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors"
            title="View on company site"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>

      {/* Posted time */}
      {job.posted_at && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-1 text-xs text-gray-400">
          <Clock className="w-3 h-3" />
          Posted {new Date(job.posted_at).toLocaleDateString()}
        </div>
      )}
    </div>
  )
}
