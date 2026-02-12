'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import MessageModal from '@/components/MessageModal'
import { trackEvent } from '@/lib/track'
import type { Profile, NetworkingPlan, PlanAlumni, PlanCustomContact, UserNetwork, Alumni } from '@/types/database'
import {
  ChevronDown,
  ChevronUp,
  Users,
  MessageSquare,
  Calendar,
  Sparkles,
  Plus,
  X,
  Linkedin,
  Globe,
  ThumbsDown,
  Mail,
  Loader2,
  Trash2,
  RefreshCw,
  Building2,
  UserPlus,
  Check,
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
  customContacts: PlanCustomContact[]
  stats: {
    networkCount: number
    messagesCount: number
    meetingsCount: number
  }
  networkAlumniIds: string[]
}

export default function PlanClient({ userId, profile, plan: initialPlan, customContacts: initialCustomContacts, stats, networkAlumniIds: initialNetworkIds }: PlanClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [plan, setPlan] = useState<PlanWithAlumni | null>(initialPlan)
  const [customContacts, setCustomContacts] = useState(initialCustomContacts)
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

  // Custom contact form state
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', company: '', role: '', linkedin_url: '', notes: '' })
  const [isAddingContact, setIsAddingContact] = useState(false)

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
      setCustomContacts([])
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

  const handleAddCustomContact = async () => {
    if (!plan || !contactForm.name.trim()) return
    setIsAddingContact(true)

    const { data, error } = await supabase
      .from('plan_custom_contacts')
      .insert({
        plan_id: plan.id,
        user_id: userId,
        name: contactForm.name,
        company: contactForm.company || null,
        role: contactForm.role || null,
        linkedin_url: contactForm.linkedin_url || null,
        notes: contactForm.notes || null,
      })
      .select()
      .single()

    if (!error && data) {
      setCustomContacts(prev => [...prev, data])
      setContactForm({ name: '', company: '', role: '', linkedin_url: '', notes: '' })
      setShowAddContact(false)
    }
    setIsAddingContact(false)
  }

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id)
    trackEvent('alumni_expanded', { plan_alumni_id: id })
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[--text-primary]">
          Welcome back, {firstName}
        </h1>
        <p className="text-[--text-tertiary] mt-1">
          Your networking plan and recommended connections
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[--school-primary]/5 to-transparent" />
          <div className="relative">
            <Users size={20} className="mx-auto mb-2 text-[--school-primary]" />
            <div className="text-2xl font-bold text-[--text-primary]">{stats.networkCount}</div>
            <div className="text-xs text-[--text-tertiary]">People in Network</div>
          </div>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[--school-primary]/5 to-transparent" />
          <div className="relative">
            <MessageSquare size={20} className="mx-auto mb-2 text-[--school-primary]" />
            <div className="text-2xl font-bold text-[--text-primary]">{stats.messagesCount}</div>
            <div className="text-xs text-[--text-tertiary]">Messages Sent</div>
          </div>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[--school-primary]/5 to-transparent" />
          <div className="relative">
            <Calendar size={20} className="mx-auto mb-2 text-[--school-primary]" />
            <div className="text-2xl font-bold text-[--text-primary]">{stats.meetingsCount}</div>
            <div className="text-xs text-[--text-tertiary]">Meetings</div>
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

      {/* No Plan State - Enlarged CTA */}
      {!plan && (
        <div className="border-2 border-dashed border-[--school-primary]/40 bg-gradient-to-br from-[--school-primary]/5 via-[--bg-secondary] to-[--bg-secondary] rounded-2xl p-12 text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[--school-primary]/10 flex items-center justify-center mx-auto mb-6">
            <Sparkles size={32} className="text-[--school-primary]" />
          </div>
          <h2 className="text-2xl font-bold mb-3 text-[--text-primary]">Generate Your Networking Plan</h2>
          <p className="text-[--text-secondary] text-base mb-4 max-w-lg mx-auto">
            We&apos;ll analyze your background and interests to recommend the best alumni connections with personalized talking points.
          </p>

          {/* Industry selector */}
          <div className="max-w-xs mx-auto mb-6">
            <label className="text-sm text-[--text-tertiary] mb-1.5 block">Target Industry</label>
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
            className="btn-primary inline-flex items-center gap-3 px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-shadow"
          >
            {isGenerating ? (
              <>
                <Loader2 size={22} className="animate-spin" />
                Generating your plan...
              </>
            ) : (
              <>
                <Sparkles size={22} />
                Generate Plan
              </>
            )}
          </button>
        </div>
      )}

      {/* Plan Banner */}
      {plan && (
        <div className="bg-[--school-primary]/10 border border-[--school-primary]/30 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[--text-primary]">{plan.title}</h2>
              <p className="text-sm text-[--text-tertiary]">
                {activePlanAlumni.length} alumni recommended
                {plan.goal_count && ` \u00B7 Goal: ${plan.goal_count} connections`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-ghost p-2 text-[--text-quaternary] hover:text-red-400"
                title="Delete plan and start fresh"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Delete confirmation */}
          {showDeleteConfirm && (
            <div className="mt-4 pt-4 border-t border-[--school-primary]/20">
              <p className="text-sm text-[--text-secondary] mb-3">
                Delete this plan and start fresh? You can generate a new plan with a different industry focus.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDeletePlan}
                  disabled={isDeletingPlan}
                  className="px-4 py-2 text-sm bg-red-500/10 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-2"
                >
                  {isDeletingPlan ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Trash2 size={14} />
                  )}
                  Delete Plan
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="btn-ghost text-sm"
                >
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

            return (
              <div
                key={pa.id}
                className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden hover:border-[--border-secondary] transition-colors"
              >
                {/* Collapsed header */}
                <button
                  onClick={() => toggleExpand(pa.id)}
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-[--bg-tertiary]/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[--school-primary]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-[--school-primary]">
                        {alumni.full_name?.charAt(0) || '?'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[--text-primary] truncate">
                          {alumni.full_name}
                        </span>
                        {pa.status === 'contacted' && (
                          <span className="text-xs bg-green-500/10 text-green-500 px-2 py-0.5 rounded-full flex-shrink-0">
                            Contacted
                          </span>
                        )}
                        {isInNetwork && (
                          <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full flex-shrink-0">
                            In Network
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[--text-tertiary] truncate">
                        {alumni.role && alumni.role !== '...' && alumni.company && alumni.company !== '...'
                          ? `${alumni.role} @ ${alumni.company}`
                          : (alumni.role && alumni.role !== '...' ? alumni.role : '') || (alumni.company && alumni.company !== '...' ? alumni.company : '') || 'Alumni'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs bg-[--bg-tertiary] px-2 py-1 rounded text-[--text-tertiary] hidden sm:inline">
                      {alumni.sport} &apos;{String(alumni.graduation_year).slice(-2)}
                    </span>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-[--border-primary]">
                    {/* Career summary - now first */}
                    {pa.ai_career_summary && (
                      <div className="mt-4 mb-4">
                        <h4 className="text-sm font-medium text-[--text-secondary] mb-1">Career Summary</h4>
                        <p className="text-sm text-[--text-tertiary] leading-relaxed">
                          {pa.ai_career_summary}
                        </p>
                      </div>
                    )}

                    {/* Company bio */}
                    {pa.ai_company_bio && alumni.company && (
                      <div className="mb-4 bg-[--bg-tertiary]/50 rounded-lg p-3">
                        <h4 className="text-sm font-medium text-[--text-secondary] mb-1 flex items-center gap-1.5">
                          <Building2 size={14} />
                          About {alumni.company}
                        </h4>
                        <p className="text-sm text-[--text-tertiary] leading-relaxed">
                          {pa.ai_company_bio}
                        </p>
                      </div>
                    )}

                    {/* Talking points */}
                    {pa.ai_talking_points && pa.ai_talking_points.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-[--text-secondary] mb-2">Talking Points</h4>
                        <ul className="space-y-2">
                          {(pa.ai_talking_points as string[]).map((point, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-[--text-tertiary]">
                              <span className="w-5 h-5 rounded-full bg-[--school-primary]/10 text-[--school-primary] flex items-center justify-center flex-shrink-0 text-xs font-medium mt-0.5">
                                {i + 1}
                              </span>
                              {point}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex flex-wrap gap-2 text-xs text-[--text-tertiary] mb-4">
                      {alumni.industry && (
                        <span className="bg-[--bg-tertiary] px-2 py-1 rounded">{alumni.industry}</span>
                      )}
                      {alumni.location && (
                        <span className="bg-[--bg-tertiary] px-2 py-1 rounded">{alumni.location}</span>
                      )}
                      <span className="bg-[--bg-tertiary] px-2 py-1 rounded">
                        {alumni.sport} &apos;{alumni.graduation_year}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[--border-primary]">
                      {alumni.linkedin_url && (
                        <a
                          href={alumni.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-sm flex items-center gap-1.5 hover:text-[#0077b5]"
                        >
                          <Linkedin size={14} />
                          LinkedIn
                        </a>
                      )}

                      {alumni.company && (
                        <a
                          href={`https://www.google.com/search?q=${encodeURIComponent(alumni.company)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary text-sm flex items-center gap-1.5"
                        >
                          <Globe size={14} />
                          Company
                        </a>
                      )}

                      <button
                        onClick={() => handleWriteMessage(pa)}
                        className="btn-primary text-sm flex items-center gap-1.5"
                      >
                        <Mail size={14} />
                        Write Message
                      </button>

                      {/* Add to Network button */}
                      {isInNetwork ? (
                        <span className="btn-success text-sm flex items-center gap-1.5 cursor-default">
                          <Check size={14} />
                          In Network
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddToNetwork(alumni.id)}
                          disabled={addingToNetworkId === alumni.id}
                          className="btn-secondary text-sm flex items-center gap-1.5 hover:border-[--school-primary] hover:text-[--school-primary]"
                        >
                          {addingToNetworkId === alumni.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <UserPlus size={14} />
                          )}
                          Add to Network
                        </button>
                      )}

                      <button
                        onClick={() => handleNotInterested(pa.id)}
                        className="btn-ghost text-sm flex items-center gap-1.5 text-[--text-quaternary] hover:text-red-400 ml-auto"
                      >
                        <ThumbsDown size={14} />
                        Not Interested
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Generate More Button */}
      {plan && (
        <div className="text-center mb-8">
          <button
            onClick={handleGenerateMore}
            disabled={isGeneratingMore}
            className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5"
          >
            {isGeneratingMore ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Finding more alumni...
              </>
            ) : (
              <>
                <Plus size={16} />
                Generate More Recommendations
              </>
            )}
          </button>
        </div>
      )}

      {/* Custom Contacts Section */}
      {plan && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[--text-primary]">Custom Contacts</h3>
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="btn-ghost text-sm flex items-center gap-1.5"
            >
              {showAddContact ? <X size={14} /> : <Plus size={14} />}
              {showAddContact ? 'Cancel' : 'Add Contact'}
            </button>
          </div>

          {/* Add contact form */}
          {showAddContact && (
            <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Name *"
                  value={contactForm.name}
                  onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Company"
                  value={contactForm.company}
                  onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="Role"
                  value={contactForm.role}
                  onChange={(e) => setContactForm(prev => ({ ...prev, role: e.target.value }))}
                  className="input-field"
                />
                <input
                  type="text"
                  placeholder="LinkedIn URL"
                  value={contactForm.linkedin_url}
                  onChange={(e) => setContactForm(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  className="input-field"
                />
              </div>
              <input
                type="text"
                placeholder="Notes"
                value={contactForm.notes}
                onChange={(e) => setContactForm(prev => ({ ...prev, notes: e.target.value }))}
                className="input-field mb-3"
              />
              <button
                onClick={handleAddCustomContact}
                disabled={!contactForm.name.trim() || isAddingContact}
                className="btn-primary text-sm"
              >
                {isAddingContact ? 'Adding...' : 'Add Contact'}
              </button>
            </div>
          )}

          {/* Custom contacts list */}
          {customContacts.length > 0 ? (
            <div className="space-y-2">
              {customContacts.map(contact => (
                <div
                  key={contact.id}
                  className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium text-[--text-primary]">{contact.name}</div>
                    <div className="text-sm text-[--text-tertiary]">
                      {contact.role && contact.company
                        ? `${contact.role} @ ${contact.company}`
                        : contact.role || contact.company || ''}
                    </div>

                    {contact.notes && (
                      <div className="text-xs text-[--text-quaternary] mt-1">{contact.notes}</div>
                    )}
                  </div>
                  {contact.linkedin_url && (
                    <a
                      href={contact.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-ghost p-2 hover:text-[#0077b5]"
                    >
                      <Linkedin size={16} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[--text-quaternary] text-center py-4">
              Add people you want to track outside the alumni directory
            </p>
          )}
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
