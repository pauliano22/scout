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

const TOTAL_STEPS = 8

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

  // Step 2: Career Targeting
  const [primaryIndustry, setPrimaryIndustry] = useState(prefill?.primaryIndustry || '')
  const [targetRoles, setTargetRoles] = useState<string[]>([''])
  const [secondaryIndustries, setSecondaryIndustries] = useState<string[]>([])

  // Step 3: Networking Intensity
  const [networkingIntensity, setNetworkingIntensity] = useState<string>('own_pace')

  // Step 4: Current Stage
  const [currentStage, setCurrentStage] = useState<string>('exploring')

  // Step 5: Existing Network
  const [existingNetwork, setExistingNetwork] = useState<string>('none')

  // Step 6: Background
  const [major, setMajor] = useState('')
  const [pastExperience, setPastExperience] = useState('')

  // Step 7: Geography
  const [preferredLocations, setPreferredLocations] = useState<string[]>([''])
  const [geographyPreference, setGeographyPreference] = useState<string>('doesnt_matter')

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
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          sport: sport || null,
          graduation_year: graduationYear || null,
          primary_industry: primaryIndustry || null,
          target_roles: targetRoles.filter(r => r.trim()),
          secondary_industries: secondaryIndustries,
          networking_intensity: networkingIntensity,
          current_stage: currentStage,
          existing_network: existingNetwork,
          major: major || null,
          past_experience: pastExperience || null,
          preferred_locations: preferredLocations.filter(l => l.trim()),
          geography_preference: geographyPreference,
          onboarding_completed: true,
        })
        .eq('id', userId)

      if (updateError) throw updateError

      trackEvent('onboarding_completed', {
        sport,
        primary_industry: primaryIndustry,
        current_stage: currentStage,
        networking_intensity: networkingIntensity,
      })

      router.push('/plan')
    } catch (err: any) {
      setError(err.message || 'Failed to save. Please try again.')
      setIsSubmitting(false)
    }
  }

  const addTargetRole = () => {
    if (targetRoles.length < 3) setTargetRoles([...targetRoles, ''])
  }

  const updateTargetRole = (index: number, value: string) => {
    const updated = [...targetRoles]
    updated[index] = value
    setTargetRoles(updated)
  }

  const removeTargetRole = (index: number) => {
    if (targetRoles.length > 1) {
      setTargetRoles(targetRoles.filter((_, i) => i !== index))
    }
  }

  // Pre-select the likely field from their major — one tap to confirm.
  const suggestedIndustry = (() => {
    const m = (major || '').toLowerCase()
    if (!m) return null
    if (/(econ|financ|business|account)/.test(m)) return 'Finance'
    if (/(computer|software|info|engineer|math|data)/.test(m)) return 'Technology'
    if (/(bio|health|pre.?med|nutrition|kine)/.test(m)) return 'Healthcare'
    if (/(gov|policy|polit|law|legal)/.test(m)) return 'Law'
    if (/(comm|media|journal|film|market)/.test(m)) return 'Media'
    return null
  })()

  // The moment a field is chosen, start matching in the background — picks are
  // computed and cached BEFORE the student finishes the remaining steps.
  const selectPrimaryIndustry = (industry: string) => {
    setPrimaryIndustry(industry)
    fetch('/api/picks/warm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: industry }),
    }).catch(() => {})
  }

  const toggleSecondaryIndustry = (industry: string) => {
    setSecondaryIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    )
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
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Cornell Athletes Only</div>
                <div className="text-xs text-[--text-tertiary]">Scout is exclusively for current and former Cornell student-athletes. Access is verified through your Cornell email.</div>
              </div>

              <div className="pb-5 border-b border-[--accent-warm-border]">
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Your Data is Secure</div>
                <div className="text-xs text-[--text-tertiary]">Your personal information is never sold to third parties. Only verified Cornell athletes can access the alumni directory.</div>
              </div>

              <div className="pb-5 border-b border-[--accent-warm-border]">
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Built for Networking</div>
                <div className="text-xs text-[--text-tertiary]">Scout surfaces the most relevant alumni connections based on your sport, industry interests, and career goals.</div>
              </div>

              <div>
                <div className="font-medium text-sm text-[--text-primary] mb-0.5">Quick Setup (5 min)</div>
                <div className="text-xs text-[--text-tertiary]">We&apos;ll ask a few questions about your sport, career interests, and goals to personalize your experience.</div>
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
          {/* Cornell 'C' watermark */}
          <div
            className="absolute -bottom-4 -right-4 text-[--accent-warm-muted] select-none pointer-events-none text-[80px] font-bold leading-none opacity-20"
            aria-hidden="true"
          />

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
                  <select
                    value={sport}
                    onChange={(e) => setSport(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select your sport</option>
                    {SPORTS_LIST.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
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
              <h2 className="text-xl font-semibold mb-1">Career Targeting</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                What industries and roles are you interested in?
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Primary Industry
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.map(ind => (
                      <button
                        key={ind}
                        type="button"
                        onClick={() => selectPrimaryIndustry(ind)}
                        className={primaryIndustry === ind ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
                      >
                        {ind}
                        {primaryIndustry !== ind && suggestedIndustry === ind ? ' · suggested' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Target Roles (up to 3)
                  </label>
                  {targetRoles.map((role, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        placeholder={`e.g. ${['Product Manager', 'Software Engineer', 'Analyst'][i] || 'Role'}`}
                        value={role}
                        onChange={(e) => updateTargetRole(i, e.target.value)}
                        className="input-field flex-1"
                      />
                      {targetRoles.length > 1 && (
                        <button
                          onClick={() => removeTargetRole(i)}
                          className="btn-ghost text-[--text-quaternary] px-2"
                        >
                          &times;
                        </button>
                      )}
                    </div>
                  ))}
                  {targetRoles.length < 3 && (
                    <button onClick={addTargetRole} className="text-[--school-primary] text-sm hover:underline">
                      + Add another role
                    </button>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Other industries of interest (optional)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INDUSTRIES.filter(i => i !== primaryIndustry).map(ind => (
                      <button
                        key={ind}
                        onClick={() => toggleSecondaryIndustry(ind)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          secondaryIndustries.includes(ind)
                            ? 'bg-[--school-primary] text-white'
                            : 'bg-[--bg-tertiary] text-[--text-secondary] hover:bg-[--bg-primary]'
                        }`}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Networking Intensity */}
          {step === 3 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Networking Intensity</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                How many alumni would you like to connect with per week?
              </p>

              <div className="space-y-3">
                {[
                  { value: '20', label: '20 per week', desc: 'Aggressive — casting a wide net' },
                  { value: '10', label: '10 per week', desc: 'Steady — consistent outreach' },
                  { value: '5', label: '5 per week', desc: 'Moderate — quality over quantity' },
                  { value: 'own_pace', label: 'At my own pace', desc: 'No pressure — reach out when ready' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      networkingIntensity === option.value
                        ? 'border-[--school-primary] bg-[--school-primary]/5'
                        : 'border-[--border-primary] hover:border-[--border-secondary]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="intensity"
                      value={option.value}
                      checked={networkingIntensity === option.value}
                      onChange={(e) => setNetworkingIntensity(e.target.value)}
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

          {/* Step 4: Current Stage */}
          {step === 4 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Where are you at?</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                This helps us tailor your networking recommendations.
              </p>

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

          {/* Step 5: Existing Network */}
          {step === 5 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Your existing network</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Have you already been networking with alumni?
              </p>

              <div className="space-y-3">
                {[
                  { value: 'none', label: 'Not yet', desc: "I haven't reached out to anyone" },
                  { value: 'few_conversations', label: 'A few conversations', desc: "I've talked to a couple people" },
                  { value: 'ongoing', label: 'Ongoing relationships', desc: 'I have active connections already' },
                ].map(option => (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      existingNetwork === option.value
                        ? 'border-[--school-primary] bg-[--school-primary]/5'
                        : 'border-[--border-primary] hover:border-[--border-secondary]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="network"
                      value={option.value}
                      checked={existingNetwork === option.value}
                      onChange={(e) => setExistingNetwork(e.target.value)}
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

          {/* Step 6: Background */}
          {step === 6 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Your background</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Help us find the best alumni matches for you.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Major
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Economics, Computer Science"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                    Past internships or roles (optional)
                  </label>
                  <textarea
                    placeholder="e.g. Summer analyst at JP Morgan, research assistant in CS department"
                    value={pastExperience}
                    onChange={(e) => setPastExperience(e.target.value)}
                    rows={4}
                    className="input-field resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 7: Geography */}
          {step === 7 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Location preferences</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Where are you looking to work?
              </p>

              <div className="space-y-4">
                <div className="space-y-3">
                  {[
                    { value: 'city', label: 'Specific city', desc: 'I have target cities in mind' },
                    { value: 'region', label: 'Region', desc: 'A general area (e.g. East Coast, Midwest)' },
                    { value: 'doesnt_matter', label: "Doesn't matter", desc: "I'm open to anywhere" },
                  ].map(option => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                        geographyPreference === option.value
                          ? 'border-[--school-primary] bg-[--school-primary]/5'
                          : 'border-[--border-primary] hover:border-[--border-secondary]'
                      }`}
                    >
                      <input
                        type="radio"
                        name="geography"
                        value={option.value}
                        checked={geographyPreference === option.value}
                        onChange={(e) => setGeographyPreference(e.target.value)}
                        className="mt-0.5 accent-[--school-primary]"
                      />
                      <div>
                        <div className="font-medium text-[--text-primary]">{option.label}</div>
                        <div className="text-sm text-[--text-tertiary]">{option.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>

                {geographyPreference !== 'doesnt_matter' && (
                  <div>
                    <label className="text-sm font-medium text-[--text-secondary] mb-1.5 block">
                      {geographyPreference === 'city' ? 'Target cities' : 'Target regions'}
                    </label>
                    {preferredLocations.map((loc, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          placeholder={geographyPreference === 'city' ? 'e.g. New York, San Francisco' : 'e.g. Northeast, West Coast'}
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
                )}
              </div>
            </div>
          )}

          {/* Step 8: Resume Upload (optional) */}
          {step === 8 && (
            <div>
              <h2 className="text-xl font-semibold mb-1">Upload your resume</h2>
              <p className="text-[--text-tertiary] text-sm mb-6">
                Optional — we&apos;ll use it to pre-fill your background and find better alumni matches. It&apos;s never shared with alumni.
              </p>
              <ResumeUpload
                userId={userId}
                onParsed={(data) => {
                  if (data.major && !major) setMajor(data.major)
                  if (data.past_experience && !pastExperience) setPastExperience(data.past_experience)
                  if (data.primary_industry && !primaryIndustry) setPrimaryIndustry(data.primary_industry)
                  if (data.graduation_year && !graduationYear) setGraduationYear(data.graduation_year)
                  if (data.target_roles && data.target_roles.length > 0 && targetRoles.every(r => !r.trim())) {
                    setTargetRoles(data.target_roles.slice(0, 3))
                  }
                }}
              />
              <p className="text-xs text-[--text-quaternary] mt-4 text-center">
                You can also upload this later from your profile page.
              </p>
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
              <div className="flex items-center gap-3">
                {/* On the resume step, show a skip option */}
                {step === TOTAL_STEPS - 1 && (
                  <button onClick={handleNext} className="text-sm text-[--text-tertiary] hover:text-[--text-secondary]">
                    Skip
                  </button>
                )}
                <button onClick={handleNext} className="btn-primary flex items-center gap-2">
                  {step === TOTAL_STEPS - 1 ? 'Next' : 'Next'}
                  <ArrowRight size={16} />
                </button>
              </div>
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
