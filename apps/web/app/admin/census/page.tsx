'use client'

import { useEffect, useState } from 'react'

interface CensusReport {
  id: string
  sport: string
  graduation_year: number
  total_rostered: number
  total_registered: number
  coverage_pct: number
  gap_category: 'critical' | 'growing' | 'healthy'
  generated_at: string
}

export default function CensusPage() {
  const [reports, setReports] = useState<CensusReport[]>([])
  const [summary, setSummary] = useState({ total: 0, critical: 0, growing: 0, healthy: 0, avgCoverage: 0 })
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchReports()
  }, [])

  async function fetchReports() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/census')
      const data = await res.json()
      setReports(data.reports || [])
      setSummary(data.summary || { total: 0, critical: 0, growing: 0, healthy: 0, avgCoverage: 0 })
    } catch {
      setError('Failed to load census data')
    }
    setLoading(false)
  }

  async function runAnalysis() {
    setRunning(true)
    setError('')
    try {
      const res = await fetch('/api/cron/census-analysis')
      if (!res.ok) throw new Error('Analysis failed')
      const data = await res.json()
      alert(`Analysis complete: ${data.total} cohorts (${data.critical} critical, ${data.growing} growing, ${data.healthy} healthy)`)
      fetchReports()
    } catch {
      setError('Failed to run analysis')
    }
    setRunning(false)
  }

  const gapColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    growing: 'bg-amber-100 text-amber-800 border-amber-200',
    healthy: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B31B1B]" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alumni Census Gap Analysis</h1>
          <p className="text-gray-500 mt-1">Coverage per sport and graduation year cohort</p>
        </div>
        <button
          onClick={runAnalysis}
          disabled={running}
          className="px-4 py-2 bg-[#B31B1B] text-white rounded-lg hover:bg-[#8a1515] disabled:opacity-50 transition-colors"
        >
          {running ? 'Running...' : 'Run Analysis'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Total Cohorts</p>
          <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-sm text-gray-500">Avg Coverage</p>
          <p className="text-2xl font-bold text-gray-900">{summary.avgCoverage}%</p>
        </div>
        <div className="bg-white rounded-xl border p-4 border-red-200">
          <p className="text-sm text-red-600">Critical</p>
          <p className="text-2xl font-bold text-red-700">{summary.critical}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 border-amber-200">
          <p className="text-sm text-amber-600">Growing</p>
          <p className="text-2xl font-bold text-amber-700">{summary.growing}</p>
        </div>
        <div className="bg-white rounded-xl border p-4 border-emerald-200">
          <p className="text-sm text-emerald-600">Healthy</p>
          <p className="text-2xl font-bold text-emerald-700">{summary.healthy}</p>
        </div>
      </div>

      {/* Report table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-3 text-sm font-medium text-gray-500">Sport</th>
              <th className="text-left p-3 text-sm font-medium text-gray-500">Year</th>
              <th className="text-right p-3 text-sm font-medium text-gray-500">Rostered</th>
              <th className="text-right p-3 text-sm font-medium text-gray-500">Registered</th>
              <th className="text-right p-3 text-sm font-medium text-gray-500">Coverage</th>
              <th className="text-center p-3 text-sm font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="p-3 font-medium text-gray-900">{r.sport}</td>
                <td className="p-3 text-gray-700">{r.graduation_year}</td>
                <td className="p-3 text-right text-gray-700">{r.total_rostered}</td>
                <td className="p-3 text-right text-gray-700">{r.total_registered}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          r.gap_category === 'critical' ? 'bg-red-500' :
                          r.gap_category === 'growing' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(r.coverage_pct, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{r.coverage_pct}%</span>
                  </div>
                </td>
                <td className="p-3 text-center">
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full border ${gapColors[r.gap_category]}`}>
                    {r.gap_category}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
