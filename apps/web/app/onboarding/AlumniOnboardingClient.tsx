'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from '@/components/Link'
import { ArrowRight, ArrowLeft, Check, Loader2, Sparkles } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'
import { trackEvent } from '@/lib/track'
import AlumniProfileForm, {
  AlumniProfileFormValues,
  emptyAlumniProfileValues,
  SPORTS_LIST,
} from '@/components/AlumniProfileForm'

interface MatchedAlumni {
  id: string
  full_name: string
  sport: string
  graduation_year: number
  company: string | null
  role: string | null
  industry: string | null
  location: string | null
  linkedin_url: string | null
  photo_url: string | null
  bio: string | null
  advice: string | null
  match_strategy: 'email' | 'name_sport_year' | 'name_year'
}

interface AlumniOnboardingClientProps {
  userId: string
  userEmail: string
  userName: string
  prefillAlumniId?: string | null
  prefill?: {
    sport?: string
    graduationYear?: number | null
    company?: string
    role?: string
    industry?: string
    location?: string
    linkedinUrl?: string
  }
}

type Step = 'welcome' | 'identify' | 'match' | 'review'

const currentYear = new Date().getFullYear()

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <ScoutLogo href="/" size="md" className="justify-center mb-12" />
        {children}
      </div>
    </main>
  )
}

