'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import AlumniDetailModal from '@/components/AlumniDetailModal'
import { analyzeActionItem } from '@/lib/actionResources'
import { ActionList } from '@/components/ui/ActionCard'
import type { SuggestedAction } from '@/lib/smart-links'
import {
  Sparkles,
  Users,
  MessageSquare,
  CheckCircle2,
  Check,
  ChevronRight,
  ChevronDown,
  Clock,
  UserPlus,
  Send,
  Target,
  GraduationCap,
  MapPin,
  Linkedin,
  Loader2,
  Plus,
  X,
  Trash2,
  ExternalLink,
  Briefcase
} from 'lucide-react'

interface Alumni {
  id: string
  full_name: string
  company?: string
  role?: string
  industry?: string
  sport?: string
  graduation_year?: number
  location?: string
  linkedin_url?: string
}

interface ActionItem {
  text: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

interface Plan {
  id: string
  interest: string
  action_items: ActionItem[]
  alumni_recommendations: any[]
  created_at: string
}

interface ActivityItem {
  id: string
  type: 'network_add' | 'message_sent'
  date: string
  alumniName: string
  company?: string
  sentVia?: string
}

interface AlumniRecommendation {
  alumni: Alumni
  reason: string
}

interface DbSuggestedAction {
  id: string
  user_id: string
  alumni_id: string | null
  action_type: 'calendar_event' | 'email_draft' | 'linkedin_message' | 'follow_up'
  status: 'pending' | 'completed' | 'dismissed' | 'expired'
  payload: Record<string, unknown>
  ai_reasoning: string | null
  confidence_score: number | null
  created_at: string
  alumni?: {
    id: string
    full_name: string
    company: string | null
    role: string | null
    linkedin_url: string | null
    email: string | null
  } | null
}

interface CoachClientProps {
  userId: string
  userProfile: {
    name: string
    sport: string
    interests: string
    graduationYear: number | null
  }
  allAlumni: Alumni[]
  networkAlumniIds: string[]
  savedPlans: Plan[]
  networkCount: number
  messagesCount: number
  recentActivity: ActivityItem[]
  initialSuggestedActions: DbSuggestedAction[]
}

const ALUMNI_BATCH_SIZE = 6

export default function CoachClient({
  userId,
  userProfile,
  allAlumni,
  networkAlumniIds,
  savedPlans,
  networkCount,
  messagesCount,
  recentActivity,
  initialSuggestedActions
}: CoachClientProps) {
  const supabase = createClient()

  // Dashboard state
  const [localPlans, setLocalPlans] = useState<Plan[]>(savedPlans)
  const [suggestedActions, setSuggestedActions] = useState<DbSuggestedAction[]>(initialSuggestedActions)

  // Coach generator state
  const [interest, setInterest] = useState(userProfile.interests || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [recommendations, setRecommendations] = useState<AlumniRecommendation[]>([])
  const [addedToNetwork, setAddedToNetwork] = useState<Set<string>>(new Set(networkAlumniIds))
  const [isFindingMore, setIsFindingMore] = useState(false)
  const [shownAlumniIds, setShownAlumniIds] = useState<Set<string>>(new Set())
  const [isSaved, setIsSaved] = useState(false)
  const [showGenerator, setShowGenerator] = useState(false)
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null)
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null) // Track which plan was just saved
  const [selectedAlumni, setSelectedAlumni] = useState<Alumni | null>(null) // For profile modal
  const [generatingNextStepsForPlan, setGeneratingNextStepsForPlan] = useState<string | null>(null)

  // Convert DB suggested action to ActionCard format
  const toActionCardFormat = (dbAction: DbSuggestedAction): SuggestedAction => ({
    id: dbAction.id,
    type: dbAction.action_type,
    payload: dbAction.payload as unknown as SuggestedAction['payload'],
    reasoning: dbAction.ai_reasoning || undefined,
    confidence: dbAction.confidence_score || undefined,
  })

  // Handle completing a suggested action
  const handleActionComplete = async (actionId: string) => {
    try {
      await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      setSuggestedActions(prev => prev.filter(a => a.id !== actionId))
    } catch (error) {
      console.error('Error completing action:', error)
    }
  }

