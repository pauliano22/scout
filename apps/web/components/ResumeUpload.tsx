'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent } from '@/lib/track'
import { Upload, FileText, Check, X, Loader } from 'lucide-react'

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

interface ResumeUploadProps {
  userId: string
  onParsed?: (data: ParsedResume) => void
  compact?: boolean  // true = inline card style, false = full step style
}

type UploadState = 'idle' | 'uploading' | 'parsing' | 'done' | 'error'

export default function ResumeUpload({ userId, onParsed, compact = false }: ResumeUploadProps) {
  const [state, setState] = useState<UploadState>('idle')
  const [parsed, setParsed] = useState<ParsedResume | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

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

    const { parsed: data } = await res.json()
    setParsed(data)
    setState('done')
    trackEvent('resume_uploaded', {
      has_major: !!data.major,
      has_industry: !!data.primary_industry,
      has_roles: (data.target_roles?.length ?? 0) > 0,
    })
    onParsed?.(data)
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
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (state === 'done' && parsed) {
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
        <p className="text-xs text-green-600 mt-3">Profile updated with your resume info.</p>
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
