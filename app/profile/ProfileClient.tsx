'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import Avatar from '@/components/Avatar'
import { Save, Check, Camera, Linkedin, MapPin, Briefcase, Building2 } from 'lucide-react'

const sports = [
  'Basketball',
  'Soccer',
  'Football',
  'Lacrosse',
  'Tennis',
  'Swimming',
  'Baseball',
  'Volleyball',
  'Hockey',
  'Track & Field',
  'Rowing',
  'Wrestling',
  'Golf',
  'Field Hockey',
  'Cross Country',
  'Fencing',
  'Gymnastics',
  'Other',
]

const industries = [
  'Finance',
  'Technology',
  'Consulting',
  'Healthcare',
  'Law',
  'Media',
  'Sports',
  'Education',
  'Real Estate',
  'Government',
  'Nonprofit',
  'Other',
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
  const [interests, setInterests] = useState(profile?.interests || '')
  const [company, setCompany] = useState(profile?.company || '')
  const [role, setRole] = useState(profile?.role || '')
  const [industry, setIndustry] = useState(profile?.industry || '')
  const [location, setLocation] = useState(profile?.location || '')
  const [linkedinUrl, setLinkedinUrl] = useState(profile?.linkedin_url || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '')

  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)

    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${userId}.${fileExt}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      // Add cache-busting param
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`
      setAvatarUrl(urlWithCacheBust)

      // Save to profile immediately
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
      // Update profiles table
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          sport,
          graduation_year: graduationYear ? parseInt(graduationYear) : null,
          interests,
          company: company || null,
          role: role || null,
          industry: industry || null,
          location: location || null,
          linkedin_url: linkedinUrl || null,
        })
        .eq('id', userId)

      if (error) throw error

      // Sync to alumni table if sport and graduation year are provided
      if (sport && graduationYear) {
        const alumniData = {
          full_name: fullName,
          email: userEmail,
          sport,
          graduation_year: parseInt(graduationYear),
          company: company || null,
          role: role || null,
          industry: industry || null,
          location: location || null,
          linkedin_url: linkedinUrl || null,
          avatar_url: avatarUrl ? avatarUrl.split('?')[0] : null, // Remove cache bust param
          source: 'opt_in',
          is_public: true,
          is_verified: true,
        }

        // Check if alumni entry already exists for this email
        const { data: existingAlumni } = await supabase
          .from('alumni')
          .select('id')
          .eq('email', userEmail)
          .single()

        if (existingAlumni) {
          await supabase
            .from('alumni')
            .update(alumniData)
            .eq('id', existingAlumni.id)
        } else {
          await supabase
            .from('alumni')
            .insert(alumniData)
        }
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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

        {/* Personal Information */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-5">
          <h2 className="text-base font-semibold">Personal Information</h2>

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

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select your sport</option>
                {sports.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">
                Graduation Year
              </label>
              <select
                value={graduationYear}
                onChange={(e) => setGraduationYear(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select year</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Career Information */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 space-y-5">
          <div>
            <h2 className="text-base font-semibold">Career Information</h2>
            <p className="text-xs text-[--text-quaternary] mt-1">
              This helps other athletes find and connect with you.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">
                <span className="flex items-center gap-1.5"><Building2 size={13} /> Company</span>
              </label>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g., Goldman Sachs"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">
                <span className="flex items-center gap-1.5"><Briefcase size={13} /> Role</span>
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Analyst"
                className="input-field"
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Industry</label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="input-field cursor-pointer"
              >
                <option value="">Select industry</option>
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">
                <span className="flex items-center gap-1.5"><MapPin size={13} /> Location</span>
              </label>
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
            <label className="block text-sm text-[--text-tertiary] mb-2">
              <span className="flex items-center gap-1.5"><Linkedin size={13} /> LinkedIn URL</span>
            </label>
            <input
              type="url"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              placeholder="https://linkedin.com/in/yourprofile"
              className="input-field"
            />
          </div>
        </div>

        {/* Career Interests */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <h2 className="text-base font-semibold mb-2">Career Interests</h2>
          <p className="text-[--text-tertiary] text-sm mb-4">
            Used to personalize your AI-generated outreach messages.
          </p>

          <textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g., investment banking, private equity, product management, software engineering..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        {/* Info note */}
        {sport && graduationYear && (
          <p className="text-xs text-[--text-quaternary] bg-[--bg-tertiary] rounded-lg px-4 py-3">
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
