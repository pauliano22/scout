'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Mail, MapPin, Briefcase, GraduationCap, Award, Pencil, Check,
  Loader2, EyeOff, Linkedin,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Alumni, AmbassadorProfile, AmbassadorTier, AmbassadorBadgeType, WorkHistoryEntry } from '@scout/shared/types/database'
import type { Circle } from '@/lib/alumni-circle'
import { formatGradYearShort } from '@scout/shared/profile/alumniProfile'
import { trackEvent } from '@/lib/track'
import AlumniProfileForm, {
  AlumniProfileFormValues,
  emptyAlumniProfileValues,
} from '@/components/AlumniProfileForm'
import LinkedInImport from '@/components/LinkedInImport'
import Avatar from '@/components/Avatar'
import SportAvatar from '@/components/SportAvatar'
import VarsityBadge from '@/components/VarsityBadge'
import ReferralProgressTracker from '@/components/ReferralProgressTracker'

interface Props {
  userEmail: string
  fullName: string
  alumni: Alumni | null
  major: string | null
  ambassador: AmbassadorProfile | null
  circle: Circle | null
}

const VIEW = 'view' as const
const EDIT = 'edit' as const
type Mode = typeof VIEW | typeof EDIT

export default function AlumniProfileClient({
  userEmail,
  fullName,
  alumni,
  major,
  ambassador,
  circle,
}: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(VIEW)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // One-time, dismissible prompt for claimed alumni who haven't said why
  // they're here. Skipping hides it on this device for good; no re-asking.
  const INTENT_NUDGE_KEY = 'scout_intent_nudge_dismissed'
  const [intentNudgeHidden, setIntentNudgeHidden] = useState(true)
  const [intentSaving, setIntentSaving] = useState<string | null>(null)
  useEffect(() => {
    if (alumni?.is_claimed && !alumni.engagement_intent) {
      try {
        setIntentNudgeHidden(localStorage.getItem(INTENT_NUDGE_KEY) === '1')
      } catch {
        setIntentNudgeHidden(false)
      }
    }
  }, [alumni?.is_claimed, alumni?.engagement_intent])

  const dismissIntentNudge = () => {
    setIntentNudgeHidden(true)
    try { localStorage.setItem(INTENT_NUDGE_KEY, '1') } catch {}
  }

  const saveIntent = async (intent: 'here_to_help' | 'seeking_employment' | 'both') => {
    if (!alumni?.id) return
    setIntentSaving(intent)
    try {
      const res = await fetch('/api/alumni/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engagement_intent: intent }),
      })
      if (!res.ok) throw new Error()
      setIntentNudgeHidden(true)
      router.refresh()
    } catch {
      setIntentSaving(null)
    }
  }

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
    engagement_intent: alumni?.engagement_intent || '',
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
          engagement_intent: values.engagement_intent || null,
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
    // Optimistic flip in view mode without entering full edit. Goes through
    // the settings route: RLS on alumni is SELECT-only, so a browser-side
    // UPDATE silently matches 0 rows.
    setValues((v) => ({ ...v, share_email_with_students: next }))
    if (!alumni?.id) return
    try {
      const res = await fetch('/api/alumni/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share_email_with_students: next }),
      })
      if (!res.ok) throw new Error()
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
            <AlumniProfileForm values={values} onChange={setValues} showReviewBanner fullName={fullName} />
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

        {/* Header card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-8 md:p-10 mb-5">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4">
              <SportAvatar
                name={fullName}
                sport={alumni?.sport}
                imageUrl={photoUrl || null}
                size="2xl"
              />
            </div>
            <h1 className="text-2xl font-semibold text-[--text-primary]">{fullName}</h1>
            {(role || company) && (
              <p className="text-[--text-secondary] mt-1">
                {role}
                {role && company && <span className="text-[--text-quaternary]"> · </span>}
                {company}
              </p>
            )}
            {ambassador && (
              <div className="mt-3">
                <VarsityBadge
                  sport={ambassador.sport}
                  tier={ambassador.tier as AmbassadorTier}
                  badgeType={ambassador.badge_type as AmbassadorBadgeType}
                  size="lg"
                />
              </div>
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

        {/* Engagement intent nudge: one question, one tap, easy to skip */}
        {alumni?.is_claimed && !alumni.engagement_intent && !intentNudgeHidden && (
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-5 mb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-[--text-primary]">
                  Are you here to help students, open to opportunities yourself, or both?
                </p>
                <p className="text-xs text-[--text-tertiary] mt-1">
                  Students see this on your profile. You can change it anytime.
                </p>
              </div>
              <button
                onClick={dismissIntentNudge}
                className="text-xs text-[--text-quaternary] hover:text-[--text-secondary] flex-shrink-0"
              >
                Skip
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {([
                ['here_to_help', 'Here to help'],
                ['seeking_employment', 'Open to opportunities'],
                ['both', 'Both'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => saveIntent(value)}
                  disabled={intentSaving !== null}
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                >
                  {intentSaving === value && <Loader2 size={11} className="animate-spin" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Your circle: teammates from the alum's own playing years */}
        {circle && <CircleSection circle={circle} />}

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

        {/* LinkedIn Import */}
        <LinkedInImport />

        {/* Referral Program */}
        <ReferralProgressTracker />

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

function CircleSection({ circle }: { circle: Circle }) {
  const { person, teammates, teammatesCount, eraCount } = circle

  const hasContent = teammates.length > 0 || (person.campusStart != null && eraCount > 0)

  useEffect(() => {
    if (!hasContent) return
    trackEvent('circle_section_viewed', {
      teammates_count: teammatesCount,
      on_scout_count: teammates.filter(t => t.onScout).length,
      era_count: eraCount,
    })
    // Mount-only: the section renders once per page load with a fixed circle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Nothing useful to show: no campus window on record, or truly no overlaps.
  if (!hasContent) return null

  const fullCircleHref = `/map?sel=${person.id}`

  if (teammates.length === 0) {
    return (
      <Section title="Your circle">
        <p className="text-sm text-[--text-tertiary]">
          No direct teammates in our records, but {eraCount.toLocaleString()} athletes were on
          campus during your years.
        </p>
        <Link href={fullCircleHref} className="inline-block mt-3 text-sm text-[--school-primary] hover:underline">
          View your full circle →
        </Link>
      </Section>
    )
  }

  return (
    <Section title="Your circle">
      <p className="text-sm text-[--text-tertiary] mb-4">
        {teammatesCount.toLocaleString()} teammate{teammatesCount === 1 ? '' : 's'}
        {eraCount > 0 && <> · {eraCount.toLocaleString()} more on campus in your era</>}
      </p>
      <div className="divide-y divide-[--border-primary]">
        {teammates.map((t) => (
          <Link
            key={t.id}
            href={`/map?sel=${t.id}`}
            onClick={() => trackEvent('circle_teammate_clicked', { alumni_id: t.id, on_scout: t.onScout })}
            className="flex items-center gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-[--bg-tertiary] transition-colors"
          >
            <Avatar name={t.name} imageUrl={t.avatar} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[--text-primary] truncate">
                {t.name}
                {t.gradYear && (
                  <span className="text-[--text-quaternary] font-normal"> {formatGradYearShort(t.gradYear)}</span>
                )}
              </p>
              <p className="text-xs text-[--text-tertiary] truncate">
                {t.seasons > 0
                  ? `Played together ${t.seasons} season${t.seasons === 1 ? '' : 's'}`
                  : 'On campus together'}
                {(() => {
                  const work = t.role && t.company ? `${t.role} at ${t.company}` : t.role || t.company || t.location
                  return work ? <> · {work}</> : null
                })()}
              </p>
            </div>
            {t.onScout && (
              <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-[--text-tertiary]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                On Scout
              </span>
            )}
          </Link>
        ))}
      </div>
      <Link
        href={fullCircleHref}
        onClick={() => trackEvent('circle_view_all_clicked')}
        className="inline-block mt-4 text-sm text-[--school-primary] hover:underline"
      >
        {teammatesCount > teammates.length
          ? `View all ${teammatesCount.toLocaleString()} teammates →`
          : 'View your full circle →'}
      </Link>
    </Section>
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
