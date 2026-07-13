'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@scout/shared/types/database'
import Avatar from '@/components/Avatar'
import ResumeUpload from '@/components/ResumeUpload'
import { Save, Check, Camera } from 'lucide-react'

// Complete list of Cornell varsity sports with exact team names
const sports = [
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

// Mirror the onboarding wizard exactly (OnboardingClient.tsx) — the profile is
// where students review and update the same answers they gave at signup.
const INDUSTRIES = [
  'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media',
  'Education', 'Real Estate', 'Non-Profit', 'Government', 'Sports', 'Other',
]

const STAGE_OPTIONS = [
  { value: 'exploring', label: 'Just exploring', desc: 'Not sure what I want yet' },
  { value: 'recruiting', label: 'Actively recruiting', desc: 'Applying and interviewing' },
  { value: 'interviewing', label: 'Preparing for interviews', desc: 'Have some leads, preparing for next steps' },
  { value: 'referrals', label: 'Looking for referrals', desc: 'Know what I want, need introductions' },
  { value: 'relationship_building', label: 'Long-term relationship building', desc: 'Building my professional network' },
]

interface ProfileClientProps {
  profile: Profile | null
  userId: string
  userEmail: string
}

export default function ProfileClient({ profile, userId, userEmail }: ProfileClientProps) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [sport, setSport] = useState(profile?.sport || '')
  const [graduationYear, setGraduationYear] = useState(
    profile?.graduation_year?.toString() || ''
  )
  // industries[0] is the primary, the rest are secondary — same convention as onboarding.
  const [industries, setIndustries] = useState<string[]>(
    [profile?.primary_industry, ...(profile?.secondary_industries || [])].filter(Boolean) as string[]
  )
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.target_roles || [])
  const [roleInput, setRoleInput] = useState('')
  const [currentStage, setCurrentStage] = useState<string>(profile?.current_stage || 'exploring')
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    profile?.preferred_locations && profile.preferred_locations.length > 0
      ? profile.preferred_locations
      : ['']
  )
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')

  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const toggleIndustry = (industry: string) => {
    setIndustries(prev =>
      prev.includes(industry) ? prev.filter(i => i !== industry) : [...prev, industry]
    )
  }

  const addRole = () => {
    const v = roleInput.trim()
    if (!v || targetRoles.length >= 3 || targetRoles.includes(v)) return
    setTargetRoles([...targetRoles, v])
    setRoleInput('')
  }
  const removeRole = (index: number) => setTargetRoles(targetRoles.filter((_, i) => i !== index))

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      setAvatarUrl(urlWithCacheBust)

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId)
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSaved(false)

    try {
      const cleanedLocations = preferredLocations.filter(l => l.trim())
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          sport,
          graduation_year: graduationYear ? parseInt(graduationYear) : null,
          primary_industry: industries[0] || null,
          secondary_industries: industries.slice(1),
          target_roles: targetRoles,
          current_stage: currentStage,
          preferred_locations: cleanedLocations,
          geography_preference: cleanedLocations.length > 0 ? 'city' : 'doesnt_matter',
        })
        .eq('id', userId)

      if (error) throw error

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

      fetch('/api/activity/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'profile_update',
          metadata: { full_name: fullName, sport },
        }),
      }).catch(() => {})
    } catch (error) {
      console.error('Error updating profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 10 }, (_, i) => currentYear + 4 - i)

  return (
    <main className="px-6 md:px-12 py-10 max-w-2xl mx-auto">
      <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">Profile</h1>
      <p className="text-[--text-tertiary] text-sm mb-8">
        Your profile is visible to other athletes in the network.
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Avatar Upload */}
        <div className="flex items-center gap-5">
          <div className="relative group">
            <Avatar
              name={fullName || 'You'}
              sport={sport}
              imageUrl={avatarUrl || null}
              size="xl"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Camera size={20} className="text-white" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="font-medium text-[--text-primary]">{fullName || 'Your Name'}</p>
            <p className="text-sm text-[--text-tertiary]">{userEmail}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-[--school-primary] hover:underline mt-1"
            >
              {avatarUrl ? 'Change photo' : 'Upload photo'}
            </button>
          </div>
        </div>

        {/* About You — sport + graduation year */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-5">
          <h2 className="text-base font-semibold">About You</h2>

          <div>
            <label className="block text-sm text-[--text-tertiary] mb-2">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              className="input-field"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select your sport</option>
                {sports.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Graduation Year</label>
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select year</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* What you're working toward — industries + target roles */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-6">
          <h2 className="text-base font-semibold">What you&apos;re working toward</h2>

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
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border transition-all active:scale-[0.97] ${
                      isPrimary
                        ? 'bg-[--school-primary] border-[--school-primary] text-white'
                        : isSecondary
                          ? 'bg-[--school-primary]/10 border-[--school-primary]/30 text-[--school-primary]'
                          : 'bg-[--bg-tertiary] border-[--border-primary] text-[--text-primary] hover:border-[--border-secondary]'
                    }`}
                  >
                    {ind}
                    {isPrimary && (
                      <span className="text-xs font-bold tracking-wider uppercase opacity-90">Primary</span>
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
                    className="inline-flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl text-sm bg-[--school-primary]/10 border border-[--school-primary]/30 text-[--school-primary]"
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

        {/* Where you're at — career stage */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-4">
          <h2 className="text-base font-semibold">Where you&apos;re at</h2>
          <div className="space-y-3">
            {STAGE_OPTIONS.map(option => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
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

        {/* Location preferences */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <h2 className="text-base font-semibold mb-1">Location preferences</h2>
          <p className="text-[--text-tertiary] text-sm mb-4">
            Where are you looking to work? Leave blank if you&apos;re open to anywhere.
          </p>
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
                  type="button"
                  onClick={() => removeLocation(i)}
                  className="btn-ghost text-[--text-quaternary] px-2"
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          {preferredLocations.length < 3 && (
            <button type="button" onClick={addLocation} className="text-[--school-primary] text-sm hover:underline">
              + Add another location
            </button>
          )}
        </div>

        {/* Resume */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <h2 className="text-base font-semibold mb-1">Résumé</h2>
          <p className="text-xs text-[--text-quaternary] mb-4">
            Never shared with alumni.
          </p>
          <ResumeUpload
            userId={userId}
            existingResumePath={profile?.resume_url || null}
            compact
          />
        </div>

        {/* Info note */}
        {sport && graduationYear && (
          <p className="text-xs text-[--text-quaternary]">
            Your profile will be visible to other Cornell athletes in the Discover page so they can connect with you.
          </p>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
          ) : saved ? (
            <>
              <Check size={16} />
              Saved!
            </>
          ) : (
            <>
              <Save size={16} />
              Save Changes
            </>
          )}
        </button>
      </form>
    </main>
  )
}
