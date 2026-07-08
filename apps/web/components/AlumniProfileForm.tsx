'use client'

import { useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import type { AlumniEngagementIntent } from '@scout/shared/types/database'

export interface AlumniProfileFormValues {
  current_role: string
  current_company: string
  linkedin_url: string
  city: string
  sport: string
  graduation_year: string
  major: string
  past_experiences: string
  advice: string
  profile_photo_url: string
  share_email_with_students: boolean
  engagement_intent: AlumniEngagementIntent | ''
}

const ENGAGEMENT_INTENT_OPTIONS: { value: AlumniEngagementIntent; label: string; hint: string }[] = [
  { value: 'here_to_help', label: 'Here to help', hint: 'Advice, intros, mentorship' },
  { value: 'seeking_employment', label: 'Seeking opportunities', hint: 'Open to new roles myself' },
  { value: 'both', label: 'Both', hint: 'Happy to help, also looking' },
]

export const SPORTS_LIST = [
  'Baseball', 'Equestrian', 'Fencing', 'Field Hockey', 'Football',
  "Men's Basketball", "Men's Cross Country", "Men's Golf", "Men's Ice Hockey",
  "Men's Lacrosse", "Men's Rowing", "Men's Soccer", "Men's Squash",
  "Men's Swimming And Diving", "Men's Tennis", "Men's Track And Field",
  'Rowing', 'Softball', 'Sprint Football',
  "Women's Basketball", "Women's Cross Country", "Women's Gymnastics",
  "Women's Ice Hockey", "Women's Lacrosse", "Women's Rowing", "Women's Sailing",
  "Women's Soccer", "Women's Squash", "Women's Swimming And Diving",
  "Women's Tennis", "Women's Track And Field", "Women's Volleyball", 'Wrestling',
]

interface AlumniProfileFormProps {
  values: AlumniProfileFormValues
  onChange: (next: AlumniProfileFormValues) => void
  showReviewBanner?: boolean
}

export function emptyAlumniProfileValues(): AlumniProfileFormValues {
  return {
    current_role: '',
    current_company: '',
    linkedin_url: '',
    city: '',
    sport: '',
    graduation_year: '',
    major: '',
    past_experiences: '',
    advice: '',
    profile_photo_url: '',
    share_email_with_students: true,
    engagement_intent: '',
  }
}

export default function AlumniProfileForm({
  values,
  onChange,
  showReviewBanner = false,
}: AlumniProfileFormProps) {
  const currentYear = new Date().getFullYear()
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const set = <K extends keyof AlumniProfileFormValues>(key: K, val: AlumniProfileFormValues[K]) => {
    onChange({ ...values, [key]: val })
  }

  const handlePhoto = async (file: File | null) => {
    if (!file) return
    setPhotoError('')
    setPhotoUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/alumni/photo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      set('profile_photo_url', data.url)
    } catch (err: any) {
      setPhotoError(err.message || 'Upload failed')
    } finally {
      setPhotoUploading(false)
    }
  }

  return (
    <div className="space-y-5">
      {showReviewBanner && (
        <div className="bg-[--school-primary]/10 border border-[--school-primary]/30 rounded-lg p-3 text-sm text-[--text-secondary]">
          You can update or remove any information before students see it.
        </div>
      )}

      {/* Photo */}
      <div>
        <label className="block text-sm text-[--text-tertiary] mb-2">Profile photo</label>
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-[--bg-tertiary] border border-[--border-primary] overflow-hidden flex items-center justify-center flex-shrink-0">
            {values.profile_photo_url ? (
              <img
                src={values.profile_photo_url}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <Camera size={20} className="text-[--text-quaternary]" />
            )}
          </div>
          <div className="flex-1">
            <label className="btn-secondary inline-flex items-center gap-2 cursor-pointer text-sm">
              {photoUploading ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Uploading...
                </>
              ) : (
                <>
                  <Camera size={14} />
                  {values.profile_photo_url ? 'Change photo' : 'Upload photo'}
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={photoUploading}
                onChange={(e) => handlePhoto(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-xs text-[--text-quaternary] mt-1.5">JPG, PNG, or WebP. Max 5 MB.</p>
            {photoError && <p className="text-xs text-red-400 mt-1">{photoError}</p>}
          </div>
        </div>
      </div>

      {/* Current role / company — required */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">
            Current role <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={values.current_role}
            onChange={(e) => set('current_role', e.target.value)}
            placeholder="e.g., VP, Analyst, Founder"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">
            Current company <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={values.current_company}
            onChange={(e) => set('current_company', e.target.value)}
            placeholder="e.g., Goldman Sachs"
            className="input-field"
          />
        </div>
      </div>

      {/* Sport / grad year */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">Sport</label>
          <input
            type="text"
            list="alumni-form-sports-list"
            value={values.sport}
            onChange={(e) => set('sport', e.target.value)}
            placeholder="Start typing your sport"
            autoComplete="off"
            className="input-field"
          />
          <datalist id="alumni-form-sports-list">
            {SPORTS_LIST.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">Graduation year</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            value={values.graduation_year}
            onChange={(e) => set('graduation_year', e.target.value.replace(/[^0-9]/g, ''))}
            placeholder={`e.g., ${currentYear - 5}`}
            autoComplete="off"
            className="input-field"
          />
        </div>
      </div>

      {/* City / major */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">City</label>
          <input
            type="text"
            value={values.city}
            onChange={(e) => set('city', e.target.value)}
            placeholder="e.g., New York, NY"
            className="input-field"
          />
        </div>
        <div>
          <label className="block text-sm text-[--text-tertiary] mb-2">Major</label>
          <input
            type="text"
            value={values.major}
            onChange={(e) => set('major', e.target.value)}
            placeholder="e.g., Economics"
            className="input-field"
          />
        </div>
      </div>

      {/* LinkedIn */}
      <div>
        <label className="block text-sm text-[--text-tertiary] mb-2">LinkedIn URL</label>
        <input
          type="url"
          value={values.linkedin_url}
          onChange={(e) => set('linkedin_url', e.target.value)}
          placeholder="https://linkedin.com/in/yourprofile"
          className="input-field"
        />
      </div>

      {/* Past experiences */}
      <div>
        <label className="block text-sm text-[--text-tertiary] mb-2">Past experiences</label>
        <textarea
          value={values.past_experiences}
          onChange={(e) => set('past_experiences', e.target.value)}
          placeholder="A short summary of roles or experiences you'd like students to know about."
          rows={4}
          className="input-field resize-none"
        />
      </div>

      {/* Advice */}
      <div>
        <label className="block text-sm text-[--text-tertiary] mb-2">Advice for student-athletes</label>
        <textarea
          value={values.advice}
          onChange={(e) => set('advice', e.target.value)}
          placeholder="One thing you wish you'd known senior year…"
          rows={3}
          className="input-field resize-none"
          maxLength={600}
        />
      </div>

      {/* Engagement intent */}
      <div>
        <label className="block text-sm text-[--text-tertiary] mb-2">Why are you here?</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ENGAGEMENT_INTENT_OPTIONS.map((opt) => {
            const selected = values.engagement_intent === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('engagement_intent', selected ? '' : opt.value)}
                aria-pressed={selected}
                className={`text-left rounded-lg border p-3 transition ${
                  selected
                    ? 'border-[--school-primary] bg-[--school-primary]/10'
                    : 'border-[--border-primary] bg-[--bg-primary] hover:border-[--border-secondary]'
                }`}
              >
                <p className="text-sm font-medium text-[--text-primary]">{opt.label}</p>
                <p className="text-xs text-[--text-tertiary] mt-0.5">{opt.hint}</p>
              </button>
            )
          })}
        </div>
        <p className="text-xs text-[--text-quaternary] mt-1.5">
          Optional — helps students know whether to ask you for advice or send job leads your way.
        </p>
      </div>

      {/* Email visibility toggle */}
      <div className="bg-[--bg-primary] border border-[--border-primary] rounded-lg p-4 flex items-start gap-3">
        <button
          type="button"
          onClick={() => set('share_email_with_students', !values.share_email_with_students)}
          className={`mt-0.5 w-10 h-6 rounded-full transition flex-shrink-0 relative ${
            values.share_email_with_students ? 'bg-[--school-primary]' : 'bg-[--border-secondary]'
          }`}
          role="switch"
          aria-checked={values.share_email_with_students}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition ${
              values.share_email_with_students ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </button>
        <div className="flex-1">
          <p className="text-sm font-medium text-[--text-primary]">
            Share my email with verified Cornell student-athletes
          </p>
          <p className="text-xs text-[--text-tertiary] mt-0.5">
            If off, students can still discover your profile but won't see your email.
          </p>
        </div>
      </div>
    </div>
  )
}
