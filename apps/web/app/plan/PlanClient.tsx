'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import MessageModal from '@/components/MessageModal'
import { trackEvent } from '@/lib/track'
import { getStatusConfig } from '@/lib/statusConfig'
import type { Profile, NetworkingPlan, PlanAlumni, UserNetwork, Alumni } from '@scout/shared/types/database'
import Avatar from '@/components/Avatar'
import { cleanField } from '@/lib/cleanField'
import {
  ChevronDown,
  ChevronUp,
  Sparkles,
  X,
  Linkedin,
  Globe,
  Mail,
  Loader2,
  Trash2,
  RefreshCw,
  Building2,
  UserPlus,
  Check,
  Flame,
} from 'lucide-react'

type PlanAlumniWithAlumni = PlanAlumni & { alumni: Alumni }
type PlanWithAlumni = NetworkingPlan & { plan_alumni: PlanAlumniWithAlumni[] }

const INDUSTRIES = [
  'Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media',
  'Education', 'Real Estate', 'Non-Profit', 'Government', 'Sports', 'Other'
]

interface PlanClientProps {
  userId: string
  profile: Profile
  plan: PlanWithAlumni | null
  stats: {
    networkCount: number
    messagesCount: number
    meetingsCount: number
  }
  networkAlumniIds: string[]
}

