'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'
import ResumeUpload from '@/components/ResumeUpload'
import ScoutLogo from '@/components/ScoutLogo'
import { trackEvent } from '@/lib/track'

const INDUSTRIES = [
  'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media',
  'Education', 'Real Estate', 'Non-Profit', 'Government', 'Sports', 'Other'
]

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

const TOTAL_STEPS = 5

// Generate graduation year options for current students (last year through 6 years out)
const currentYear = new Date().getFullYear()
const GRAD_YEARS = Array.from({ length: 8 }, (_, i) => currentYear - 1 + i)

interface OnboardingClientProps {
  userId: string
  userName: string
  isAlumni?: boolean
  prefill?: {
    sport?: string
    graduationYear?: number | null
    primaryIndustry?: string
  }
}

export default function OnboardingClient({ userId, userName, prefill }: OnboardingClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)  // 0 = welcome/consent screen
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Sport & Graduation Year
  const [sport, setSport] = useState(prefill?.sport || '')
  const [graduationYear, setGraduationYear] = useState<number | ''>(prefill?.graduationYear || '')

  // Step 2: Career Targeting — `industries[0]` is the primary, the rest secondary
  const [industries, setIndustries] = useState<string[]>(prefill?.primaryIndustry ? [prefill.primaryIndustry] : [])
  const [targetRoles, setTargetRoles] = useState<string[]>([])
  const [roleInput, setRoleInput] = useState('')

  // Step 3: Current Stage
  const [currentStage, setCurrentStage] = useState<string>('exploring')

  // Step 4: Geography
  const [preferredLocations, setPreferredLocations] = useState<string[]>([''])

  const handleNext = () => {
    if (step < TOTAL_STEPS) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError('')

    try {
      const cleanedLocations = preferredLocations.filter(l => l.trim())
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          sport: sport || null,
          graduation_year: graduationYear || null,
          primary_industry: industries[0] || null,
          target_roles: targetRoles,
          secondary_industries: industries.slice(1),
          // Networking-intensity step was removed; default everyone to their own pace.
          networking_intensity: 'own_pace',
          current_stage: currentStage,
          preferred_locations: cleanedLocations,
          // Derived from whether they named any locations — keeps the goal/picks
          // logic that gates on geography_preference working without a radio step.
          geography_preference: cleanedLocations.length > 0 ? 'city' : 'doesnt_matter',
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      // Seed today's picks from the COMPLETE profile (sport, industries, roles,
      // locations) so alumni are already waiting on the home the moment they
      // land. Awaited so the seed wins the first-visit race; the home also
      // materializes lazily on load as a fallback.
      await fetch('/api/picks/warm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {})

      trackEvent('onboarding_completed', {
        sport,
        primary_industry: industries[0] || '',
        current_stage: currentStage,
      })

      router.push('/campaign')
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Selection order is meaningful: the first industry tapped is the primary,
  // every subsequent one is a secondary "also open to".
  const toggleIndustry = (industry: string) => {
    setIndustries(prev =>
      prev.includes(industry)
        ? prev.filter(i => i !== industry)
        : [...prev, industry]
    )
  }

  const addRole = () => {
    const v = roleInput.trim()
    if (!v || targetRoles.length >= 3 || targetRoles.includes(v)) return
    setTargetRoles([...targetRoles, v])
    setRoleInput('')
  }

  const removeRole = (index: number) => {
    setTargetRoles(targetRoles.filter((_, i) => i !== index))
  }

  const addLocation = () => {
    if (preferredLocations.length < 3) setPreferredLocations([...preferredLocations, ''])
  }

  const updateLocation = (index: number, value: string) => {
    const updated = [...preferredLocations]
    updated[index] = value
    setPreferredLocations(updated)
  }

  const removeLocation = (index: number) => {
    if (preferredLocations.length > 1) {
      setPreferredLocations(preferredLocations.filter((_, i) => i !== index))
    }
  }

  // Welcome / consent screen
  if (step === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          {/* Warm beige accent bar at top */}
          <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

          <div className="flex items-center justify-center gap-2 mb-8">
            <ScoutLogo size="lg" href="/" />
          </div>

          <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
            {/* Cornell 'C' watermark */}
            <div
              className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[100px] font-bold leading-none opacity-30"
              aria-hidden="true"
            >
              C
            </div>

            <h2 className="text-2xl font-semibold mb-2 relative z-10">Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!</h2>
            <p className="text-[--text-tertiary] text-sm mb-6 relative z-10">
              Before we get started, here&apos;s what you should know about Scout.
            </p>

            <div className="space-y-5 mb-8 relative z-10">
              <div className="pb-5 border-b border-[--accent-warm-border]">
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Cornell athletes only</div>
                <div className="text-xs text-[--text-tertiary]">Verified through your Cornell email. Your info is never sold, and only verified athletes can see the alumni directory.</div>
              </div>

              <div>
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Built for networking</div>
                <div className="text-xs text-[--text-tertiary]">A few quick questions about your sport and career goals lets Scout surface the most relevant alumni. Takes about two minutes.</div>
              </div>
            </div>

            <p className="text-xs text-[--text-quaternary] mb-6 relative z-10">
              By continuing, you agree that you are a current or former Cornell student-athlete and consent to Scout using your profile information to generate personalized networking recommendations.
            </p>

            <button
              onClick={() => setStep(1)}
              className="btn-primary w-full flex items-center justify-center gap-2 relative z-10"
            >
              Get Started
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Warm beige accent bar at top */}
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

        {/* Logo */}
        <ScoutLogo size="lg" href="/" className="justify-center mb-8" />

        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs text-[--text-tertiary] mb-2">
            <span>Step {step} of {TOTAL_STEPS}</span>
            <span>{Math.round((step / TOTAL_STEPS) * 100)}%</span>
          </div>
          <div className="h-1.5 bg-[--bg-tertiary] rounded-full overflow-hidden">
            <div
              className="h-full bg-[--school-primary] rounded-full transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          <div className="relative z-10">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Sport & Graduation Year */}
          {step === 1 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">About You</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Tell us about your athletic background at Cornell.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Sport
                  </label>
                  <input
                    type="text"
                    list="sports-list"
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    placeholder="Start typing your sport"
                    autoComplete="off"
                    className="input-field"
                  />
                  <datalist id="sports-list">
                    {SPORTS_LIST.map(s => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Graduation Year
                  </label>
                  <select
                    value={graduationYear}
                    onChange={(e) => setGraduationYear(e.target.value ? parseInt(e.target.value) : '')}
                    className="input-field"
                  >
                    <option value="">Select your graduation year</option>
                    {GRAD_YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Career Targeting */}
          {step === 2 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Career Targeting</h2>

              <div className="space-y-8">
                {/* Industries — order-based: first tap is the primary, the rest secondary */}
                <div>
                  <label className="text-sm font-medium text-[--text-secondary] block">
                    Industries{' '}
                    <span className="text-[--text-quaternary] font-normal">— tap to pick. First is your primary.</span>
                  </label>

                  <div className="flex items-center gap-4 mt-2 mb-3 text-xs text-[--text-tertiary]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-[3px] bg-[--school-primary]" />
                      Primary
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-[3px] bg-[--school-primary]/10 border border-[--school-primary]/30" />
                      Open to
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map(ind => {
                      const idx = industries.indexOf(ind)
                      const isPrimary = idx === 0
                      const isSecondary = idx > 0
                      return (
                        <button
                          key={ind}
                          type="button"
                          onClick={() => toggleIndustry(ind)}
                          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm border transition-all active:scale-[0.97] ${
                            isPrimary
                              ? 'bg-[--school-primary] border-[--school-primary] text-white'
                              : isSecondary
                                ? 'bg-[--school-primary]/10 border-[--school-primary]/30 text-[--school-primary]'
                                : 'bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] hover:border-[--border-secondary]'
                          }`}
                        >
                          {ind}
                          {isPrimary && (
                            <span className="text-[10px] font-bold tracking-wider uppercase opacity-90">Primary</span>
                          )}
                        </button>
                      )
                    })}
                  </div>

                  <p className="text-xs text-[--text-quaternary] mt-3 min-h-[18px]">
                    {industries.length === 0
                      ? 'Pick your primary industry first.'
                      : industries.length === 1
                        ? `${industries[0]} · primary. Tap more if you're open to others.`
                        : `${industries[0]} · primary. Also open to ${industries.length - 1} other${industries.length - 1 > 1 ? 's' : ''}.`}
                  </p>
                </div>

                {/* Target roles — chips + add */}
                <div>
                  <label className="text-sm font-medium text-[--text-secondary] block mb-3">
                    Target roles{' '}
                    <span className="text-[--text-quaternary] font-normal">— up to 3</span>
                  </label>

                  {targetRoles.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2.5">
                      {targetRoles.map((r, i) => (
                        <span
                          key={r}
                          className="inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-[9px] text-sm bg-[--school-primary]/10 border border-[--school-primary]/30 text-[--school-primary]"
                        >
                          {r}
                          <button
                            type="button"
                            onClick={() => removeRole(i)}
                            aria-label={`Remove ${r}`}
                            className="leading-none text-base opacity-70 hover:opacity-100"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2.5">
                    <input
                      type="text"
                      value={roleInput}
                      onChange={(e) => setRoleInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRole() } }}
                      disabled={targetRoles.length >= 3}
                      placeholder={targetRoles.length >= 3 ? '3 roles added' : 'e.g. Product Manager'}
                      autoComplete="off"
                      className="input-field flex-1"
                    />
                    <button
                      type="button"
                      onClick={addRole}
                      disabled={targetRoles.length >= 3 || !roleInput.trim()}
                      className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Current Stage */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-6">Where are you at?</h2>

              <div className="space-y-3">
                {[
                  { value: 'exploring', label: 'Just exploring', desc: 'Not sure what I want yet' },
                  { value: 'recruiting', label: 'Actively recruiting', desc: 'Applying and interviewing' },
                  { value: 'interviewing', label: 'Preparing for interviews', desc: 'Have some leads, preparing for next steps' },
                  { value: 'referrals', label: 'Looking for referrals', desc: 'Know what I want, need introductions' },
                  { value: 'relationship_building', label: 'Long-term relationship building', desc: 'Building my professional network' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      currentStage === option.value
                        ? 'border-[--school-primary] bg-[--school-primary]/5'
                        : 'border-[--border-primary] hover:border-[--border-secondary]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stage"
                      value={option.value}
                      checked={currentStage === option.value}
                      onChange={(e) => setCurrentStage(e.target.value)}
                      className="mt-0.5 accent-[--school-primary]"
                    />
                    <div>
                      <div className="font-medium text-[--text-primary]">{option.label}</div>
                      <div className="text-sm text-[--text-tertiary]">{option.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Geography */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Location preferences</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Where are you looking to work? Leave blank if you&apos;re open to anywhere.
              </p>

              <div>
                <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                  Target cities or regions (optional)
                </label>
                {preferredLocations.map((loc, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="e.g. New York, San Francisco, East Coast"
                      value={loc}
                      onChange={(e) => updateLocation(i, e.target.value)}
                      className="input-field flex-1"
                    />
                    {preferredLocations.length > 1 && (
                      <button
                        onClick={() => removeLocation(i)}
                        className="btn-ghost text-[--text-quaternary] px-2"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                ))}
                {preferredLocations.length < 3 && (
                  <button onClick={addLocation} className="text-[--school-primary] text-sm hover:underline">
                    + Add another location
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 5: Resume Upload (optional) */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Upload your resume</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Optional — we&apos;ll use it to pre-fill your background and find better alumni matches. It&apos;s never shared with alumni.
              </p>
              <ResumeUpload
                userId={userId}
                onParsed={(data) => {
                  if (data.primary_industry && industries.length === 0) setIndustries([data.primary_industry])
                  if (data.graduation_year && !graduationYear) setGraduationYear(data.graduation_year)
                  if (data.target_roles && data.target_roles.length > 0 && targetRoles.length === 0) {
                    setTargetRoles(data.target_roles.slice(0, 3))
                  }
                }}
              />
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            {step > 1 ? (
              <button onClick={handleBack} className="btn-secondary flex items-center gap-2">
                <ArrowLeft size={16} />
                Back
              </button>
            ) : (
              <div />
            )}

            {step < TOTAL_STEPS ? (
              <button onClick={handleNext} className="btn-primary flex items-center gap-2">
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    Finish Setup
                  </>
                )}
              </button>
            )}
          </div>
          </div>
        </div>
      </div>
    </main>
  )
}
