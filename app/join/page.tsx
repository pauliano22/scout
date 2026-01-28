'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import {
  UserPlus,
  Check,
  ArrowRight,
  Linkedin,
  Building2,
  Briefcase,
  MapPin,
} from 'lucide-react'

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

export default function JoinPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [sport, setSport] = useState('')
  const [graduationYear, setGraduationYear] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [industry, setIndustry] = useState('')
  const [location, setLocation] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [error, setError] = useState('')

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 30 }, (_, i) => currentYear + 4 - i)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!fullName.trim() || !sport || !graduationYear) {
      setError('Please fill in your name, sport, and graduation year.')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/alumni/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          email,
          sport,
          graduation_year: graduationYear,
          company,
          role,
          industry,
          location,
          linkedin_url: linkedinUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit')
      }

      setIsSubmitted(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-10">
            <img src="/favicon.svg" alt="Scout" className="w-10 h-10" />
            <span className="logo-text text-xl">scout</span>
          </Link>

          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Check size={28} className="text-emerald-500" />
            </div>
            <h1 className="text-xl font-semibold mb-2">You're in!</h1>
            <p className="text-[--text-tertiary] text-sm mb-6">
              Thanks for joining the Cornell athlete network. Other athletes can now find and connect with you.
            </p>
            <div className="space-y-3">
              <Link href="/signup" className="btn-primary flex items-center justify-center gap-2 w-full">
                Create an Account
                <ArrowRight size={16} />
              </Link>
              <Link href="/" className="btn-secondary flex items-center justify-center gap-2 w-full">
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4">
      <div className="w-full max-w-lg mx-auto">
        {/* Logo */}
        <Link href="/" className="flex items-center justify-center gap-2 mb-10">
          <img src="/favicon.svg" alt="Scout" className="w-10 h-10" />
          <span className="logo-text text-xl">scout</span>
        </Link>

        {/* Form */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[--school-primary]/10 rounded-xl flex items-center justify-center">
              <UserPlus size={20} className="text-[--school-primary]" />
            </div>
            <h1 className="text-xl font-semibold">Join the Network</h1>
          </div>
          <p className="text-[--text-tertiary] text-sm mb-8">
            Add your information so current Cornell athletes can find and connect with you. No account needed.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Required Fields */}
            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-sm text-[--text-tertiary] mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="input-field"
              />
              <p className="text-xs text-[--text-quaternary] mt-1">Optional. Used to avoid duplicate entries.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-[--text-tertiary] mb-2">
                  Sport <span className="text-red-400">*</span>
                </label>
                <select
                  value={sport}
                  onChange={(e) => setSport(e.target.value)}
                  required
                  className="input-field cursor-pointer"
                >
                  <option value="">Select sport</option>
                  {sports.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-[--text-tertiary] mb-2">
                  Graduation Year <span className="text-red-400">*</span>
                </label>
                <select
                  value={graduationYear}
                  onChange={(e) => setGraduationYear(e.target.value)}
                  required
                  className="input-field cursor-pointer"
                >
                  <option value="">Select year</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Career Fields */}
            <div className="border-t border-[--border-primary] pt-5 mt-5">
              <p className="text-xs text-[--text-quaternary] uppercase tracking-wide mb-4">Career Info (Optional)</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
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

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm text-[--text-tertiary] mb-2">Industry</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="input-field cursor-pointer"
                  >
                    <option value="">Select industry</option>
                    {industries.map((i) => (
                      <option key={i} value={i}>{i}</option>
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Join the Network
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-[--text-tertiary] text-sm">
            Want full access?{' '}
            <Link href="/signup" className="text-[--school-primary] hover:underline">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
