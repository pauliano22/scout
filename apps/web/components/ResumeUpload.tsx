'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import { Upload, FileText, Check, X, Loader, RefreshCw, Eye } from 'lucide-react'

interface ParsedResume {
  full_name?: string | null
  major?: string | null
  graduation_year?: number | null
  gpa?: string | null
  target_roles?: string[]
  skills?: string[]
  past_experience?: string | null
  primary_industry?: string | null
  location?: string | null
}

interface PreviousProfile {
  major: string | null
  past_experience: string | null
  primary_industry: string | null
  graduation_year: number | null
  target_roles: string[] | null
}

interface ResumeUploadProps {
  userId: string
  onParsed?: (data: ParsedResume) => void
  compact?: boolean  // true = inline card style, false = full step style
  // Storage path of a resume already on file (profiles.resume_url, e.g.
  // "{userId}/resume.pdf"). When set, we surface it with a View link on load
  // instead of showing an empty dropzone.
  existingResumePath?: string | null
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'applying' | 'error'

type DiffField = 'major' | 'past_experience' | 'primary_industry' | 'graduation_year' | 'target_roles'

interface FieldDiff {
  field: DiffField
  label: string
  oldValue: string
  newValue: string
}

const FIELD_LABELS: Record<DiffField, string> = {
  major: 'Major',
  past_experience: 'Past experience',
  primary_industry: 'Primary industry',
  graduation_year: 'Graduation year',
  target_roles: 'Target roles',
}

const isBlank = (v: unknown) =>
  v === null || v === undefined || v === '' ||
  (Array.isArray(v) && v.length === 0)

const formatValue = (v: unknown): string => {
  if (isBlank(v)) return ''
  if (Array.isArray(v)) return v.join(', ')
  return String(v)
}

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + '…' : s

function computeDiffs(parsed: ParsedResume, previous: PreviousProfile): FieldDiff[] {
  const fields: DiffField[] = [
    'major',
    'primary_industry',
    'graduation_year',
    'target_roles',
    'past_experience',
  ]
  const diffs: FieldDiff[] = []

  for (const field of fields) {
    const oldVal = (previous as unknown as Record<string, unknown>)[field]
    const newVal = (parsed as unknown as Record<string, unknown>)[field]

    // Only diff when there WAS an old value AND there's a new value AND they differ.
    // (If the old value was blank, the parse route already filled it — nothing to confirm.)
    if (isBlank(oldVal) || isBlank(newVal)) continue

    const oldStr = formatValue(oldVal)
    const newStr = formatValue(newVal)
    if (oldStr === newStr) continue

    diffs.push({
      field,
      label: FIELD_LABELS[field],
      oldValue: truncate(oldStr, 80),
      newValue: truncate(newStr, 80),
    })
  }

  return diffs
}

export default function ResumeUpload({ userId, onParsed, compact = false, existingResumePath }: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [diffs, setDiffs] = useState<FieldDiff[]>([])
  const [appliedFields, setAppliedFields] = useState<DiffField[] | null>(null)
  const [replacing, setReplacing] = useState(false)
  const [existingUrl, setExistingUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  const existingFileName = existingResumePath?.split('/').pop() || 'resume.pdf'

  // Resolve a short-lived signed URL for a resume already on file. The bucket is
  // private; RLS lets the owner read their own {userId}/… path.
  useEffect(() => {
    if (!existingResumePath) return
    let cancelled = false
    supabase.storage
      .from('resumes')
      .createSignedUrl(existingResumePath, 60 * 60)
      .then(({ data }) => {
        if (!cancelled) setExistingUrl(data?.signedUrl ?? null)
      })
    return () => {
      cancelled = true
    }
  }, [existingResumePath, supabase])

  async function handleFile(file: File) {
    if (file.type !== 'application/pdf') {
      setErrorMsg('Please upload a PDF file.')
      setState('error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File must be under 5MB.')
      setState('error')
      return
    }

    setFileName(file.name)
    setErrorMsg('')
    setState('uploading')

    // Upload to Supabase Storage: resumes/{userId}/resume.pdf
    const storagePath = `${userId}/resume.pdf`
    const { error: uploadError } = await supabase.storage
      .from('resumes')
      .upload(storagePath, file, { upsert: true, contentType: 'application/pdf' })

    if (uploadError) {
      setErrorMsg('Upload failed. Please try again.')
      setState('error')
      return
    }

    setState('parsing')

    // Call the parse API
    const res = await fetch('/api/resume/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storagePath }),
    })

    if (!res.ok) {
      setErrorMsg('Could not read resume. Try again or skip.')
      setState('error')
      return
    }

    const { parsed: data, previous_profile } = await res.json()
    setParsed(data)
    setAppliedFields(null)

    // If the user already had values on file that differ from what the new
    // resume says, surface a diff panel so they can opt into refreshing.
    const newDiffs: FieldDiff[] = previous_profile
      ? computeDiffs(data, previous_profile as PreviousProfile)
      : []
    setDiffs(newDiffs)

    setState('done')
    trackEvent('resume_uploaded', {
      has_major: !!data.major,
      has_industry: !!data.primary_industry,
      has_roles: (data.target_roles?.length ?? 0) > 0,
      has_diffs: newDiffs.length > 0,
    })
    onParsed?.(data)
  }

  async function applyDiffs() {
    if (diffs.length === 0) return
    setState('applying')
    try {
      const res = await fetch('/api/resume/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: diffs.map((d) => d.field) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to apply')
      setAppliedFields(diffs.map((d) => d.field))
      setDiffs([])
      trackEvent('resume_applied', { fields: data.applied })
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply updates')
    } finally {
      setState('done')
    }
  }

  function dismissDiffs() {
    setDiffs([])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function reset() {
    setState('idle')
    setParsed(null)
    setFileName('')
    setErrorMsg('')
    setDiffs([])
    setAppliedFields(null)
    setReplacing(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // A resume is already on file and the user hasn't chosen to replace it yet:
  // show it with a View link instead of a blank dropzone. (Skipped once a fresh
  // upload is in flight or done — those states render their own UI below.)
  if ((state === 'idle' || state === 'error') && existingResumePath && !replacing) {
    return (
      <div className={`rounded-xl border border-[--border-primary] bg-[--bg-tertiary] ${compact ? 'p-4' : 'p-5'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[--school-primary]/10 flex items-center justify-center shrink-0">
            <FileText size={17} className="text-[--school-primary]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm text-[--text-primary]">Résumé on file</div>
            <div className="text-xs text-[--text-tertiary] truncate">{existingFileName}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {existingUrl && (
              <a
                href={existingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                <Eye size={13} />
                View
              </a>
            )}
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="btn-ghost text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              Replace
            </button>
          </div>
        </div>
        {errorMsg && <p className="text-xs text-red-500 mt-2">{errorMsg}</p>}
      </div>
    )
  }

  if ((state === 'done' || state === 'applying') && parsed) {
    return (
      <div className={`rounded-xl border-2 border-green-500/40 bg-green-500/5 ${compact ? 'p-4' : 'p-6'}`}>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <Check size={16} className="text-green-500" />
          </div>
          <div>
            <div className="font-medium text-sm text-[--text-primary]">Resume uploaded</div>
            <div className="text-xs text-[--text-tertiary]">{fileName}</div>
          </div>
          <button onClick={reset} className="ml-auto text-[--text-quaternary] hover:text-[--text-tertiary]">
            <X size={16} />
          </button>
        </div>

        {/* Summary of what was extracted */}
        <div className="space-y-1.5 text-xs text-[--text-secondary]">
          {parsed.major && (
            <div><span className="text-[--text-tertiary]">Major:</span> {parsed.major}</div>
          )}
          {parsed.primary_industry && (
            <div><span className="text-[--text-tertiary]">Industry:</span> {parsed.primary_industry}</div>
          )}
          {parsed.target_roles && parsed.target_roles.length > 0 && (
            <div><span className="text-[--text-tertiary]">Target roles:</span> {parsed.target_roles.join(', ')}</div>
          )}
          {parsed.skills && parsed.skills.length > 0 && (
            <div><span className="text-[--text-tertiary]">Skills:</span> {parsed.skills.slice(0, 5).join(', ')}{parsed.skills.length > 5 ? '...' : ''}</div>
          )}
          {parsed.past_experience && (
            <div className="mt-2 text-[--text-tertiary] italic">{parsed.past_experience}</div>
          )}
        </div>

        {/* Diff panel: only shows when re-uploading and the new resume changes
            fields the user already had set. Lets them opt into overwriting. */}
        {diffs.length > 0 && (
          <div className="mt-4 rounded-lg border border-[--school-primary]/40 bg-[--school-primary]/5 p-3">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={13} className="text-[--school-primary]" />
              <p className="text-xs font-semibold text-[--text-primary]">
                Refresh profile from this resume?
              </p>
            </div>
            <p className="text-xs text-[--text-tertiary] mb-3">
              Your profile already has values for these fields. Apply the new ones?
            </p>
            <div className="space-y-2 mb-3">
              {diffs.map((d) => (
                <div key={d.field} className="text-xs leading-relaxed">
                  <div className="text-[--text-quaternary] font-medium mb-0.5">{d.label}</div>
                  <div className="text-[--text-tertiary] line-through decoration-[--text-quaternary]/50">
                    {d.oldValue}
                  </div>
                  <div className="text-[--text-primary]">{d.newValue}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={applyDiffs}
                disabled={state === 'applying'}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-50"
              >
                {state === 'applying' ? (
                  <Loader size={12} className="animate-spin" />
                ) : (
                  <RefreshCw size={12} />
                )}
                Apply to profile
              </button>
              <button
                onClick={dismissDiffs}
                disabled={state === 'applying'}
                className="btn-ghost text-xs px-3 py-1.5"
              >
                Keep current
              </button>
            </div>
          </div>
        )}

        {appliedFields && appliedFields.length > 0 && diffs.length === 0 && (
          <p className="text-xs text-green-600 mt-3">
            Profile refreshed with new values for {appliedFields.map((f) => FIELD_LABELS[f]).join(', ')}.
          </p>
        )}
        {!appliedFields && diffs.length === 0 && (
          <p className="text-xs text-green-600 mt-3">Profile updated with your resume info.</p>
        )}
        {errorMsg && (
          <p className="text-xs text-red-500 mt-2">{errorMsg}</p>
        )}
      </div>
    )
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Drop zone */}
      <div
        onClick={() => state === 'idle' || state === 'error' ? fileInputRef.current?.click() : undefined}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`
          border-2 border-dashed rounded-xl text-center transition-colors
          ${compact ? 'p-5' : 'p-8'}
          ${state === 'idle' || state === 'error'
            ? 'border-[--border-secondary] hover:border-[--school-primary] cursor-pointer hover:bg-[--school-primary]/5'
            : 'border-[--border-primary] cursor-default'
          }
          ${state === 'error' ? 'border-red-500/40 bg-red-500/5' : ''}
        `}
      >
        {state === 'idle' && (
          <>
            <div className="w-12 h-12 rounded-full bg-[--bg-tertiary] flex items-center justify-center mx-auto mb-3">
              <Upload size={20} className="text-[--text-tertiary]" />
            </div>
            <p className="font-medium text-[--text-primary] text-sm mb-1">
              Drop your resume here or <span className="text-[--school-primary]">browse</span>
            </p>
            <p className="text-xs text-[--text-tertiary]">PDF only · Max 5MB</p>
          </>
        )}

        {state === 'uploading' && (
          <>
            <Loader size={24} className="animate-spin text-[--school-primary] mx-auto mb-3" />
            <p className="text-sm text-[--text-secondary]">Uploading {fileName}...</p>
          </>
        )}

        {state === 'parsing' && (
          <>
            <Loader size={24} className="animate-spin text-[--school-primary] mx-auto mb-3" />
            <p className="text-sm font-medium text-[--text-primary] mb-1">Reading your resume...</p>
            <p className="text-xs text-[--text-tertiary]">Claude is extracting your info</p>
          </>
        )}

        {state === 'error' && (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-red-400" />
            </div>
            <p className="text-sm font-medium text-red-400 mb-1">{errorMsg}</p>
            <p className="text-xs text-[--text-tertiary]">Click to try again</p>
          </>
        )}
      </div>
    </div>
  )
}
