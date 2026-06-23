'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Linkedin, Loader2, Check, AlertCircle, Briefcase, GraduationCap, MapPin } from 'lucide-react'
import type { WorkHistoryEntry, EducationEntry } from '@scout/shared/types/database'

interface ParsedLinkedInData {
  company: string
  role: string
  location: string
  work_history: WorkHistoryEntry[]
  education: EducationEntry[]
}

type ImportState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'preview'; data: ParsedLinkedInData }
  | { status: 'error'; message: string }
  | { status: 'applying' }
  | { status: 'applied' }

export default function LinkedInImport() {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [state, setState] = useState<ImportState>({ status: 'idle' })

  const handleImport = async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setState({ status: 'loading' })

    try {
      const res = await fetch('/api/profile/linkedin-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ linkedin_url: trimmed }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState({ status: 'error', message: data.error || 'Import failed' })
        return
      }

      setState({ status: 'preview', data: data.parsed })
    } catch (err) {
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  const handleApply = async () => {
    if (state.status !== 'preview') return
    setState({ status: 'applying' })

    try {
      const res = await fetch('/api/profile/linkedin-import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          linkedin_url: url.trim(),
          ...state.data,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState({ status: 'error', message: data.error || 'Failed to save' })
        return
      }

      setState({ status: 'applied' })
      router.refresh()
    } catch (err) {
      setState({ status: 'error', message: 'Network error. Please try again.' })
    }
  }

  const handleReset = () => {
    setState({ status: 'idle' })
    setUrl('')
  }

  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 md:p-8 mb-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[--text-quaternary] mb-4 flex items-center gap-2">
        <Linkedin size={14} />
        Import from LinkedIn
      </h2>

      {(state.status === 'idle' || state.status === 'error') && (
        <div className="space-y-4">
          <p className="text-sm text-[--text-tertiary]">
            Paste your LinkedIn profile URL to automatically import your work history, education, and contact details.
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleImport() }}
              placeholder="https://linkedin.com/in/yourprofile"
              className="input-field flex-1"
              disabled={state.status === 'loading'}
            />
            <button
              onClick={handleImport}
              disabled={state.status === 'loading' || !url.trim()}
              className="btn-primary flex items-center gap-2 px-4 whitespace-nowrap"
            >
              {state.status === 'loading' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Linkedin size={15} />
                  Import
                </>
              )}
            </button>
          </div>
          {state.status === 'error' && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-sm text-red-400">
              <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{state.message}</span>
            </div>
          )}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="flex flex-col items-center py-8">
          <Loader2 size={24} className="animate-spin text-[--school-primary] mb-3" />
          <p className="text-sm text-[--text-tertiary]">Parsing LinkedIn profile...</p>
          <p className="text-xs text-[--text-quaternary] mt-1">This should only take a moment.</p>
        </div>
      )}

      {state.status === 'preview' && (
        <div className="space-y-4">
          <div className="bg-[--school-primary]/10 border border-[--school-primary]/20 rounded-lg p-3 text-sm text-[--text-secondary]">
            We found the following information. Review and click "Apply to Profile" to save it.
          </div>

          {/* Current position */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[--text-quaternary]">
              Current Position
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-[--bg-tertiary] rounded-lg p-3">
                <p className="text-xs text-[--text-quaternary] mb-1">Company</p>
                <p className="text-sm font-medium text-[--text-primary] flex items-center gap-1.5">
                  <Briefcase size={13} className="text-[--text-quaternary]" />
                  {state.data.company}
                </p>
              </div>
              <div className="bg-[--bg-tertiary] rounded-lg p-3">
                <p className="text-xs text-[--text-quaternary] mb-1">Role</p>
                <p className="text-sm font-medium text-[--text-primary]">{state.data.role}</p>
              </div>
              <div className="bg-[--bg-tertiary] rounded-lg p-3">
                <p className="text-xs text-[--text-quaternary] mb-1">Location</p>
                <p className="text-sm font-medium text-[--text-primary] flex items-center gap-1.5">
                  <MapPin size={13} className="text-[--text-quaternary]" />
                  {state.data.location}
                </p>
              </div>
            </div>
          </div>

          {/* Work History */}
          {state.data.work_history && state.data.work_history.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[--text-quaternary]">
                Work History ({state.data.work_history.length})
              </h3>
              <div className="space-y-2">
                {state.data.work_history.map((entry, i) => (
                  <div key={i} className="bg-[--bg-tertiary] rounded-lg p-3">
                    <p className="text-sm font-medium text-[--text-primary]">
                      {entry.title || 'Role'}
                      {entry.company ? <span className="text-[--text-tertiary]"> · {entry.company}</span> : null}
                    </p>
                    {(entry.start || entry.end) && (
                      <p className="text-xs text-[--text-quaternary] mt-0.5">
                        {entry.start?.year ?? ''}
                        {entry.end ? ` – ${entry.end.year ?? 'Present'}` : ' – Present'}
                        {entry.duration ? ` · ${entry.duration}` : ''}
                      </p>
                    )}
                    {entry.location && (
                      <p className="text-xs text-[--text-quaternary] mt-0.5">{entry.location}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {state.data.education && state.data.education.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[--text-quaternary]">
                Education ({state.data.education.length})
              </h3>
              <div className="space-y-2">
                {state.data.education.map((entry, i) => (
                  <div key={i} className="bg-[--bg-tertiary] rounded-lg p-3">
                    <p className="text-sm font-medium text-[--text-primary] flex items-center gap-1.5">
                      <GraduationCap size={13} className="text-[--text-quaternary]" />
                      {entry.school}
                    </p>
                    {(entry.degree || entry.field) && (
                      <p className="text-xs text-[--text-tertiary] mt-0.5">
                        {entry.degree}{entry.degree && entry.field ? ' in ' : ''}{entry.field}
                      </p>
                    )}
                    {(entry.start || entry.end) && (
                      <p className="text-xs text-[--text-quaternary] mt-0.5">
                        {entry.start ?? ''}{entry.end ? ` – ${entry.end}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleApply}
              disabled={state.status === 'applying'}
              className="btn-primary flex items-center justify-center gap-2 px-5"
            >
              {state.status === 'applying' ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check size={15} />
                  Apply to Profile
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={state.status === 'applying'}
              className="btn-secondary px-4"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.status === 'applied' && (
        <div className="flex flex-col items-center py-6">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
            <Check size={22} className="text-green-400" />
          </div>
          <p className="text-sm font-medium text-[--text-primary]">Profile updated!</p>
          <p className="text-xs text-[--text-tertiary] mt-1">
            Your LinkedIn data has been applied to your profile.
          </p>
        </div>
      )}
    </div>
  )
}
