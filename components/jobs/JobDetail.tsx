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
    // Open external URL
    window.open(job.external_url, '_blank')
    // Mark as applied
    if (onApply && !isApplied) {
      onApply(job.id)
    }
  }

  const getJobTypeLabel = (type: string | null) => {
    switch (type) {
      case 'remote':
        return { label: 'Remote', color: 'bg-green-100 text-green-800' }
      case 'hybrid':
        return { label: 'Hybrid', color: 'bg-blue-100 text-blue-800' }
      case 'onsite':
        return { label: 'On-site', color: 'bg-gray-100 text-gray-800' }
      default:
        return null
    }
  }

  const getSeniorityLabel = (level: string | null) => {
    switch (level) {
      case 'entry':
        return { label: 'Entry Level', color: 'bg-purple-100 text-purple-800' }
      case 'mid':
        return { label: 'Mid Level', color: 'bg-indigo-100 text-indigo-800' }
      case 'senior':
        return { label: 'Senior', color: 'bg-orange-100 text-orange-800' }
      case 'executive':
        return { label: 'Executive', color: 'bg-red-100 text-red-800' }
      default:
        return null
    }
  }

  const jobType = getJobTypeLabel(job.job_type)
  const seniority = getSeniorityLabel(job.seniority_level)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-8 h-8 text-gray-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900 mb-1">{job.title}</h2>
              <p className="text-lg text-gray-600">{job.company}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mt-3">
                {jobType && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${jobType.color}`}>
                    {jobType.label}
                  </span>
                )}
                {seniority && (
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${seniority.color}`}>
                    {seniority.label}
                  </span>
                )}
                {job.similarity && (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-primary-100 text-primary-800">
                    {Math.round(job.similarity * 100)}% Match
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {job.location && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-5 h-5 text-gray-400" />
                <span>{job.location}</span>
              </div>
            )}
            {job.industry && (
              <div className="flex items-center gap-2 text-gray-600">
                <Briefcase className="w-5 h-5 text-gray-400" />
                <span>{job.industry}</span>
              </div>
            )}
            {job.salary_range && (
              <div className="flex items-center gap-2 text-gray-600">
                <DollarSign className="w-5 h-5 text-gray-400" />
                <span>{job.salary_range}</span>
              </div>
            )}
            {job.posted_at && (
              <div className="flex items-center gap-2 text-gray-600">
                <Clock className="w-5 h-5 text-gray-400" />
                <span>Posted {new Date(job.posted_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {job.description && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">Job Description</h3>
              <div className="prose prose-sm max-w-none text-gray-600">
                {job.description.split('\n').map((paragraph, index) => (
                  <p key={index} className="mb-3">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <button
              onClick={handleSaveClick}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                isSaved
                  ? 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck className="w-5 h-5" />
                  Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-5 h-5" />
                  Save Job
                </>
              )}
            </button>
            <button
              onClick={handleApplyClick}
              className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
                isApplied
                  ? 'bg-green-600 text-white'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {isApplied ? (
                <>
                  <Check className="w-5 h-5" />
                  Applied
                </>
              ) : (
                <>
                  <ExternalLink className="w-5 h-5" />
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
