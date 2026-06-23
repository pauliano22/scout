'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Camera, Mail, MapPin, Briefcase, GraduationCap, Award, Pencil, Check,
  Loader2, EyeOff, Linkedin,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Alumni, WorkHistoryEntry } from '@scout/shared/types/database'
import AlumniProfileForm, {
  AlumniProfileFormValues,
  emptyAlumniProfileValues,
} from '@/components/AlumniProfileForm'
import ProfileCompletionWidget from '@/components/ProfileCompletionWidget'

interface Props {
  userEmail: string
  fullName: string
  alumni: Alumni | null
  major: string | null
}

const VIEW = 'view' as const
const EDIT = 'edit' as const
type Mode = typeof VIEW | typeof EDIT

export default function AlumniProfileClient({
  userEmail,
  fullName,
  alumni,
  major,
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>(VIEW)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const initialValues: AlumniProfileFormValues = useMemo(() => ({
    ...emptyAlumniProfileValues(),
    current_role: alumni?.role || '',
    current_company: alumni?.company || '',
    linkedin_url: alumni?.linkedin_url || '',
    city: alumni?.location || '',
    sport: alumni?.sport || '',
    graduation_year: alumni?.graduation_year ? String(alumni.graduation_year) : '',
    major: major || '',
    past_experiences: alumni?.bio || '',
    advice: alumni?.advice || '',
    profile_photo_url: alumni?.photo_url || '',
    share_email_with_students: Boolean(alumni?.share_email_with_students),
  }), [alumni, major])

  const [values, setValues] = useState<AlumniProfileFormValues>(initialValues)

  const handleSave = async () => {
    setError('')
    if (!values.current_role.trim() || !values.current_company.trim()) {
      setError('Current role and current company are required.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/alumni/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumni_id: alumni?.id || null,
          current_role: values.current_role,
          current_company: values.current_company,
          linkedin_url: values.linkedin_url,
          city: values.city,
          sport: values.sport,
          graduation_year: values.graduation_year
            ? parseInt(values.graduation_year, 10)
            : null,
          major: values.major,
          past_experiences: values.past_experiences,
          advice: values.advice,
          profile_photo_url: values.profile_photo_url,
          share_email_with_students: values.share_email_with_students,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setMode(VIEW)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleEmailVisibility = async () => {
    const next = !values.share_email_with_students
    // Optimistic flip in view mode without entering full edit.
    setValues((v) => ({ ...v, share_email_with_students: next }))
    if (!alumni?.id) return
    try {
      await supabase
        .from('alumni')
        .update({ share_email_with_students: next })
        .eq('id', alumni.id)
      router.refresh()
    } catch {
      // Revert on error.
      setValues((v) => ({ ...v, share_email_with_students: !next }))
    }
  }

  // ─── Edit mode ─────────────────────────────────────────────────────
  if (mode === EDIT) {
    return (
      <main className="min-h-screen px-4 py-12">
        <div className="w-full max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">Edit your profile</h1>
            <button onClick={() => { setValues(initialValues); setMode(VIEW) }} className="btn-ghost text-sm">
              Cancel
            </button>
          </div>

          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-6 md:p-8">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
                {error}
              </div>
            )}
            <AlumniProfileForm values={values} onChange={setValues} showReviewBanner />
          </div>

          <div className="mt-6 flex gap-3 justify-end">
            <button onClick={() => { setValues(initialValues); setMode(VIEW) }} className="btn-secondary px-5">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary flex items-center justify-center gap-2 px-5"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : (
                <>
                  <Check size={15} />
                  Save changes
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ─── View mode ─────────────────────────────────────────────────────
  const role = alumni?.role || values.current_role
  const company = alumni?.company || values.current_company
  const photoUrl = alumni?.photo_url || values.profile_photo_url
  const shareEmail = Boolean(alumni?.share_email_with_students ?? values.share_email_with_students)
  const workHistory = (alumni?.work_history || []) as WorkHistoryEntry[]

  return (
    <main className="min-h-screen px-4 py-10">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <p className="text-xs text-[--text-quaternary] uppercase tracking-widest">Your profile</p>
          <button
            onClick={() => setMode(EDIT)}
            className="btn-secondary text-sm flex items-center gap-2"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>

        {/* Profile completion widget */}
        <div className="mb-5">
          <ProfileCompletionWidget
            alumni={alumni}
            compact={false}
            onFieldClick={(label) => {
              // Switch to edit mode when a missing field is clicked.
              setValues({
                ...values,
                // Pre-populate from alumni data if available.
              })
              setMode(EDIT)
            }}
          />
        </div>

        {/* Header card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-8 md:p-10 mb-5">
          <div className="flex flex-col items-center text-center">
            <div className="w-28 h-28 rounded-full bg-[--bg-tertiary] border border-[--border-primary] overflow-hidden flex items-center justify-center mb-4">
              {photoUrl ? (
                <img src={photoUrl} alt={fullName} className="w-full h-full object-cover" />
              ) : (
                <Camera size={28} className="text-[--text-quaternary]" />
              )}
            </div>
            <h1 className="text-2xl font-semibold text-[--text-primary]">{fullName}</h1>
            {(role || company) && (
              <p className="text-[--text-secondary] mt-1">
                {role}
                {role && company && <span className="text-[--text-quaternary]"> · </span>}
                {company}
              </p>
            )}
          </div>

          {/* Meta row */}
          <div className="mt-6 pt-6 border-t border-[--border-primary] grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Meta icon={MapPin} label="City" value={alumni?.location} />
            <Meta icon={Award} label="Sport" value={alumni?.sport} />
            <Meta icon={GraduationCap} label="Class of" value={alumni?.graduation_year ? String(alumni.graduation_year) : null} />
            <Meta icon={Briefcase} label="Major" value={major} />
          </div>
        </div>

        {/* Advice */}
        {alumni?.advice && (
          <Section title="Advice for student-athletes">
            <p className="text-[--text-secondary] leading-relaxed whitespace-pre-line">
              {alumni.advice}
            </p>
          </Section>
        )}

        {/* Past experience */}
        {(alumni?.bio || workHistory.length > 0) && (
          <Section title="Past experience">
            {alumni?.bio && (
              <p className="text-[--text-secondary] leading-relaxed whitespace-pre-line mb-5">
                {alumni.bio}
              </p>
            )}
            {workHistory.length > 0 && (
              <ol className="relative border-l border-[--border-primary] ml-2 space-y-4">
                {workHistory.map((entry, i) => (
                  <li key={i} className="pl-5 relative">
                    <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-[--school-primary]" />
                    <p className="text-sm font-medium text-[--text-primary]">
                      {entry.title || 'Role'}{entry.company ? ` · ${entry.company}` : ''}
                    </p>
                    {(entry.start || entry.end) && (
                      <p className="text-xs text-[--text-quaternary] mt-0.5">
                        {entry.start?.year ?? ''}{entry.end ? ` – ${entry.end.year ?? 'Present'}` : ''}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        )}

        {/* Contact */}
        <Section title="Contact">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <Mail size={15} className="text-[--text-quaternary]" />
              {shareEmail ? (
                <span className="text-[--text-secondary]">{userEmail}</span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-[--text-tertiary]">
                  <EyeOff size={12} />
                  Email hidden from students
                </span>
              )}
              <button
                onClick={toggleEmailVisibility}
                className="ml-auto text-xs text-[--school-primary] hover:underline"
              >
                {shareEmail ? 'Hide from students' : 'Share with students'}
              </button>
            </div>
            {alumni?.linkedin_url && (
              <div className="flex items-center gap-3 text-sm">
                <Linkedin size={15} className="text-[--text-quaternary]" />
                <a
                  href={alumni.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[--school-primary] hover:underline truncate"
                >
                  {alumni.linkedin_url}
                </a>
              </div>
            )}
          </div>
        </Section>

        <p className="text-center text-xs text-[--text-quaternary] mt-8">
          Only verified Cornell student-athletes on Scout can view your profile.
        </p>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 md:p-8 mb-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[--text-quaternary] mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Meta({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value?: string | null
}) {
  if (!value) return (
    <div>
      <p className="text-[10px] text-[--text-quaternary] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-[--text-quaternary]">Not set</p>
    </div>
  )
  return (
    <div>
      <p className="text-[10px] text-[--text-quaternary] uppercase tracking-wide mb-1 flex items-center gap-1">
        <Icon size={10} /> {label}
      </p>
      <p className="text-sm text-[--text-primary]">{value}</p>
    </div>
  )
}
