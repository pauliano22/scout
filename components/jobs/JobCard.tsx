'use client'

import { Job } from '@/types/database'
import { MapPin, Building2, Briefcase, DollarSign, Bookmark, BookmarkCheck, ExternalLink, CheckCircle2 } from 'lucide-react'

interface JobCardProps {
  job: Job
  isSaved?: boolean
  isApplied?: boolean
  onSave?: (jobId: string) => void
  onUnsave?: (jobId: string) => void
  onClick?: (job: Job) => void
  showMatchScore?: boolean
}

export default function JobCard({
  job,
  isSaved = false,
  isApplied = false,
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

  const getJobTypeStyle = (type: string | null) => {
    switch (type) {
      case 'remote':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'hybrid':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'onsite':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      default:
        return 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
    }
  }

  const getSeniorityStyle = (level: string | null) => {
    switch (level) {
      case 'internship':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
      case 'entry':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'mid':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      case 'senior':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'executive':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
    }
  }

  const getIndustryStyle = (industry: string | null) => {
    switch (industry?.toLowerCase()) {
      case 'finance':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'technology':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'consulting':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'healthcare':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'law':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'media':
        return 'bg-pink-500/10 text-pink-400 border-pink-500/20'
      default:
        return 'bg-[--bg-tertiary] text-[--text-secondary] border-[--border-primary]'
    }
  }

  return (
    <div
      className="bg-[--bg-secondary] rounded-xl border border-[--border-primary] p-4 hover:border-[--border-hover] transition-all cursor-pointer group"
      onClick={() => onClick?.(job)}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Title and Company */}
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 bg-[--bg-tertiary] rounded-lg flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-[--text-quaternary]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-[--text-primary] group-hover:text-[--school-primary] transition-colors truncate">
                  {job.title}
                </h3>
                {isApplied && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Applied
                  </span>
                )}
              </div>
              <p className="text-sm text-[--text-secondary]">{job.company}</p>
            </div>
          </div>

          {/* Details */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-[--text-tertiary] mb-3">
            {job.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {job.location}
              </span>
            )}
            {job.salary_range && (
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5" />
                {job.salary_range}
              </span>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            {job.industry && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getIndustryStyle(job.industry)}`}>
                {job.industry}
              </span>
            )}
            {job.job_type && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getJobTypeStyle(job.job_type)}`}>
                {job.job_type.charAt(0).toUpperCase() + job.job_type.slice(1)}
              </span>
            )}
            {job.seniority_level && (
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${getSeniorityStyle(job.seniority_level)}`}>
                {job.seniority_level.charAt(0).toUpperCase() + job.seniority_level.slice(1)}
              </span>
            )}
            {showMatchScore && job.similarity && (
              <span className="px-2 py-0.5 text-xs font-medium rounded border bg-[--school-primary]/10 text-[--school-primary] border-[--school-primary]/20">
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
                ? 'bg-[--school-primary]/10 text-[--school-primary]'
                : 'bg-[--bg-tertiary] text-[--text-quaternary] hover:bg-[--bg-hover] hover:text-[--text-secondary]'
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
            className="p-2 rounded-lg bg-[--bg-tertiary] text-[--text-quaternary] hover:bg-[--bg-hover] hover:text-[--text-secondary] transition-colors"
            title="View on company site"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>
      </div>
    </div>
  )
}