export default function AlumniOnboardingClient({
  userId,
  userEmail,
  userName,
  prefillAlumniId,
  prefill,
}: AlumniOnboardingClientProps) {
  const router = useRouter()
  const firstName = userName?.split(' ')[0] || ''

  const [step, setStep] = useState<Step>('welcome')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Identify-step state.
  const [sport, setSport] = useState(prefill?.sport || '')
  const [graduationYear, setGraduationYear] = useState(
    prefill?.graduationYear?.toString() || '',
  )

  // Match result.
  const [match, setMatch] = useState<MatchedAlumni | null>(null)
  const [matchedAlumniId, setMatchedAlumniId] = useState<string | null>(prefillAlumniId || null)

  // Review-step values.
  const [values, setValues] = useState<AlumniProfileFormValues>(() => ({
    ...emptyAlumniProfileValues(),
    sport: prefill?.sport || '',
    graduation_year: prefill?.graduationYear?.toString() || '',
    current_role: prefill?.role || '',
    current_company: prefill?.company || '',
    city: prefill?.location || '',
    linkedin_url: prefill?.linkedinUrl || '',
  }))

  // ─── Identify: look up a possible starter profile ──────────────────
  const handleIdentifyNext = async () => {
    setError('')
    if (!sport || !graduationYear) {
      setError('Please enter your sport and graduation year.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/alumni/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sport, graduation_year: parseInt(graduationYear, 10) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lookup failed')

      if (data.match) {
        setMatch(data.match as MatchedAlumni)
        setMatchedAlumniId(data.match.id)
        setStep('match')
      } else {
        // No match — go straight to a blank review.
        setMatch(null)
        setMatchedAlumniId(null)
        seedReviewFromIdentify()
        setStep('review')
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const seedReviewFromIdentify = (fromMatch?: MatchedAlumni) => {
    setValues({
      current_role: fromMatch?.role || values.current_role || '',
      current_company: fromMatch?.company || values.current_company || '',
      linkedin_url: fromMatch?.linkedin_url || values.linkedin_url || '',
      city: fromMatch?.location || values.city || '',
      sport: fromMatch?.sport || sport || values.sport || '',
      graduation_year:
        fromMatch?.graduation_year?.toString() || graduationYear || values.graduation_year || '',
      major: values.major || '',
      past_experiences: fromMatch?.bio || values.past_experiences || '',
      advice: fromMatch?.advice || values.advice || '',
      profile_photo_url: fromMatch?.photo_url || values.profile_photo_url || '',
      share_email_with_students: values.share_email_with_students,
    })
  }

  const handleReviewAndClaim = () => {
    seedReviewFromIdentify(match || undefined)
    setStep('review')
  }

  const handleNotMe = () => {
    // The matched row isn't this user — fall through to a blank review.
    setMatch(null)
    setMatchedAlumniId(null)
    seedReviewFromIdentify()
    setStep('review')
  }

  const handleCreateNew = () => {
    setMatch(null)
    setMatchedAlumniId(null)
    seedReviewFromIdentify()
    setStep('review')
  }

  // ─── Save and publish ──────────────────────────────────────────────
  const handlePublish = async () => {
    setError('')
    if (!values.current_role.trim() || !values.current_company.trim()) {
      setError('Current role and current company are required.')
      return
    }
    if (!values.sport) {
      setError('Please choose your sport.')
      return
    }
    const yearInt = parseInt(values.graduation_year, 10)
    if (!values.graduation_year || isNaN(yearInt) || yearInt < 1960 || yearInt > currentYear) {
      setError(`Please enter a valid graduation year (1960–${currentYear}).`)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/alumni/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumni_id: matchedAlumniId,
          current_role: values.current_role,
          current_company: values.current_company,
          linkedin_url: values.linkedin_url,
          city: values.city,
          sport: values.sport,
          graduation_year: yearInt,
          major: values.major,
          past_experiences: values.past_experiences,
          advice: values.advice,
          profile_photo_url: values.profile_photo_url,
          share_email_with_students: values.share_email_with_students,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to publish')

      trackEvent('alumni_profile_claimed', {
        had_match: Boolean(matchedAlumniId),
      })
      router.push('/profile')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // ─── Welcome ────────────────────────────────────────────────────────
  if (step === 'welcome') {
    return (
      <Shell>
        <div className="mb-10">
          <p className="text-sm font-semibold tracking-widest text-[--school-primary] mb-4 uppercase">
            Cornell Athletics Alumni Network
          </p>
          <h1 className="text-4xl font-semibold text-[--text-primary] leading-tight mb-5">
            Welcome{firstName ? `, ${firstName}` : ''}.
          </h1>
          <p className="text-lg text-[--text-secondary] leading-relaxed">
            Scout helps current Cornell athletes connect with alumni for career guidance.
            We'll see if there's already a starter profile for you on Scout, and let you decide
            what's shared.
          </p>
        </div>

        <div className="space-y-4 mb-12">
          <div className="flex items-start gap-4 py-5 border-t border-[--border-primary]">
            <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2.5 flex-shrink-0" />
            <div>
              <p className="text-base font-medium text-[--text-primary]">You control what students see</p>
              <p className="text-sm text-[--text-tertiary] mt-1">Edit anything before it's published. Toggle email visibility on or off.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 py-5 border-t border-[--border-primary]">
            <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2.5 flex-shrink-0" />
            <div>
              <p className="text-base font-medium text-[--text-primary]">Verified Cornell athletes only</p>
              <p className="text-sm text-[--text-tertiary] mt-1">Access is gated behind a Cornell email verification.</p>
            </div>
          </div>
          <div className="flex items-start gap-4 py-5 border-t border-[--border-primary]">
            <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2.5 flex-shrink-0" />
            <div>
              <p className="text-base font-medium text-[--text-primary]">Less than two minutes</p>
              <p className="text-sm text-[--text-tertiary] mt-1">Confirm your sport and graduation year, then review what's shown.</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep('identify')}
          className="btn-primary w-full flex items-center justify-center gap-2 text-base py-3"
        >
          Get Started
          <ArrowRight size={16} />
        </button>

        <p className="text-center text-[--text-quaternary] text-sm mt-6">
          By continuing you confirm you are a Cornell athlete and consent to your profile being visible to verified Cornell athletes.
        </p>
      </Shell>
    )
  }

  // ─── Identify ───────────────────────────────────────────────────────
  if (step === 'identify') {
    return (
      <Shell>
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--border-secondary]" />
            <div className="w-6 h-1 rounded-full bg-[--border-secondary]" />
          </div>
          <span className="text-xs text-[--text-quaternary]">Step 1 of 3</span>
        </div>

        <div className="mb-10">
          <h2 className="text-3xl font-semibold text-[--text-primary] mb-2">Your Cornell athletics</h2>
          <p className="text-base text-[--text-tertiary] leading-relaxed">Confirm your sport and graduation year so we can look up your starter profile.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
            {error}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-[--text-tertiary] mb-2">Sport</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value)}
              className="input-field cursor-pointer"
            >
              <option value="">Select your sport</option>
              {SPORTS_LIST.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-[--text-tertiary] mb-2">Graduation year</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{4}"
              maxLength={4}
              value={graduationYear}
              onChange={(e) => setGraduationYear(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder={`e.g., ${currentYear - 5}`}
              autoComplete="off"
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button onClick={() => setStep('welcome')} className="btn-secondary px-5">
            <ArrowLeft size={15} />
          </button>
          <button
            onClick={handleIdentifyNext}
            disabled={!sport || !graduationYear || isSubmitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : (
              <>Look up my profile <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </Shell>
    )
  }

  // ─── Match decision ─────────────────────────────────────────────────
  if (step === 'match' && match) {
    return (
      <Shell>
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--border-secondary]" />
          </div>
          <span className="text-xs text-[--text-quaternary]">Step 2 of 3</span>
        </div>

        <div className="mb-7">
          <div className="inline-flex items-center gap-2 text-sm text-[--school-primary] mb-3 font-medium">
            <Sparkles size={14} /> POSSIBLE MATCH
          </div>
          <h2 className="text-3xl font-semibold text-[--text-primary] mb-3 leading-tight">
            We found a possible starter profile for you
          </h2>
          <p className="text-base text-[--text-tertiary] leading-relaxed">
            Please review it and update anything that looks outdated or incorrect.
            You'll control what students can see.
          </p>
        </div>

        {/* High-confidence: name, sport, year */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-4">
          <p className="text-xs uppercase tracking-wide text-[--text-quaternary] mb-3">Match identifiers</p>
          <div className="space-y-2">
            <Row label="Name" value={match.full_name} />
            <Row label="Sport" value={match.sport} />
            <Row label="Graduation year" value={String(match.graduation_year)} />
          </div>
        </div>

        {/* Low-confidence: existing role/company */}
        {(match.role || match.company || match.location) && (
          <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-5 mb-5">
            <p className="text-xs uppercase tracking-wide text-[--text-quaternary] mb-1">
              Existing info on Scout
            </p>
            <p className="text-xs text-[--text-quaternary] mb-3 italic">
              May be outdated. You can edit or remove any of this in the next step.
            </p>
            <div className="space-y-2">
              {match.role && <Row label="Role" value={match.role} muted />}
              {match.company && <Row label="Company" value={match.company} muted />}
              {match.location && <Row label="Location" value={match.location} muted />}
            </div>
          </div>
        )}

        <p className="text-xs text-[--text-tertiary] leading-relaxed mb-6">
          Scout uses starter alumni profiles to help Cornell student-athletes discover relevant people.
          Once you claim your profile, you decide what is shown.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <button
            onClick={handleReviewAndClaim}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Review and claim
            <ArrowRight size={15} />
          </button>
          <button
            onClick={handleNotMe}
            className="btn-secondary w-full"
          >
            This isn't me
          </button>
          <button
            onClick={handleCreateNew}
            className="btn-ghost w-full text-sm"
          >
            Create new profile instead
          </button>
        </div>
      </Shell>
    )
  }

  // ─── Review & publish ───────────────────────────────────────────────
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        {/* Warm beige accent bar at top */}
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

        <ScoutLogo href="/" size="md" className="justify-center mb-10" />

        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
          </div>
          <span className="text-xs text-[--text-quaternary]">
            {matchedAlumniId ? 'Step 3 of 3 · Review and claim' : 'Step 3 of 3 · Create your profile'}
          </span>
        </div>

        <div className="mb-7">
          <h2 className="text-3xl font-semibold text-[--text-primary] mb-2 leading-tight">
            {matchedAlumniId ? 'Review and update' : 'Tell students about you'}
          </h2>
          <p className="text-base text-[--text-tertiary] leading-relaxed">
            {matchedAlumniId
              ? 'Everything below is editable. Your edits replace whatever was on Scout before.'
              : 'Just current role and current company are required. Everything else is optional but helps students.'}
          </p>
        </div>

        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-6 md:p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
              {error}
            </div>
          )}

          <AlumniProfileForm values={values} onChange={setValues} showReviewBanner />
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setStep(match ? 'match' : 'identify')} className="btn-secondary px-5">
            <ArrowLeft size={15} />
          </button>
          <button
            onClick={handlePublish}
            disabled={isSubmitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <>
                <Check size={15} />
                Save and publish profile
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-[--text-quaternary] mt-5">
          You can edit your profile anytime from your dashboard.
        </p>
      </div>
    </main>
  )
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <span className="text-[--text-quaternary] w-32 flex-shrink-0">{label}</span>
      <span className={muted ? 'text-[--text-tertiary]' : 'text-[--text-primary] font-medium'}>
        {value}
      </span>
    </div>
  )
}
