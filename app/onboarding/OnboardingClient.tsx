'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowRight, ArrowLeft, Check } from 'lucide-react'

const INDUSTRIES = [
  'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media',
  'Education', 'Real Estate', 'Non-Profit', 'Government', 'Sports', 'Other'
]

const TOTAL_STEPS = 6

interface OnboardingClientProps {
  userId: string
  userName: string
}

export default function OnboardingClient({ userId, userName }: OnboardingClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Step 1: Career Targeting
  const [primaryIndustry, setPrimaryIndustry] = useState('')
  const [targetRoles, setTargetRoles] = useState<string[]>([''])
  const [secondaryIndustries, setSecondaryIndustries] = useState<string[]>([])

  // Step 2: Networking Intensity
  const [networkingIntensity, setNetworkingIntensity] = useState<string>('own_pace')

  // Step 3: Current Stage
  const [currentStage, setCurrentStage] = useState<string>('exploring')

  // Step 4: Existing Network
  const [existingNetwork, setExistingNetwork] = useState<string>('none')

  // Step 5: Background
  const [major, setMajor] = useState('')
  const [pastExperience, setPastExperience] = useState('')

  // Step 6: Geography
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

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <img src="/favicon.svg" alt="Scout" className="w-10 h-10" />
          <span className="logo-text text-xl">scout</span>
        </div>

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

        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {/* Step 1: Career Targeting */}
          {step === 1 && (
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
                  <select
                    value={primaryIndustry}
                    onChange={(e) => setPrimaryIndustry(e.target.value)}
                    className="input-field"
                  >
                    <option value="">Select an industry</option>
                    {INDUSTRIES.map(ind => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
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
                        className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
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

          {/* Step 2: Networking Intensity */}
          {step === 2 && (
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
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
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

          {/* Step 3: Current Stage */}
          {step === 3 && (
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
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
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

          {/* Step 4: Existing Network */}
          {step === 4 && (
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
                    className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
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

          {/* Step 5: Background */}
          {step === 5 && (
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

          {/* Step 6: Geography */}
          {step === 6 && (
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
                      className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
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
    </main>
  )
}
