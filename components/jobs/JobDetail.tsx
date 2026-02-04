'use client'

import { Job } from '@/types/database'
import { X, MapPin, Building2, Briefcase, DollarSign, Clock, ExternalLink, Bookmark, BookmarkCheck, Check } from 'lucide-react'

interface JobDetailProps {
  job: Job
  isSaved?: boolean
  isApplied?: boolean
  onClose: () => void
  onSave?: (jobId: string) => void
  onUnsave?: (jobId: string) => void
  onApply?: (jobId: string) => void
}

export default function JobDetail({
  job,
  isSaved = false,
  isApplied = false,
  onClose,
  onSave,
  onUnsave,
  onApply,
}: JobDetailProps) {
  const handleSaveClick = () => {
    if (isSaved && onUnsave) {
      onUnsave(job.id)
    } else if (onSave) {
      onSave(job.id)
    }
  }

  const handleApplyClick = () => {
    window.open(job.external_url, '_blank')
    if (onApply && !isApplied) {
      onApply(job.id)
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
        return null
    }
  }

  const getSeniorityStyle = (level: string | null) => {
    switch (level) {
      case 'entry':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'mid':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
      case 'senior':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'executive':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      default:
        return null
    }
  }

  const jobTypeStyle = getJobTypeStyle(job.job_type)
  const seniorityStyle = getSeniorityStyle(job.seniority_level)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-[--bg-secondary] rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-[--border-primary]">
        {/* Header */}
        <div className="p-5 border-b border-[--border-primary]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[--bg-tertiary] transition-colors"
          >
            <X className="w-5 h-5 text-[--text-secondary]" />
          </button>

          <div className="flex items-start gap-4 pr-8">
            <div className="w-14 h-14 bg-[--bg-tertiary] rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7 text-[--text-quaternary]" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-[--text-primary] mb-1">{job.title}</h2>
              <p className="text-[--text-secondary]">{job.company}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {jobTypeStyle && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded border ${jobTypeStyle}`}>
                    {job.job_type?.charAt(0).toUpperCase()}{job.job_type?.slice(1)}
                  </span>
                )}
                {seniorityStyle && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded border ${seniorityStyle}`}>
                    {job.seniority_level?.charAt(0).toUpperCase()}{job.seniority_level?.slice(1)}
                  </span>
                )}
                {job.similarity && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded border bg-[--school-primary]/10 text-[--school-primary] border-[--school-primary]/20">
                    {Math.round(job.similarity * 100)}% Match
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {job.location && (
              <div className="flex items-center gap-2 text-[--text-secondary]">
                <MapPin className="w-4 h-4 text-[--text-quaternary]" />
                <span className="text-sm">{job.location}</span>
              </div>
            )}
            {job.industry && (
              <div className="flex items-center gap-2 text-[--text-secondary]">
                <Briefcase className="w-4 h-4 text-[--text-quaternary]" />
                <span className="text-sm">{job.industry}</span>
              </div>
            )}
            {job.salary_range && (
              <div className="flex items-center gap-2 text-[--text-secondary]">
                <DollarSign className="w-4 h-4 text-[--text-quaternary]" />
                <span className="text-sm">{job.salary_range}</span>
              </div>
            )}
            {job.posted_at && (
              <div className="flex items-center gap-2 text-[--text-secondary]">
                <Clock className="w-4 h-4 text-[--text-quaternary]" />
                <span className="text-sm">Posted {new Date(job.posted_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="font-semibold text-[--text-primary] mb-3">Job Description</h3>
              <div className="text-sm text-[--text-secondary] leading-relaxed space-y-3">
                {job.description.split('\n').map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-[--border-primary] bg-[--bg-tertiary]">
          <div className="flex gap-3">
            <button
              onClick={handleSaveClick}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors border ${
                isSaved
                  ? 'bg-[--school-primary]/10 text-[--school-primary] border-[--school-primary]/20'
                  : 'bg-[--bg-secondary] text-[--text-secondary] border-[--border-primary] hover:border-[--border-hover]'
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4" />
                  Save Job
                </>
              )}
            </button>
            <button
              onClick={handleApplyClick}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                isApplied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[--school-primary] text-white hover:opacity-90'
              }`}
            >
              {isApplied ? (
                <>
                  <Check className="w-4 h-4" />
                  Applied
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Apply Now
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