  // Handle dismissing a suggested action
  const handleActionDismiss = async (actionId: string) => {
    try {
      await fetch(`/api/actions/${actionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'dismissed' }),
      })
      setSuggestedActions(prev => prev.filter(a => a.id !== actionId))
    } catch (error) {
      console.error('Error dismissing action:', error)
    }
  }

  // Toggle action item in saved plan
  const toggleSavedPlanAction = async (planId: string, actionIndex: number) => {
    setLocalPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan
      const newActionItems = plan.action_items.map((item, i) =>
        i === actionIndex ? { ...item, completed: !item.completed } : item
      )
      return { ...plan, action_items: newActionItems }
    }))

    const plan = localPlans.find(p => p.id === planId)
    if (!plan) return

    const updatedItems = plan.action_items.map((item, i) =>
      i === actionIndex ? { ...item, completed: !item.completed } : item
    )

    await supabase
      .from('coaching_plans')
      .update({ action_items: updatedItems })
      .eq('id', planId)
  }

  // Toggle action item in newly generated plan
  const toggleActionComplete = (index: number) => {
    setActionItems(prev =>
      prev.map((a, i) => i === index ? { ...a, completed: !a.completed } : a)
    )
    setIsSaved(false)
  }

  // Delete a saved plan
  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return

    try {
      const { error } = await supabase
        .from('coaching_plans')
        .delete()
        .eq('id', planId)

      if (error) throw error

      setLocalPlans(prev => prev.filter(p => p.id !== planId))
      if (expandedPlanId === planId) setExpandedPlanId(null)
    } catch (err) {
      console.error('Error deleting plan:', err)
      alert('Failed to delete plan. Please try again.')
    }
  }

  const getCompletionPercentage = (plan: Plan) => {
    if (!plan.action_items || plan.action_items.length === 0) return 0
    const completed = plan.action_items.filter(item => item.completed).length
    return Math.round((completed / plan.action_items.length) * 100)
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const totalActionItems = localPlans.reduce((sum, plan) => sum + (plan.action_items?.length || 0), 0)
  const completedActionItems = localPlans.reduce(
    (sum, plan) => sum + (plan.action_items?.filter(item => item.completed).length || 0),
    0
  )

  // Generate next steps for a saved plan
  const generateNextSteps = async (planId: string) => {
    const plan = localPlans.find(p => p.id === planId)
    if (!plan) return

    setGeneratingNextStepsForPlan(planId)

    try {
      const completedActions = plan.action_items.filter(item => item.completed)
      const remainingActions = plan.action_items.filter(item => !item.completed)

      const response = await fetch('/api/coach/next-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest: plan.interest,
          userProfile,
          completedActions,
          remainingActions,
        })
      })

      if (!response.ok) throw new Error('Failed to generate next steps')

      const data = await response.json()
      if (data.error) throw new Error(data.error)

      const newActions = data.nextSteps || []
      if (newActions.length === 0) {
        alert('No additional steps generated. Great progress!')
        return
      }

      // Append new actions to the plan
      const updatedActionItems = [...plan.action_items, ...newActions]

      // Update local state
      setLocalPlans(prev => prev.map(p =>
        p.id === planId ? { ...p, action_items: updatedActionItems } : p
      ))

      // Save to database
      const { error } = await supabase
        .from('coaching_plans')
        .update({ action_items: updatedActionItems })
        .eq('id', planId)

      if (error) throw error

      // Auto-expand the plan to show new items
      setExpandedPlanId(planId)

    } catch (err) {
      console.error('Error generating next steps:', err)
      alert('Failed to generate next steps. Please try again.')
    } finally {
      setGeneratingNextStepsForPlan(null)
    }
  }

  // Check if a plan should show "Generate Next Steps" button
  const shouldShowNextSteps = (plan: Plan) => {
    if (!plan.action_items || plan.action_items.length === 0) return false
    const completedCount = plan.action_items.filter(item => item.completed).length
    const totalCount = plan.action_items.length
    // Show button if at least 1 item completed but not all items
    return completedCount >= 1 && completedCount < totalCount
  }

  const generatePlan = async () => {
    if (!interest.trim()) return

    setIsGenerating(true)
    setError(null)
    setIsSaved(false)

    try {
      const relevantAlumni = findRelevantAlumni(interest, allAlumni)

      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest,
          userProfile,
          relevantAlumni: relevantAlumni.map(r => r.alumni)
        })
      })

      if (!response.ok) throw new Error('Failed to generate plan')

      const plan = await response.json()
      if (plan.error) throw new Error(plan.error)

      const allActions = [
        ...(plan.shortTermActions || [])
      ].slice(0, 6).map((a: any) => ({
        text: a.text,
        priority: a.priority || 'medium',
        completed: false
      }))

      setActionItems(allActions)

      const alumniRecs: AlumniRecommendation[] = []
      for (const rec of (plan.alumniRecommendations || [])) {
        const matchedAlumni = relevantAlumni.find(
          r => r.alumni.full_name.toLowerCase().includes(rec.alumniName?.toLowerCase() || '') ||
               rec.alumniName?.toLowerCase().includes(r.alumni.full_name.toLowerCase())
        )
        if (matchedAlumni) {
          alumniRecs.push({ alumni: matchedAlumni.alumni, reason: rec.reason })
        }
      }

      // Fallback: Use relevant alumni if AI didn't return specific names
      if (alumniRecs.length === 0 && relevantAlumni.length > 0) {
        relevantAlumni.slice(0, 6).forEach(r => {
          alumniRecs.push({ alumni: r.alumni, reason: r.reason })
        })
      }
      // Note: We don't show random unrelated alumni - only show alumni who actually match the interest

      setRecommendations(alumniRecs)
      setHasGenerated(true)
      setShownAlumniIds(new Set(alumniRecs.map(r => r.alumni.id)))

      // Add any new suggested actions from the API
      if (plan.suggestedActions && plan.suggestedActions.length > 0) {
        setSuggestedActions(prev => [...plan.suggestedActions, ...prev])
      }

      // Auto-save the plan to database
      try {
        const { data, error: saveError } = await supabase
          .from('coaching_plans')
          .insert({
            user_id: userId,
            interest,
            action_items: allActions,
            alumni_recommendations: alumniRecs.map(r => ({
              alumni_id: r.alumni.id,
              alumni_name: r.alumni.full_name,
              reason: r.reason
            }))
          })
          .select()
          .single()

        if (saveError) throw saveError

        if (data) {
          setLocalPlans(prev => [data, ...prev])
          setIsSaved(true)
          setSavedPlanId(data.id)
          // Keep showing generated view with alumni recommendations
          // User can dismiss it or generate a new plan
        }
      } catch (saveErr: any) {
        console.error('Error auto-saving plan:', saveErr)
        // Show error to user - plan generated but not saved
        setError(`Plan generated but failed to save: ${saveErr?.message || 'Unknown error'}. Check if coaching_plans table exists.`)
      }

    } catch (err) {
      console.error('Error generating plan:', err)
      setError('Failed to generate plan. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const findMoreAlumni = async () => {
    if (!interest.trim()) return
    setIsFindingMore(true)

    try {
      const relevantAlumni = findRelevantAlumni(interest, allAlumni, shownAlumniIds)

      if (relevantAlumni.length === 0) {
        alert('No more alumni found matching your criteria.')
        setIsFindingMore(false)
        return
      }

      const newRecs = relevantAlumni.slice(0, ALUMNI_BATCH_SIZE).map(r => ({
        alumni: r.alumni,
        reason: r.reason
      }))

      setRecommendations(prev => [...prev, ...newRecs])
      setShownAlumniIds(prev => {
        const newSet = new Set(prev)
        newRecs.forEach(r => newSet.add(r.alumni.id))
        return newSet
      })
    } catch (err) {
      console.error('Error finding more alumni:', err)
    } finally {
      setIsFindingMore(false)
    }
  }

  const handleAddToNetwork = async (alumni: Alumni) => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .insert({
          user_id: userId,
          alumni_id: alumni.id,
          status: 'interested',
          contacted: false
        })

      if (error) throw error
      setAddedToNetwork(prev => new Set([...prev, alumni.id]))
    } catch (error) {
      console.error('Error adding to network:', error)
    }
  }

  const firstName = userProfile.name.split(' ')[0] || 'there'

  // Helper function to find alumni by ID
  const findAlumniById = (id: string): Alumni | null => {
    return allAlumni.find(a => a.id === id) || null
  }

  // Helper function to find similar alumni for modal
  const getSimilarAlumni = (alumni: Alumni): Alumni[] => {
    const similar: Alumni[] = []

    // Find alumni with same industry
    if (alumni.industry) {
      const sameIndustry = allAlumni.filter(
        a => a.id !== alumni.id && a.industry === alumni.industry
      ).slice(0, 2)
      similar.push(...sameIndustry)
    }

    // Find alumni with same sport
    if (similar.length < 4 && alumni.sport) {
      const sameSport = allAlumni.filter(
        a => a.id !== alumni.id && a.sport === alumni.sport && !similar.includes(a)
      ).slice(0, 4 - similar.length)
      similar.push(...sameSport)
    }

    // Find alumni at same company
    if (similar.length < 4 && alumni.company) {
      const sameCompany = allAlumni.filter(
        a => a.id !== alumni.id && a.company === alumni.company && !similar.includes(a)
      ).slice(0, 4 - similar.length)
      similar.push(...sameCompany)
    }

    return similar.slice(0, 4)
  }

  // Handler for adding to network from modal
  const handleModalAddToNetwork = async (alumniId: string) => {
    const alumni = findAlumniById(alumniId)
    if (alumni) {
      await handleAddToNetwork(alumni)
    }
  }

  return (
    <main className="px-6 md:px-12 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-gradient-to-br from-[--school-primary] to-[--school-primary-hover] rounded-xl flex items-center justify-center">
            <Sparkles size={20} className="text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
        </div>
        <p className="text-[--text-tertiary]">
          Your AI-powered career hub. Track progress and get personalized guidance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[--school-primary]/10 rounded-xl flex items-center justify-center">
              <Users size={20} className="text-[--school-primary]" />
            </div>
          </div>
          <div className="text-2xl font-bold">{networkCount}</div>
          <div className="text-sm text-[--text-tertiary]">Alumni in Network</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} className="text-blue-500" />
            </div>
          </div>
          <div className="text-2xl font-bold">{messagesCount}</div>
          <div className="text-sm text-[--text-tertiary]">Messages Sent</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} className="text-emerald-500" />
            </div>
          </div>
          <div className="text-2xl font-bold">{completedActionItems}/{totalActionItems}</div>
          <div className="text-sm text-[--text-tertiary]">Actions Complete</div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center">
              <Target size={20} className="text-amber-500" />
            </div>
          </div>
          <div className="text-2xl font-bold">{localPlans.length}</div>
          <div className="text-sm text-[--text-tertiary]">Career Plans</div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="md:col-span-2 space-y-6">
          {/* Plan Generator - At top when visible */}
          {(showGenerator || localPlans.length === 0 || hasGenerated) && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[--school-primary] to-[--school-primary-hover] rounded-xl flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium">
                      {localPlans.length > 0 ? 'Generate New Plan' : 'AI Career Coach'}
                    </h2>
                    <p className="text-xs text-[--text-tertiary]">Get personalized career guidance and alumni recommendations</p>
                  </div>
                </div>
                {localPlans.length > 0 && !hasGenerated && (
                  <button
                    onClick={() => setShowGenerator(false)}
                    className="btn-ghost p-2 text-[--text-tertiary] hover:text-[--text-primary]"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && generatePlan()}
                  placeholder="e.g., Investment Banking, Product Management, Sports Marketing..."
                  className="input-field flex-1"
                />
                <button
                  onClick={generatePlan}
                  disabled={isGenerating || !interest.trim()}
                  className="btn-primary flex items-center justify-center gap-2 px-6"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      Generate Plan
                    </>
                  )}
                </button>
              </div>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="text-xs text-[--text-quaternary]">Popular:</span>
                {['Investment Banking', 'Consulting', 'Tech/Software', 'Sports Marketing', 'Private Equity'].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInterest(suggestion)}
                    className="text-xs px-2 py-1 bg-[--bg-tertiary] hover:bg-[--bg-hover] rounded-md text-[--text-secondary] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </div>
          )}

          {/* Generated Plan Results - Shows right after generator */}
          {hasGenerated && (
            <div className="space-y-6 animate-fade-in">
              {/* Header with dismiss button */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-[--school-primary]">Your Plan for: {interest}</h3>
                <button
                  onClick={() => {
                    setHasGenerated(false)
                    setShowGenerator(false)
                    setActionItems([])
                    setRecommendations([])
                    setSavedPlanId(null)
                  }}
                  className="btn-ghost p-2 text-[--text-tertiary] hover:text-[--text-primary]"
                  title="Dismiss"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Action Items */}
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-[--school-primary]/10 rounded-lg flex items-center justify-center">
                      <CheckCircle2 size={16} className="text-[--school-primary]" />
                    </div>
                    <h3 className="font-medium">Action Items</h3>
                  </div>

                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-500">
                    <Check size={14} /> Auto-saved
                  </span>
                </div>

                <div className="space-y-2">
                  {actionItems.map((action, index) => {
                    const actionInfo = analyzeActionItem(action.text)
                    return (
                      <div key={index} className="rounded-lg hover:bg-[--bg-tertiary] transition-colors">
                        <button
                          onClick={() => toggleActionComplete(index)}
                          className="w-full flex items-start gap-3 text-left group p-3"
                        >
                          <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            action.completed
                              ? 'bg-emerald-500 border-emerald-500'
                              : 'border-[--border-secondary] group-hover:border-emerald-500'
                          }`}>
                            {action.completed && <Check size={12} className="text-white" />}
                          </div>
                          <span className={`text-sm ${action.completed ? 'text-[--text-quaternary] line-through' : 'text-[--text-primary]'}`}>
                            {action.text}
                          </span>
                        </button>
                        {/* Guidance and resource link for uncompleted items */}
                        {!action.completed && (actionInfo.guidance || actionInfo.resourceUrl) && (
                          <div className="pl-11 pr-3 pb-3 space-y-1.5">
                            {actionInfo.guidance && (
                              <p className="text-xs text-[--text-tertiary]">
                                {actionInfo.guidance}
                              </p>
                            )}
                            {actionInfo.resourceUrl && (
                              <a
                                href={actionInfo.resourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[--school-primary] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {actionInfo.resourceLabel || 'Learn more'}
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Alumni Recommendations */}
              <div className="card p-6">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-[--school-primary]/10 rounded-lg flex items-center justify-center">
                    <Users size={16} className="text-[--school-primary]" />
                  </div>
                  <div>
                    <h3 className="font-medium">Recommended Alumni</h3>
                    <p className="text-xs text-[--text-quaternary]">Cornell athletes who can help with {interest}</p>
                  </div>
                </div>

                {recommendations.length === 0 ? (
                  <p className="text-sm text-[--text-tertiary] text-center py-8">
                    No exact matches found. Try a different industry.
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4">
                      {recommendations.map(({ alumni, reason }) => (
                        <div
                          key={alumni.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-[--bg-secondary] rounded-xl border border-[--border-primary]"
                        >
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium">{alumni.full_name}</h4>
                            <p className="text-sm text-[--text-secondary]">
                              {alumni.role && alumni.company
                                ? `${alumni.role} @ ${alumni.company}`
                                : alumni.company || alumni.role || 'Cornell Athlete Alumni'}
                            </p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {alumni.graduation_year && (
                                <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                                  <GraduationCap size={12} /> {alumni.graduation_year}
                                </span>
                              )}
                              {alumni.sport && (
                                <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                                  <Users size={12} /> {alumni.sport}
                                </span>
                              )}
                              {alumni.location && (
                                <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                                  <MapPin size={12} /> {alumni.location}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[--school-primary] mt-2 italic">"{reason}"</p>
                          </div>

                          <div className="flex gap-2 flex-shrink-0">
                            {alumni.linkedin_url && (
                              <a
                                href={alumni.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn-ghost p-2"
                              >
                                <Linkedin size={16} />
                              </a>
                            )}
                            {addedToNetwork.has(alumni.id) ? (
                              <span className="btn-secondary text-emerald-500 cursor-default flex items-center gap-2">
                                <CheckCircle2 size={16} /> Added
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddToNetwork(alumni)}
                                className="btn-primary flex items-center gap-2"
                              >
                                <UserPlus size={16} /> Add to Network
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 text-center">
                      <button
                        onClick={findMoreAlumni}
                        disabled={isFindingMore}
                        className="btn-secondary flex items-center gap-2 mx-auto"
                      >
                        {isFindingMore ? (
                          <><Loader2 size={16} className="animate-spin" /> Finding more...</>
                        ) : (
                          <><Users size={16} /> Find More Alumni</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Saved Career Plans - hide header when viewing generated plan with no other plans */}
          {(!hasGenerated || localPlans.filter(p => p.id !== savedPlanId).length > 0) && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Your Career Plans</h2>
              {!showGenerator && !hasGenerated && localPlans.length > 0 && (
                <button
                  onClick={() => setShowGenerator(true)}
                  className="text-sm text-[--school-primary] hover:underline flex items-center gap-1"
                >
                  <Plus size={14} />
                  Create new
                </button>
              )}
            </div>

            {localPlans.length > 0 && (
              <div className="space-y-4">
                {localPlans
                  .filter(plan => !(hasGenerated && plan.id === savedPlanId)) // Hide just-saved plan while showing generated view
                  .map((plan) => {
                  const completion = getCompletionPercentage(plan)
                  const isExpanded = expandedPlanId === plan.id
                  const itemsToShow = isExpanded ? plan.action_items : plan.action_items?.slice(0, 4)
                  const hasMoreItems = plan.action_items?.length > 4

                  return (
                    <div key={plan.id} className="card p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="font-medium">{plan.interest}</h3>
                          <p className="text-xs text-[--text-quaternary] mt-1">
                            Created {formatDate(plan.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-[--text-secondary]">{completion}%</div>
                            <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${completion}%` }}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => deletePlan(plan.id)}
                            className="p-1.5 text-[--text-quaternary] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Delete plan"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {itemsToShow?.map((item, index) => {
                          const actionInfo = analyzeActionItem(item.text)
                          return (
                            <div key={index} className="rounded-lg hover:bg-[--bg-tertiary] transition-colors">
                              <button
                                onClick={() => toggleSavedPlanAction(plan.id, index)}
                                className="w-full flex items-start gap-3 text-left group p-2"
                              >
                                <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                  item.completed
                                    ? 'bg-emerald-500 border-emerald-500'
                                    : 'border-[--border-secondary] group-hover:border-emerald-500'
                                }`}>
                                  {item.completed && <Check size={12} className="text-white" />}
                                </div>
                                <span className={`text-sm ${item.completed ? 'text-[--text-quaternary] line-through' : 'text-[--text-secondary]'}`}>
                                  {item.text}
                                </span>
                              </button>
                              {/* Guidance and resource link for uncompleted items (when expanded) */}
                              {isExpanded && !item.completed && (actionInfo.guidance || actionInfo.resourceUrl) && (
                                <div className="pl-9 pr-3 pb-2 space-y-1">
                                  {actionInfo.guidance && (
                                    <p className="text-xs text-[--text-tertiary]">
                                      {actionInfo.guidance}
                                    </p>
                                  )}
                                  {actionInfo.resourceUrl && (
                                    <a
                                      href={actionInfo.resourceUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs text-[--school-primary] hover:underline"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {actionInfo.resourceLabel || 'Learn more'}
                                      <ExternalLink size={10} />
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                        {(hasMoreItems || plan.alumni_recommendations?.length > 0) && (
                          <button
                            onClick={() => setExpandedPlanId(isExpanded ? null : plan.id)}
                            className="w-full flex items-center justify-center gap-1 text-xs text-[--school-primary] hover:underline py-2"
                          >
                            {isExpanded ? (
                              <>Show less <ChevronDown size={14} className="rotate-180" /></>
                            ) : (
                              <>
                                {hasMoreItems ? `Show ${plan.action_items.length - 4} more items` : 'Show details'}
                                {plan.alumni_recommendations?.length > 0 && ` + ${plan.alumni_recommendations.length} alumni`}
                                <ChevronDown size={14} />
                              </>
                            )}
                          </button>
                        )}

                        {/* Show alumni recommendations when expanded */}
                        {isExpanded && plan.alumni_recommendations?.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-[--border-primary]">
                            <div className="flex items-center gap-2 mb-3">
                              <Users size={14} className="text-[--school-primary]" />
                              <span className="text-sm font-medium">Suggested Connections</span>
                            </div>
                            <div className="space-y-2">
                              {plan.alumni_recommendations.map((rec: any, idx: number) => {
                                const alumniData = rec.alumni_id ? findAlumniById(rec.alumni_id) : null
                                return (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-[--bg-secondary] rounded-lg">
                                    <div>
                                      <p className="text-sm font-medium">{rec.alumni_name}</p>
                                      <p className="text-xs text-[--text-tertiary]">{rec.reason}</p>
                                    </div>
                                    {alumniData && (
                                      <button
                                        onClick={() => setSelectedAlumni(alumniData)}
                                        className="text-xs text-[--school-primary] hover:underline"
                                      >
                                        View
                                      </button>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Generate Next Steps Button - shows when plan has progress */}
                        {shouldShowNextSteps(plan) && (
                          <div className="mt-4 pt-4 border-t border-[--border-primary]">
                            <button
                              onClick={() => generateNextSteps(plan.id)}
                              disabled={generatingNextStepsForPlan === plan.id}
                              className="w-full btn-secondary flex items-center justify-center gap-2 py-2.5"
                            >
                              {generatingNextStepsForPlan === plan.id ? (
                                <>
                                  <Loader2 size={14} className="animate-spin" />
                                  Generating next steps...
                                </>
                              ) : (
                                <>
                                  <Sparkles size={14} />
                                  Generate Next Steps
                                </>
                              )}
                            </button>
                            <p className="text-xs text-[--text-quaternary] text-center mt-2">
                              Get personalized follow-up actions based on your progress
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          )}

        </div>

        {/* Sidebar - Right 1/3 */}
        <div className="space-y-6">
          {/* Suggested Actions */}
          {suggestedActions.length > 0 && (
            <div>
              <ActionList
                actions={suggestedActions.slice(0, 3).map(toActionCardFormat)}
                onComplete={handleActionComplete}
                onDismiss={handleActionDismiss}
                title="Suggested Actions"
              />
            </div>
          )}

          {/* Recent Activity */}
          <div>
          <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
          <div className="card p-4 mb-6">
            {recentActivity.length === 0 ? (
              <div className="text-center py-6">
                <Clock size={24} className="text-[--text-quaternary] mx-auto mb-2" />
                <p className="text-sm text-[--text-tertiary]">No activity yet</p>
                <p className="text-xs text-[--text-quaternary] mt-1">
                  Start by adding alumni to your network
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentActivity.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.type === 'network_add' ? 'bg-emerald-500/10' : 'bg-blue-500/10'
                    }`}>
                      {item.type === 'network_add' ? (
                        <UserPlus size={14} className="text-emerald-500" />
                      ) : (
                        <Send size={14} className="text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[--text-secondary]">
                        {item.type === 'network_add' ? (
                          <>Added <span className="font-medium text-[--text-primary]">{item.alumniName}</span></>
                        ) : (
                          <>Messaged <span className="font-medium text-[--text-primary]">{item.alumniName}</span></>
                        )}
                      </p>
                      <p className="text-xs text-[--text-quaternary]">{formatDate(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </div>

          {/* Quick Actions */}
          <div>
          <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <Link
              href="/jobs"
              className="card p-4 flex items-center gap-3 hover:border-purple-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center">
                <Briefcase size={18} className="text-purple-500" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Browse Jobs</div>
                <div className="text-xs text-[--text-quaternary]">Find opportunities</div>
              </div>
              <ChevronRight size={16} className="text-[--text-quaternary]" />
            </Link>

            <Link
              href="/discover"
              className="card p-4 flex items-center gap-3 hover:border-blue-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                <Users size={18} className="text-blue-500" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">Browse Alumni</div>
                <div className="text-xs text-[--text-quaternary]">Find connections</div>
              </div>
              <ChevronRight size={16} className="text-[--text-quaternary]" />
            </Link>

            <Link
              href="/network"
              className="card p-4 flex items-center gap-3 hover:border-emerald-500/50 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center">
                <MessageSquare size={18} className="text-emerald-500" />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">My Network</div>
                <div className="text-xs text-[--text-quaternary]">Manage connections</div>
              </div>
              <ChevronRight size={16} className="text-[--text-quaternary]" />
            </Link>
          </div>
          </div>
        </div>
      </div>

      {/* Alumni Detail Modal */}
      {selectedAlumni && (
        <AlumniDetailModal
          alumni={{
            id: selectedAlumni.id,
            full_name: selectedAlumni.full_name,
            company: selectedAlumni.company ?? null,
            role: selectedAlumni.role ?? null,
            industry: selectedAlumni.industry ?? null,
            sport: selectedAlumni.sport || '',
            graduation_year: selectedAlumni.graduation_year || 0,
            linkedin_url: selectedAlumni.linkedin_url ?? null,
            location: selectedAlumni.location ?? null,
          }}
          isInNetwork={addedToNetwork.has(selectedAlumni.id)}
          onAddToNetwork={handleModalAddToNetwork}
          onClose={() => setSelectedAlumni(null)}
          similarAlumni={getSimilarAlumni(selectedAlumni).map(a => ({
            id: a.id,
            full_name: a.full_name,
            company: a.company ?? null,
            role: a.role ?? null,
            industry: a.industry ?? null,
            sport: a.sport || '',
            graduation_year: a.graduation_year || 0,
            linkedin_url: a.linkedin_url ?? null,
            location: a.location ?? null,
          }))}
          onSelectAlumni={(alumni) => {
            const fullAlumni = findAlumniById(alumni.id)
            if (fullAlumni) setSelectedAlumni(fullAlumni)
          }}
          networkIds={addedToNetwork}
        />
      )}
    </main>
  )
}

// Helper function to find relevant alumni
function findRelevantAlumni(
  interest: string,
  allAlumni: Alumni[],
  excludeIds: Set<string> = new Set()
): { alumni: Alumni; reason: string }[] {
  const interestLower = interest.toLowerCase()
  const keywords: string[] = []

  if (interestLower.includes('banking') || interestLower.includes('finance')) {
    keywords.push('bank', 'capital', 'goldman', 'morgan', 'jpmorgan', 'citi', 'credit', 'financial', 'investment', 'analyst', 'associate')
  }
  if (interestLower.includes('consulting')) {
    keywords.push('consult', 'mckinsey', 'bain', 'bcg', 'deloitte', 'accenture', 'strategy', 'advisor')
  }
  if (interestLower.includes('tech') || interestLower.includes('software')) {
    keywords.push('google', 'meta', 'amazon', 'microsoft', 'apple', 'engineer', 'developer', 'software', 'tech', 'product')
  }
  if (interestLower.includes('product')) {
    keywords.push('product', 'manager', 'pm', 'growth', 'strategy')
  }
  if (interestLower.includes('sport') || interestLower.includes('marketing')) {
    keywords.push('sport', 'marketing', 'media', 'espn', 'nike', 'nba', 'nfl', 'mlb', 'brand', 'agency')
  }
  if (interestLower.includes('private equity') || interestLower.includes('pe')) {
    keywords.push('private equity', 'pe', 'kkr', 'blackstone', 'carlyle', 'apollo', 'buyout', 'portfolio')
  }

  keywords.push(...interestLower.split(' ').filter(w => w.length > 3))

  const scoredAlumni = allAlumni
    .filter(alumni => !excludeIds.has(alumni.id))
    .map(alumni => {
      let score = 0
      let reason = ''

      // Only use company and role for matching - industry field is often inaccurate
      const company = (alumni.company || '').toLowerCase()
      const role = (alumni.role || '').toLowerCase()

      for (const keyword of keywords) {
        if (company.includes(keyword)) {
          score += 3
          reason = `Works at ${alumni.company}`
        }
        if (role.includes(keyword)) {
          score += 2
          if (!reason) reason = `${alumni.role}`
        }
      }

      // Bonus for having complete profile info
      if (alumni.company && alumni.role) score += 1
      if (alumni.graduation_year && alumni.graduation_year >= 2015) score += 1

      if (!reason && score > 0) {
        // Only set a reason if we actually matched something specific
        if (alumni.company) {
          reason = `Works at ${alumni.company}`
        } else if (alumni.role) {
          reason = alumni.role
        }
      }

      return { alumni, score, reason }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return scoredAlumni.map(({ alumni, reason }) => ({ alumni, reason }))
}
