'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Profile } from '@/types/database'
import { Save, Check } from 'lucide-react'

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

interface ProfileClientProps {
  profile: Profile | null
  userId: string
}

export default function ProfileClient({ profile, userId }: ProfileClientProps) {
  const supabase = createClient()
  
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [sport, setSport] = useState(profile?.sport || '')
  const [graduationYear, setGraduationYear] = useState(
    profile?.graduation_year?.toString() || ''
  )
  const [interests, setInterests] = useState(profile?.interests || '')
  const [isLoading, setIsLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setSaved(false)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          sport,
          graduation_year: graduationYear ? parseInt(graduationYear) : null,
          interests,
        })
        .eq('id', userId)

      if (error) throw error

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
      <h1 className="text-4xl font-bold font-display mb-3">Profile</h1>
      <p className="text-white/50 mb-10">
        Update your information to personalize your outreach messages
      </p>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold mb-4">Personal Information</h2>

          <div>
            <label className="block text-sm text-white/60 mb-2">Full Name</label>
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
              <label className="block text-sm text-white/60 mb-2">Sport</label>
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
              <label className="block text-sm text-white/60 mb-2">
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

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Career Interests</h2>
          <p className="text-white/50 text-sm mb-4">
            These will be used to personalize your AI-generated outreach messages.
          </p>

          <textarea
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
            placeholder="e.g., investment banking, private equity, product management, software engineering..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary flex items-center justify-center gap-2 w-full md:w-auto"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : saved ? (
            <>
              <Check size={18} />
              Saved!
            </>
          ) : (
            <>
              <Save size={18} />
              Save Changes
            </>
          )}
        </button>
      </form>
    </main>
  )
}
