'use client'

import { useEffect, useState } from 'react'

const SPORTS = [
  'Football', 'Basketball - Men', 'Basketball - Women',
  'Hockey - Men', 'Hockey - Women', 'Lacrosse - Men', 'Lacrosse - Women',
  'Soccer - Men', 'Soccer - Women', 'Baseball', 'Softball',
  'Wrestling', 'Track & Field', 'Cross Country', 'Tennis - Men', 'Tennis - Women',
  'Golf - Men', 'Golf - Women', 'Swimming & Diving - Men', 'Swimming & Diving - Women',
  'Volleyball - Women', 'Gymnastics', 'Polo', 'Fencing', 'Squash',
  'Rowing - Men', 'Rowing - Women', 'Sailing', 'Field Hockey',
]

const FREQUENCIES = [
  { value: 'weekly' as const, label: 'Weekly', desc: 'Every Sunday' },
  { value: 'monthly' as const, label: 'Monthly', desc: 'First of the month' },
  { value: 'never' as const, label: 'Never', desc: 'Opt out of digests' },
]

export default function DigestSettingsPage() {
  const [selectedSports, setSelectedSports] = useState<string[]>([])
  const [frequency, setFrequency] = useState<string>('weekly')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSettings()
  }, [])

  async function fetchSettings() {
    setLoading(true)
    try {
      const res = await fetch('/api/digest/preferences')
      if (res.ok) {
        const data = await res.json()
        setSelectedSports(data.subscribed_sports || [])
        setFrequency(data.digest_frequency || 'weekly')
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  function toggleSport(sport: string) {
    setSelectedSports(prev =>
      prev.includes(sport) ? prev.filter(s => s !== sport) : [...prev, sport]
    )
  }

  async function save() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/digest/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscribed_sports: selectedSports, digest_frequency: frequency }),
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError('Failed to save preferences')
      }
    } catch {
      setError('Network error')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B31B1B]" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Digest Preferences</h1>
      <p className="text-gray-500 mb-8">Choose which sports you want to follow and how often you want to receive career updates from their alumni.</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Frequency selector */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Digest Frequency</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {FREQUENCIES.map(f => (
            <button
              key={f.value}
              onClick={() => setFrequency(f.value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                frequency === f.value
                  ? 'border-[#B31B1B] bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <p className="font-medium text-gray-900">{f.label}</p>
              <p className="text-sm text-gray-500 mt-1">{f.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Sport selector */}
      <div className="mb-8">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Subscribed Sports</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SPORTS.map(sport => (
            <label
              key={sport}
              className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                selectedSports.includes(sport)
                  ? 'border-[#B31B1B] bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedSports.includes(sport)}
                onChange={() => toggleSport(sport)}
                className="rounded text-[#B31B1B] focus:ring-[#B31B1B]"
              />
              <span className="text-sm text-gray-700">{sport}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 bg-[#B31B1B] text-white rounded-lg hover:bg-[#8a1515] disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>
        {saved && (
          <span className="text-sm text-emerald-600 font-medium">✓ Saved</span>
        )}
      </div>
    </div>
  )
}
