'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, Check } from 'lucide-react'
import { trackEvent } from '@/lib/track'
import Link from '@/components/Link'

const SPORTS_LIST = [
  'Baseball',
  'Equestrian',
  'Fencing',
  'Field Hockey',
  'Football',
  "Men's Basketball",
  "Men's Cross Country",
  "Men's Golf",
  "Men's Ice Hockey",
  "Men's Lacrosse",
  "Men's Rowing",
  "Men's Soccer",
  "Men's Squash",
  "Men's Swimming And Diving",
  "Men's Tennis",
  "Men's Track And Field",
  'Rowing',
  'Softball',
  'Sprint Football',
  "Women's Basketball",
  "Women's Cross Country",
  "Women's Gymnastics",
  "Women's Ice Hockey",
  "Women's Lacrosse",
  "Women's Rowing",
  "Women's Sailing",
  "Women's Soccer",
  "Women's Squash",
  "Women's Swimming And Diving",
  "Women's Tennis",
  "Women's Track And Field",
  "Women's Volleyball",
  'Wrestling',
]

const INDUSTRIES = [
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
  'Education',
  'Real Estate',
  'Non-Profit',
  'Government',
  'Sports',
  'Other',
]

const currentYear = new Date().getFullYear()

interface AlumniOnboardingClientProps {
  userId: string
  userEmail: string
  userName: string
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

export default function AlumniOnboardingClient({
  userId,
  userEmail,
  userName,
  prefill,
}: AlumniOnboardingClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const firstName = userName?.split(' ')[0] || ''

  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1 fields
  const [sport, setSport] = useState(prefill?.sport || '')
  const [graduationYear, setGraduationYear] = useState(
    prefill?.graduationYear?.toString() || ''
  )
  const [gradYearError, setGradYearError] = useState('')

  // Step 2 fields
  const [company, setCompany] = useState(prefill?.company || '')
  const [role, setRole] = useState(prefill?.role || '')
  const [industry, setIndustry] = useState(prefill?.industry || '')
  const [location, setLocation] = useState(prefill?.location || '')
  const [linkedinUrl, setLinkedinUrl] = useState(prefill?.linkedinUrl || '')

  const validateGradYear = (val: string) => {
    const n = parseInt(val)
    if (!val) { setGradYearError(''); return true }
    if (isNaN(n) || n < 1960 || n > currentYear) {
      setGradYearError(`Enter a year between 1960 and ${currentYear}`)
      return false
    }
    setGradYearError('')
    return true
  }

  const handleStep1Next = () => {
    if (!validateGradYear(graduationYear)) return
    setStep(2)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const yearInt = graduationYear ? parseInt(graduationYear) : null

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          sport: sport || null,
          graduation_year: yearInt,
          company: company || null,
          role: role || null,
          industry: industry || null,
          location: location || null,
          linkedin_url: linkedinUrl || null,
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (profileError) throw profileError

      // Sync to alumni table
      if (sport && yearInt) {
        const alumniData = {
          full_name: userName,
          email: userEmail,
          sport,
          graduation_year: yearInt,
          company: company || null,
          role: role || null,
          industry: industry || null,
          location: location || null,
          linkedin_url: linkedinUrl || null,
          source: 'opt_in',
          is_public: true,
          is_verified: true,
        }

        const { data: existing } = await supabase
          .from('alumni')
          .select('id')
          .eq('email', userEmail)
          .single()

        if (existing) {
          await supabase.from('alumni').update(alumniData).eq('id', existing.id)
        } else {
          await supabase.from('alumni').insert(alumniData)
        }
      }

      trackEvent('alumni_onboarding_completed', { sport, industry })
      router.push('/plan')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  // ─── Welcome screen ──────────────────────────────────────────────
  if (step === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center justify-center gap-2 mb-12">
            <img src="/favicon.svg" alt="Scout" className="w-7 h-7" />
            <span className="logo-text text-lg">Scout</span>
          </Link>

          <div className="mb-8">
            <p className="text-xs font-semibold tracking-widest text-[--school-primary] mb-3 uppercase">
              Cornell Athletics Alumni Network
            </p>
            <h1 className="text-3xl font-semibold text-[--text-primary] leading-tight mb-4">
              Welcome{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="text-[--text-secondary] leading-relaxed">
              Scout helps current Cornell athletes connect with alumni for career guidance.
              When a student-athlete in your sport reaches out, you'll receive a personalized message —
              and you decide if and when to respond.
            </p>
          </div>

          <div className="space-y-4 mb-10">
            <div className="flex items-start gap-4 py-4 border-t border-[--border-primary]">
              <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[--text-primary]">Only verified Cornell athletes can see your profile</p>
                <p className="text-xs text-[--text-tertiary] mt-0.5">Access is gated behind a Cornell email verification.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-4 border-t border-[--border-primary]">
              <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[--text-primary]">You're in control</p>
                <p className="text-xs text-[--text-tertiary] mt-0.5">No commitments. Respond when it's convenient. Update or remove your profile anytime.</p>
              </div>
            </div>
            <div className="flex items-start gap-4 py-4 border-t border-[--border-primary]">
              <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary] mt-2 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[--text-primary]">Two minutes to set up</p>
                <p className="text-xs text-[--text-tertiary] mt-0.5">Just your sport, graduation year, and current role. That's it.</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setStep(1)}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            Set Up My Profile
            <ArrowRight size={15} />
          </button>

          <p className="text-center text-[--text-quaternary] text-xs mt-5">
            By continuing you confirm you are a Cornell athlete and consent to your profile being visible to verified Cornell athletes.
          </p>
        </div>
      </main>
    )
  }

  // ─── Step 1: Athletic background ─────────────────────────────────
  if (step === 1) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Link href="/" className="flex items-center justify-center gap-2 mb-12">
            <img src="/favicon.svg" alt="Scout" className="w-7 h-7" />
            <span className="logo-text text-lg">Scout</span>
          </Link>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className="flex gap-1.5">
              <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
              <div className="w-6 h-1 rounded-full bg-[--border-secondary]" />
            </div>
            <span className="text-xs text-[--text-quaternary]">Step 1 of 2</span>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-[--text-primary] mb-1">Your Cornell athletics</h2>
            <p className="text-sm text-[--text-tertiary]">Confirm your sport and the year you graduated.</p>
          </div>

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
              <label className="block text-sm text-[--text-tertiary] mb-2">Graduation Year</label>
              <input
                type="number"
                value={graduationYear}
                onChange={(e) => {
                  setGraduationYear(e.target.value)
                  if (gradYearError) validateGradYear(e.target.value)
                }}
                onBlur={(e) => validateGradYear(e.target.value)}
                placeholder={`e.g., ${currentYear - 5}`}
                min={1960}
                max={currentYear}
                className={`input-field ${gradYearError ? 'border-red-500/50 focus:border-red-500' : ''}`}
              />
              {gradYearError ? (
                <p className="text-xs text-red-400 mt-1.5">{gradYearError}</p>
              ) : (
                <p className="text-xs text-[--text-quaternary] mt-1.5">Enter the year you graduated from Cornell.</p>
              )}
            </div>
          </div>

          <div className="mt-8">
            <button
              onClick={handleStep1Next}
              disabled={!sport || !graduationYear}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-40"
            >
              Next
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </main>
    )
  }

  // ─── Step 2: Career info ──────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-2 mb-12">
          <img src="/favicon.svg" alt="Scout" className="w-7 h-7" />
          <span className="logo-text text-lg">Scout</span>
        </Link>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          <div className="flex gap-1.5">
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
            <div className="w-6 h-1 rounded-full bg-[--school-primary]" />
          </div>
          <span className="text-xs text-[--text-quaternary]">Step 2 of 2</span>
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-semibold text-[--text-primary] mb-1">Your current career</h2>
          <p className="text-sm text-[--text-tertiary]">This helps students understand your background and reach out with relevant questions.</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-5">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Company</label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Goldman Sachs"
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Title</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., VP, Analyst"
                className="input-field"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., New York, NY"
                className="input-field"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-[--text-tertiary] mb-2">LinkedIn URL <span className="text-[--text-quaternary]">(optional)</span></label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className="input-field"
            />
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={() => setStep(1)}
            className="btn-secondary px-5"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
              <>
                <Check size={15} />
                Finish Setup
              </>
            )}
          </button>
        </div>
      </div>
    </main>
  )
}
