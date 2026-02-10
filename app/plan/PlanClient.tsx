'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import MessageModal from '@/components/MessageModal'
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
} from 'lucide-react'

type PlanAlumniWithAlumni = PlanAlumni & { alumni: Alumni }
type PlanWithAlumni = NetworkingPlan & { plan_alumni: PlanAlumniWithAlumni[] }

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
}

export default function PlanClient({ userId, profile, plan: initialPlan, customContacts: initialCustomContacts, stats }: PlanClientProps) {
  const router = useRouter()
  const supabase = createClient()

  const [plan, setPlan] = useState<PlanWithAlumni | null>(initialPlan)
  const [customContacts, setCustomContacts] = useState(initialCustomContacts)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isGeneratingMore, setIsGeneratingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // MessageModal state
  const [messageTarget, setMessageTarget] = useState<{ connection: UserNetwork; planAlumniId: string } | null>(null)

  // Custom contact form state
  const [showAddContact, setShowAddContact] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', company: '', role: '', linkedin_url: '', notes: '' })
  const [isAddingContact, setIsAddingContact] = useState(false)

  const firstName = profile.full_name?.split(' ')[0] || 'there'

  const activePlanAlumni = (plan?.plan_alumni?.filter(pa => pa.status !== 'not_interested') || []) as PlanAlumniWithAlumni[]

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setError(null)

    try {
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
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsGenerating(false)
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

  const handleWriteMessage = (planAlumni: PlanAlumniWithAlumni) => {
    // Construct a UserNetwork-compatible object for MessageModal
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
    // Save the message
    await supabase.from('messages').insert({
      user_id: userId,
      alumni_id: messageTarget?.connection.alumni_id,
      message_content: message,
      sent_via: sentVia === 'marked' ? 'email' : sentVia,
    })

    // Update plan alumni status to contacted
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
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center">
          <Users size={20} className="mx-auto mb-2 text-[--school-primary]" />
          <div className="text-2xl font-bold text-[--text-primary]">{stats.networkCount}</div>
          <div className="text-xs text-[--text-tertiary]">People in Network</div>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center">
          <MessageSquare size={20} className="mx-auto mb-2 text-[--school-primary]" />
          <div className="text-2xl font-bold text-[--text-primary]">{stats.messagesCount}</div>
          <div className="text-xs text-[--text-tertiary]">Messages Sent</div>
        </div>
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4 text-center">
          <Calendar size={20} className="mx-auto mb-2 text-[--school-primary]" />
          <div className="text-2xl font-bold text-[--text-primary]">{stats.meetingsCount}</div>
          <div className="text-xs text-[--text-tertiary]">Meetings</div>
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
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 text-center mb-8">
          <Sparkles size={32} className="mx-auto mb-4 text-[--school-primary]" />
          <h2 className="text-lg font-semibold mb-2">Generate your networking plan</h2>
          <p className="text-[--text-tertiary] text-sm mb-6 max-w-md mx-auto">
            Based on your interests in {profile.primary_industry || 'various industries'} and your background,
            we&apos;ll recommend alumni to connect with and provide personalized talking points.
          </p>
          <button
            onClick={handleGeneratePlan}
            disabled={isGenerating}
            className="btn-primary inline-flex items-center gap-2 px-6 py-3"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Generating your plan...
              </>
            ) : (
              <>
                <Sparkles size={18} />
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
          </div>
        </div>
      )}

      {/* Alumni List */}
      {plan && activePlanAlumni.length > 0 && (
        <div className="space-y-3 mb-8">
          {activePlanAlumni.map((pa) => {
            const alumni = pa.alumni
            if (!alumni) return null
            const isExpanded = expandedId === pa.id

            return (
              <div
                key={pa.id}
                className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden"
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
                      </div>
                      <div className="text-sm text-[--text-tertiary] truncate">
                        {alumni.role && alumni.company
                          ? `${alumni.role} @ ${alumni.company}`
                          : alumni.company || alumni.role || 'Alumni'}
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
                    {/* Recommendation reason */}
                    {pa.ai_recommendation_reason && (
                      <div className="mt-4 mb-4 bg-[--school-primary]/5 border border-[--school-primary]/20 rounded-lg p-3">
                        <p className="text-sm text-[--text-secondary]">
                          <span className="font-medium text-[--school-primary]">Why connect: </span>
                          {pa.ai_recommendation_reason}
                        </p>
                      </div>
                    )}

                    {/* Career summary */}
                    {pa.ai_career_summary && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium text-[--text-secondary] mb-1">Career Summary</h4>
                        <p className="text-sm text-[--text-tertiary] leading-relaxed">
                          {pa.ai_career_summary}
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
                        : contact.company || contact.role || ''}
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