export default function PlanClient({ userId, profile, plan: initialPlan, stats, networkAlumniIds: initialNetworkIds }: PlanClientProps) {
  const supabase = createClient()

  const [plan, setPlan] = useState<PlanWithAlumni | null>(initialPlan)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingMore, setIsGeneratingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeletingPlan, setIsDeletingPlan] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState(profile.primary_industry || '')
  const [networkIds, setNetworkIds] = useState<Set<string>>(new Set(initialNetworkIds))
  const [addingToNetworkId, setAddingToNetworkId] = useState<string | null>(null)

  // MessageModal state
  const [messageTarget, setMessageTarget] = useState<{ connection: UserNetwork; planAlumniId: string } | null>(null)

  const firstName = profile.full_name?.split(' ')[0] || 'there'

  const activePlanAlumni = (plan?.plan_alumni?.filter(pa => pa.status !== 'not_interested') || []) as PlanAlumniWithAlumni[]

  // Auto-expand first alumni on initial load
  useEffect(() => {
    if (initialPlan && activePlanAlumni.length > 0 && !expandedId) {
      setExpandedId(activePlanAlumni[0].id)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Update industry if changed
      if (selectedIndustry !== profile.primary_industry) {
        await supabase
          .from('profiles')
          .update({ primary_industry: selectedIndustry || null })
          .eq('id', userId)
      }

      const response = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchSize: 10 }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate plan')
      }

      const data = await response.json()
      setPlan(data.plan)
      trackEvent('plan_generated', { industry: selectedIndustry })

      // Auto-expand first alumni
      const firstAlumni = data.plan?.plan_alumni?.[0]
      if (firstAlumni) setExpandedId(firstAlumni.id)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeletePlan = async () => {
    if (!plan) return
    setIsDeletingPlan(true)

    try {
      const response = await fetch('/api/plan/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id }),
      })

      if (!response.ok) throw new Error('Failed to delete plan')

      setPlan(null)
      setExpandedId(null)
      setShowDeleteConfirm(false)
      trackEvent('plan_deleted')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsDeletingPlan(false)
    }
  }

  const handleGenerateMore = async () => {
    if (!plan) return
    setIsGeneratingMore(true)
    setError(null)

    try {
      const response = await fetch('/api/plan/generate-more', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId: plan.id, count: 5 }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate more')
      }

      const data = await response.json()
      if (data.planAlumni) {
        setPlan(prev => {
          if (!prev) return null
          return {
            ...prev,
            plan_alumni: [...prev.plan_alumni, ...data.planAlumni] as PlanAlumniWithAlumni[],
          }
        })
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGeneratingMore(false)
    }
  }

  const handleNotInterested = async (planAlumniId: string) => {
    const { error } = await supabase
      .from('plan_alumni')
      .update({ status: 'not_interested' })
      .eq('id', planAlumniId)

    if (!error) {
      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          plan_alumni: prev.plan_alumni.map(pa =>
            pa.id === planAlumniId ? { ...pa, status: 'not_interested' as const } : pa
          ) as PlanAlumniWithAlumni[],
        }
      })
      if (expandedId === planAlumniId) setExpandedId(null)
    }
  }

  const handleAddToNetwork = async (alumniId: string) => {
    setAddingToNetworkId(alumniId)
    try {
      const { error } = await supabase
        .from('user_networks')
        .insert({ user_id: userId, alumni_id: alumniId })

      if (error) throw error
      setNetworkIds(prev => new Set([...prev, alumniId]))
      trackEvent('alumni_added_to_network', { alumni_id: alumniId, source: 'plan' })
    } catch (err) {
      console.error('Error adding to network:', err)
    } finally {
      setAddingToNetworkId(null)
    }
  }

  const handleWriteMessage = (planAlumni: PlanAlumniWithAlumni) => {
    const connection: UserNetwork = {
      id: planAlumni.id,
      user_id: userId,
      alumni_id: planAlumni.alumni_id,
      contacted: false,
      contacted_at: null,
      meeting_at: null,
      notes: null,
      created_at: planAlumni.created_at,
      alumni: planAlumni.alumni,
    }
    setMessageTarget({ connection, planAlumniId: planAlumni.id })
  }

  const handleSendMessage = async (connectionId: string, message: string, sentVia: 'linkedin' | 'email' | 'copied' | 'marked') => {
    await supabase.from('messages').insert({
      user_id: userId,
      alumni_id: messageTarget?.connection.alumni_id,
      message_content: message,
      sent_via: sentVia === 'marked' ? 'email' : sentVia,
    })

    if (messageTarget?.planAlumniId) {
      await supabase
        .from('plan_alumni')
        .update({ status: 'contacted' })
        .eq('id', messageTarget.planAlumniId)

      setPlan(prev => {
        if (!prev) return null
        return {
          ...prev,
          plan_alumni: prev.plan_alumni.map(pa =>
            pa.id === messageTarget.planAlumniId ? { ...pa, status: 'contacted' as const } : pa
          ) as PlanAlumniWithAlumni[],
        }
      })
    }

    trackEvent('message_sent', { sent_via: sentVia, alumni_id: messageTarget?.connection.alumni_id })
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    trackEvent('alumni_expanded', { plan_alumni_id: id })
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      {/* Header + inline stats */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[--text-primary]">
            Hey, {firstName}
          </h1>
          <p className="text-[--text-quaternary] text-sm mt-0.5">Your networking plan</p>
        </div>
        {/* Compact stat strip */}
        <div className="flex items-center gap-5 text-right">
          <div>
            <div className="text-lg font-bold text-[--text-primary] leading-none">{stats.networkCount}</div>
            <div className="text-xs text-[--text-quaternary] mt-0.5">connections</div>
          </div>
          <div className="w-px h-8 bg-[--border-primary]" />
          <div>
            <div className="text-lg font-bold text-[--text-primary] leading-none">{stats.messagesCount}</div>
            <div className="text-xs text-[--text-quaternary] mt-0.5">messages</div>
          </div>
          <div className="w-px h-8 bg-[--border-primary]" />
          <div>
            <div className="text-lg font-bold text-[--text-primary] leading-none">{stats.meetingsCount}</div>
            <div className="text-xs text-[--text-quaternary] mt-0.5">meetings</div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-sm mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* No Plan State */}
      {!plan && (
        <div className="py-16 text-center mb-8">
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Build your networking plan</h2>
          <p className="text-sm text-[--text-secondary] mb-8 max-w-sm mx-auto leading-relaxed">
            We'll match you with the best alumni connections and generate personalized talking points.
          </p>

          <div className="max-w-xs mx-auto mb-6">
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="input-field text-center"
            >
              <option value="">All Industries</option>
              {INDUSTRIES.map(ind => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5 text-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={14} />
                Generate Plan
              </>
            )}
          </button>
        </div>
      )}

      {/* Plan Banner */}
      {plan && (
        <div className="relative flex items-center justify-between px-4 py-3 bg-[--bg-secondary] border border-[--border-primary] rounded-xl mb-5">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[--school-primary]" />
            <span className="text-sm font-medium text-[--text-primary]">{plan.title}</span>
            <span className="text-xs text-[--text-quaternary]">{activePlanAlumni.length} alumni</span>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-xs text-[--text-quaternary] hover:text-red-400 transition-colors flex items-center gap-1"
            title="Reset plan"
          >
            <Trash2 size={13} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {/* Delete confirmation — inline */}
          {showDeleteConfirm && (
            <div className="absolute top-full mt-2 right-0 bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 shadow-lg z-10 min-w-[280px]">
              <p className="text-sm text-[--text-secondary] mb-3">
                Delete this plan and start fresh?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeletePlan}
                  disabled={isDeletingPlan}
                  className="px-3 py-1.5 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                >
                  {isDeletingPlan ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  Delete
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} className="btn-ghost text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alumni List */}
      {plan && activePlanAlumni.length > 0 && (
        <div className="space-y-3 mb-8">
          {activePlanAlumni.map((pa) => {
            const alumni = pa.alumni
            if (!alumni) return null
            const isExpanded = expandedId === pa.id
            const isInNetwork = networkIds.has(alumni.id)
            const isSameSport = profile.sport && alumni.sport && alumni.sport.toLowerCase() === profile.sport.toLowerCase()
            const contactedConfig = getStatusConfig('met') // reuse emerald for "Contacted"

            return (
              <div
                key={pa.id}
                className={`rounded-xl overflow-hidden transition-colors border ${
                  isSameSport
                    ? 'bg-[--bg-secondary] border-[--school-primary]/30'
                    : 'bg-[--bg-secondary] border-[--border-primary] hover:border-[--border-secondary]'
                }`}
              >
                {/* Collapsed header */}
                <button
                  onClick={() => toggleExpand(pa.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-[--bg-tertiary]/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar
                      name={alumni.full_name || '?'}
                      sport={alumni.sport || undefined}
                      imageUrl={alumni.avatar_url || alumni.photo_url}
                      size="md"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[--text-primary] truncate">
                          {alumni.full_name}
                        </span>
                        {pa.status === 'contacted' && (
                          <span className="text-xs text-emerald-400 flex-shrink-0">· Contacted</span>
                        )}
                        {isInNetwork && (
                          <span className="text-xs text-[--text-quaternary] flex-shrink-0">· Saved</span>
                        )}
                      </div>
                      <div className="text-sm text-[--text-tertiary] truncate">
                        {(() => {
                          const role = cleanField(alumni.role)
                          const company = cleanField(alumni.company)
                          if (role && company) return `${role} @ ${company}`
                          return role || company || 'Alumni'
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Sport badge */}
                    {isSameSport ? (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-[--school-primary] font-medium">
                        <Flame size={10} />
                        Same sport
                      </span>
                    ) : (
                      <span className="text-xs text-[--text-quaternary] hidden sm:inline">
                        {alumni.sport} &apos;{String(alumni.graduation_year).slice(-2)}
                      </span>
                    )}
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[--border-primary]">
                    {/* Career summary */}
                    {pa.ai_career_summary && (
                      <div className="mt-4 mb-4">
                        <h4 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-1.5">About</h4>
                        <p className="text-sm text-[--text-secondary] leading-relaxed">
                          {pa.ai_career_summary}
                        </p>
                      </div>
                    )}

                    {/* Company bio */}
                    {pa.ai_company_bio && alumni.company && (
                      <div className="mb-4 pl-3 border-l border-[--border-secondary]">
                        <h4 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                          <Building2 size={11} />
                          {cleanField(alumni.company) || alumni.company}
                        </h4>
                        <p className="text-sm text-[--text-secondary] leading-relaxed">
                          {pa.ai_company_bio}
                        </p>
                      </div>
                    )}

                    {/* Talking points */}
                    {pa.ai_talking_points && pa.ai_talking_points.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-[--text-quaternary] uppercase tracking-wide mb-2">Talking Points</h4>
                        <ul className="space-y-1.5">
                          {(pa.ai_talking_points as string[]).map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[--text-secondary]">
                              <span className="text-[--school-primary] mt-1.5 flex-shrink-0">•</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-[--text-quaternary] mb-4">
                      {alumni.industry && <span>{alumni.industry}</span>}
                      {alumni.location && <span>{alumni.location}</span>}
                      <span>{alumni.sport} &apos;{alumni.graduation_year}</span>
                    </div>

                    {/* Action buttons — primary action first */}
                    <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[--border-primary]">
                      {/* PRIMARY: Write Message */}
                      <button
                        onClick={() => handleWriteMessage(pa)}
                        className="btn-primary text-sm flex items-center gap-1.5"
                      >
                        <Mail size={14} />
                        Write Message
                      </button>

                      {/* SECONDARY: Add to Network */}
                      {isInNetwork ? (
                        <span className="btn-success text-sm flex items-center gap-1.5 cursor-default">
                          <Check size={14} />
                          In Network
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToNetwork(alumni.id)}
                          disabled={addingToNetworkId === alumni.id}
                          className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                          {addingToNetworkId === alumni.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <UserPlus size={14} />
                          )}
                          Save
                        </button>
                      )}

                      {/* Utility: LinkedIn */}
                      {alumni.linkedin_url && (
                        <a
                          href={alumni.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost text-sm flex items-center gap-1.5 hover:text-[#0077b5]"
                        >
                          <Linkedin size={14} />
                          <span className="hidden sm:inline">LinkedIn</span>
                        </a>
                      )}

                      {/* Utility: Company research */}
                      {alumni.company && (
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(cleanField(alumni.company) || alumni.company)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-ghost text-sm flex items-center gap-1.5"
                        >
                          <Globe size={14} />
                          <span className="hidden sm:inline">Research</span>
                        </a>
                      )}

                      {/* Destructive: far right */}
                      <button
                        onClick={() => handleNotInterested(pa.id)}
                        className="btn-ghost text-sm flex items-center gap-1 text-[--text-quaternary] hover:text-red-400 ml-auto"
                      >
                        <X size={13} />
                        Skip
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Generate More */}
      {plan && (
        <div className="text-center mb-8">
          <button
            onClick={handleGenerateMore}
            disabled={isGeneratingMore}
            className="btn-secondary inline-flex items-center gap-2 px-6 py-2.5 text-sm"
          >
            {isGeneratingMore ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Finding more...
              </>
            ) : (
              <>
                <RefreshCw size={15} />
                Load more recommendations
              </>
            )}
          </button>
        </div>
      )}

      {/* Message Modal */}
      {messageTarget && (
        <MessageModal
          connection={messageTarget.connection}
          userSport={profile.sport || ''}
          onClose={() => setMessageTarget(null)}
          onSend={handleSendMessage}
        />
      )}
    </main>
  )
}
