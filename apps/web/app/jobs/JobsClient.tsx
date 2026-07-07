'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Briefcase, MapPin, ChevronDown, X, ExternalLink, CheckCircle, Clock, Filter } from 'lucide-react'
import type { EmploymentType } from '@scout/shared/types/database'

// Types
interface JobListingItem {
  id: string
  title: string
  company: string
  location: string | null
  description: string | null
  employment_type: EmploymentType | null
  salary_range: string | null
  application_url: string | null
  posted_by: string
  sport_tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

interface MyListingItem {
  id: string
  title: string
  is_active: boolean
  created_at: string
  applicant_count: number
}

interface JobsClientProps {
  initialJobs: JobListingItem[]
  totalJobs: number
  appliedJobIds: string[]
  userSport: string | null
  userId: string
  isAlumni: boolean
  myListings: MyListingItem[]
}

// Constants
const EMPLOYMENT_TYPES: { value: EmploymentType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'full-time', label: 'Full-Time' },
  { value: 'part-time', label: 'Part-Time' },
  { value: 'contract', label: 'Contract' },
  { value: 'internship', label: 'Internship' },
  { value: 'temporary', label: 'Temporary' },
]

const SPORTS = [
  'Basketball', 'Soccer', 'Football', 'Lacrosse', 'Tennis', 'Swimming',
  'Baseball', 'Volleyball', 'Hockey', 'Track & Field', 'Rowing', 'Wrestling',
  'Golf', 'Field Hockey', 'Cross Country', 'Fencing', 'Gymnastics',
]

// Utils
function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

// =========== Post Job Modal ===========

function PostJobModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ title: '', company: '', location: '', description: '', employment_type: '', salary_range: '', application_url: '', sport_tags: [] as string[] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, employment_type: form.employment_type || undefined }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to create job listing'); return }
      onCreated()
      onClose()
    } catch { setError('Network error') }
    finally { setSubmitting(false) }
  }

  const toggleSportTag = (sport: string) => {
    setForm(prev => ({
      ...prev,
      sport_tags: prev.sport_tags.includes(sport) ? prev.sport_tags.filter(s => s !== sport) : [...prev.sport_tags, sport],
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[--border-primary]">
          <h2 className="text-lg font-semibold text-[--text-primary]">Post a Job</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[--bg-tertiary]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Title *</label>
            <input type="text" required className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
              value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Software Engineer Intern" />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Company *</label>
            <input type="text" required className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
              value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-[--text-secondary]">Location</label>
              <input type="text" className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
                value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. New York, NY" />
            </div>
            <div>
              <label className="text-sm font-medium text-[--text-secondary]">Employment Type</label>
              <select className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary] bg-white"
                value={form.employment_type} onChange={e => setForm(p => ({ ...p, employment_type: e.target.value }))}>
                <option value="">Select type</option>
                {EMPLOYMENT_TYPES.filter(t => t.value).map(t => (<option key={t.value} value={t.value}>{t.label}</option>))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Salary Range</label>
            <input type="text" className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
              value={form.salary_range} onChange={e => setForm(p => ({ ...p, salary_range: e.target.value }))} placeholder="e.g. $80k-$120k" />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Application URL</label>
            <input type="url" className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
              value={form.application_url} onChange={e => setForm(p => ({ ...p, application_url: e.target.value }))} placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Description</label>
            <textarea rows={4} className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary] resize-y"
              value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe the role, responsibilities, qualifications..." />
          </div>
          <div>
            <label className="text-sm font-medium text-[--text-secondary] mb-1 block">Sport Tags</label>
            <div className="flex flex-wrap gap-1.5">
              {SPORTS.map(sport => (
                <button key={sport} type="button" onClick={() => toggleSportTag(sport)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${form.sport_tags.includes(sport) ? 'bg-[--school-primary] text-white border-[--school-primary]' : 'border-[--border-primary] text-[--text-tertiary] hover:border-[--text-quaternary]'}`}>
                  {sport}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm px-4 py-2">{submitting ? 'Posting...' : 'Post Job'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =========== Apply Modal ===========

function ApplyModal({ job, onClose, onApplied }: { job: JobListingItem; onClose: () => void; onApplied: () => void }) {
  const [coverNote, setCoverNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/jobs/${job.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cover_note: coverNote || null }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to apply'); return }
      onApplied()
      onClose()
    } catch { setError('Network error') }
    finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[--border-primary]">
          <div>
            <h2 className="text-lg font-semibold text-[--text-primary]">Apply</h2>
            <p className="text-sm text-[--text-tertiary]">{job.title} at {job.company}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[--bg-tertiary]"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && <div className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</div>}
          <div>
            <label className="text-sm font-medium text-[--text-secondary]">Cover Note (optional)</label>
            <textarea rows={4} className="w-full mt-1 px-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary] resize-y"
              value={coverNote} onChange={e => setCoverNote(e.target.value)} placeholder="Tell the alumni why you're interested..." />
          </div>
          {job.application_url && (
            <p className="text-xs text-[--text-quaternary]">Also apply at <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="text-[--school-primary] underline">{job.application_url}</a></p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost text-sm px-4 py-2">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary text-sm px-4 py-2">{submitting ? 'Submitting...' : 'Submit Application'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// =========== Job Card ===========

function JobCard({ job, hasApplied, onApply, userId }: { job: JobListingItem; hasApplied: boolean; onApply: () => void; userId: string }) {
  const isOwner = job.posted_by === userId
  return (
    <div className="bg-white border border-[--border-primary] rounded-xl p-4 hover:shadow-sm transition-shadow flex flex-col gap-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[--text-primary] truncate">{job.title}</h3>
          <p className="text-xs text-[--text-secondary]">{job.company}</p>
        </div>
        {isOwner && <span className="text-[10px] font-medium text-[--text-quaternary] bg-[--bg-tertiary] px-1.5 py-0.5 rounded">Yours</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-[--text-tertiary]">
        {job.location && <span className="flex items-center gap-1"><MapPin size={12} />{job.location}</span>}
        {job.employment_type && <span className="flex items-center gap-1 capitalize"><Briefcase size={12} />{job.employment_type}</span>}
        {job.salary_range && <span>{job.salary_range}</span>}
        <span className="text-[--text-quaternary]">· {getTimeAgo(job.created_at)}</span>
      </div>
      {job.sport_tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {job.sport_tags.map(tag => <span key={tag} className="text-[11px] bg-[--bg-secondary] text-[--text-tertiary] px-1.5 py-0.5 rounded">{tag}</span>)}
        </div>
      )}
      {job.description && <p className="text-xs text-[--text-tertiary] leading-relaxed line-clamp-2">{job.description}</p>}
      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-[--border-primary]">
        {hasApplied
          ? <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle size={14} />Applied</span>
          : <button onClick={onApply} className="btn-primary text-xs px-3 py-1.5">Apply</button>
        }
        {job.application_url && (
          <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1"><ExternalLink size={12} />External</a>
        )}
      </div>
    </div>
  )
}

// =========== Alumni Manage Panel ===========

function AlumniManagePanel({ listings }: { listings: MyListingItem[] }) {
  return (
    <div className="bg-white border border-[--border-primary] rounded-xl p-4">
      <h3 className="text-sm font-semibold text-[--text-primary] mb-3">My Listings</h3>
      {listings.length === 0 ? (
        <p className="text-xs text-[--text-quaternary]">You haven't posted any jobs yet.</p>
      ) : (
        <div className="space-y-2">
          {listings.map(listing => (
            <div key={listing.id} className="flex items-center justify-between text-sm py-1.5 border-b border-[--border-primary] last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[--text-primary] truncate">{listing.title}</p>
                <div className="flex items-center gap-2 text-[11px] text-[--text-quaternary]">
                  <span>{getTimeAgo(listing.created_at)}</span>
                  {!listing.is_active && <span className="text-red-400">(inactive)</span>}
                </div>
              </div>
              <span className="text-xs text-[--text-tertiary] flex items-center gap-1 shrink-0 ml-2">
                <Clock size={12} />{listing.applicant_count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// =========== Main Component ===========

export default function JobsClient({ initialJobs, totalJobs, appliedJobIds, userSport, userId, isAlumni, myListings: initialMyListings }: JobsClientProps) {
  const [jobs, setJobs] = useState<JobListingItem[]>(initialJobs)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ sport: '', employmentType: '', location: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [showPostModal, setShowPostModal] = useState(false)
  const [applyJob, setApplyJob] = useState<JobListingItem | null>(null)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set(appliedJobIds))
  const [myListings, setMyListings] = useState<MyListingItem[]>(initialMyListings)

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.sport) params.set('sport', filters.sport)
      if (filters.employmentType) params.set('employment_type', filters.employmentType)
      if (filters.location) params.set('location', filters.location)
      if (search) params.set('search', search)
      const res = await fetch(`/api/jobs?${params.toString()}`)
      const json = await res.json()
      if (json.data?.items) setJobs(json.data.items)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search, filters])

  const refreshMyListings = useCallback(async () => {
    if (!isAlumni) return
    try {
      const res = await fetch('/api/jobs?limit=200&active=false')
      const json = await res.json()
      if (json.data?.items) {
        const myOwn = json.data.items.filter((j: JobListingItem) => j.posted_by === userId)
        const myOwnWithCounts: MyListingItem[] = await Promise.all(
          myOwn.map(async (j: JobListingItem) => {
            const r = await fetch(`/api/jobs/${j.id}/applications`)
            const jj = await r.json()
            return { id: j.id, title: j.title, is_active: j.is_active, created_at: j.created_at, applicant_count: jj.data?.length || 0 }
          })
        )
        setMyListings(myOwnWithCounts)
      }
    } catch { /* ignore */ }
  }, [isAlumni, userId])

  useEffect(() => { const t = setTimeout(fetchJobs, 300); return () => clearTimeout(t) }, [fetchJobs])

  const toggleFilter = (key: 'sport' | 'employmentType', value: string) => {
    setFilters(prev => ({ ...prev, [key]: prev[key] === value ? '' : value }))
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[--text-primary]">Jobs Board</h1>
          <p className="text-sm text-[--text-tertiary]">Browse opportunities posted by Cornell athlete alumni</p>
        </div>
        {isAlumni && <button onClick={() => setShowPostModal(true)} className="btn-primary text-sm px-4 py-2">+ Post a Job</button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <button onClick={() => setShowFilters(!showFilters)} className="lg:hidden flex items-center gap-2 text-sm text-[--text-secondary] mb-3">
            <Filter size={14} /> Filters <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
          <div className={`space-y-5 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            {isAlumni && <AlumniManagePanel listings={myListings} />}

            <div className="bg-white border border-[--border-primary] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[--text-primary] mb-2">Sport</h3>
              <div className="flex flex-wrap gap-1.5">
                {SPORTS.map(sport => (
                  <button key={sport} onClick={() => toggleFilter('sport', sport)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.sport === sport ? 'bg-[--school-primary] text-white border-[--school-primary]' : 'border-[--border-primary] text-[--text-tertiary] hover:border-[--text-quaternary]'}`}>
                    {sport}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white border border-[--border-primary] rounded-xl p-4">
              <h3 className="text-sm font-semibold text-[--text-primary] mb-2">Type</h3>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYMENT_TYPES.map(t => (
                  <button key={t.value} onClick={() => toggleFilter('employmentType', t.value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filters.employmentType === t.value ? 'bg-[--school-primary] text-white border-[--school-primary]' : 'border-[--border-primary] text-[--text-tertiary] hover:border-[--text-quaternary]'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[--text-quaternary]" />
              <input type="text" placeholder="Search jobs by title, company, or keyword..."
                className="w-full pl-9 pr-3 py-2 border border-[--border-primary] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[--school-primary]/20 focus:border-[--school-primary]"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <span className="text-xs text-[--text-quaternary] whitespace-nowrap">{loading ? '...' : `${jobs.length} job${jobs.length !== 1 ? 's' : ''}`}</span>
          </div>

          {(filters.sport || filters.employmentType || filters.location) && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-xs text-[--text-tertiary]">Filters:</span>
              {filters.sport && <FilterChip label={filters.sport} onClear={() => setFilters(p => ({ ...p, sport: '' }))} />}
              {filters.employmentType && <FilterChip label={EMPLOYMENT_TYPES.find(t => t.value === filters.employmentType)?.label || filters.employmentType} onClear={() => setFilters(p => ({ ...p, employmentType: '' }))} />}
              <button onClick={() => setFilters({ sport: '', employmentType: '', location: '' })} className="text-xs text-[--school-primary] hover:underline">Clear all</button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <div key={i} className="bg-white border border-[--border-primary] rounded-xl p-4 animate-pulse h-32" />)}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase size={32} className="mx-auto mb-3 text-[--text-quaternary]" />
              <p className="text-sm text-[--text-tertiary]">No jobs found matching your criteria.</p>
              <p className="text-xs text-[--text-quaternary] mt-1">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {jobs.map(job => <JobCard key={job.id} job={job} hasApplied={appliedIds.has(job.id)} onApply={() => setApplyJob(job)} userId={userId} />)}
            </div>
          )}
        </div>
      </div>

      {showPostModal && <PostJobModal onClose={() => setShowPostModal(false)} onCreated={() => { fetchJobs(); refreshMyListings() }} />}
      {applyJob && <ApplyModal job={applyJob} onClose={() => setApplyJob(null)} onApplied={() => { setAppliedIds(prev => new Set(prev).add(applyJob.id)); refreshMyListings() }} />}
    </div>
  )
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1 text-xs bg-[--bg-tertiary] px-2 py-0.5 rounded-full">
      {label}
      <button onClick={onClear}><X size={10} /></button>
    </span>
  )
}
