'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Sparkles, 
  Target, 
  Clock,
  Users, 
  CheckCircle2,
  GraduationCap,
  MapPin,
  Linkedin,
  UserPlus,
  Lightbulb,
  Loader2
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
}

interface ActionItem {
  text: string
  priority: 'high' | 'medium' | 'low'
  completed: boolean
}

interface AlumniRecommendation {
  alumni: Alumni
  reason: string
}

const ALUMNI_BATCH_SIZE = 6

export default function CoachClient({
  userId,
  userProfile,
  allAlumni,
  networkAlumniIds,
}: CoachClientProps) {
  const supabase = createClient()
  
  const [interest, setInterest] = useState(userProfile.interests || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [shortTermActions, setShortTermActions] = useState<ActionItem[]>([])
  const [longTermActions, setLongTermActions] = useState<ActionItem[]>([])
  const [recommendations, setRecommendations] = useState<AlumniRecommendation[]>([])
  const [keyInsight, setKeyInsight] = useState<string>('')
  const [addedToNetwork, setAddedToNetwork] = useState<Set<string>>(new Set(networkAlumniIds))
  const [isFindingMore, setIsFindingMore] = useState(false)
  const [shownAlumniIds, setShownAlumniIds] = useState<Set<string>>(new Set())

  const generatePlan = async () => {
    if (!interest.trim()) return
    
    setIsGenerating(true)
    setError(null)
    
    try {
      // Find relevant alumni based on interest keywords
      const relevantAlumni = findRelevantAlumni(interest, allAlumni)
      
      // Call the Coach API
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interest,
          userProfile,
          relevantAlumni: relevantAlumni.map(r => r.alumni)
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to generate plan')
      }
      
      const plan = await response.json()
      
      if (plan.error) {
        throw new Error(plan.error)
      }
      
      // Set short-term actions
      setShortTermActions(
        (plan.shortTermActions || []).map((a: any) => ({
          text: a.text,
          priority: a.priority || 'medium',
          completed: false
        }))
      )
      
      // Set long-term actions
      setLongTermActions(
        (plan.longTermActions || []).map((a: any) => ({
          text: a.text,
          priority: a.priority || 'medium',
          completed: false
        }))
      )
      
      // Match alumni recommendations with actual alumni objects
      const alumniRecs: AlumniRecommendation[] = []
      for (const rec of (plan.alumniRecommendations || [])) {
        const matchedAlumni = relevantAlumni.find(
          r => r.alumni.full_name.toLowerCase().includes(rec.alumniName?.toLowerCase() || '') ||
               rec.alumniName?.toLowerCase().includes(r.alumni.full_name.toLowerCase())
        )
        if (matchedAlumni) {
          alumniRecs.push({
            alumni: matchedAlumni.alumni,
            reason: rec.reason
          })
        }
      }
      
      // If no matches, use original relevant alumni with generic reasons
      if (alumniRecs.length === 0 && relevantAlumni.length > 0) {
        relevantAlumni.slice(0, 6).forEach(r => {
          alumniRecs.push({
            alumni: r.alumni,
            reason: r.reason
          })
        })
      }
      
      setRecommendations(alumniRecs)
      setKeyInsight(plan.keyInsight || '')
      setHasGenerated(true)

      // Track shown alumni
      const newShownIds = new Set(alumniRecs.map(r => r.alumni.id))
      setShownAlumniIds(newShownIds)

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
      // Find relevant alumni that haven't been shown yet
      const relevantAlumni = findRelevantAlumni(interest, allAlumni, shownAlumniIds)

      if (relevantAlumni.length === 0) {
        alert('No more alumni found matching your criteria. Try broadening your search.')
        setIsFindingMore(false)
        return
      }

      // Add new recommendations
      const newRecs = relevantAlumni.slice(0, ALUMNI_BATCH_SIZE).map(r => ({
        alumni: r.alumni,
        reason: r.reason
      }))

      setRecommendations(prev => [...prev, ...newRecs])

      // Update shown alumni
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

  const toggleActionComplete = (index: number, timeframe: 'short' | 'long') => {
    if (timeframe === 'short') {
      setShortTermActions(prev => 
        prev.map((a, i) => i === index ? { ...a, completed: !a.completed } : a)
      )
    } else {
      setLongTermActions(prev => 
        prev.map((a, i) => i === index ? { ...a, completed: !a.completed } : a)
      )
    }
  }

  const handleAddToNetwork = async (alumni: Alumni) => {
    try {
      const { error } = await supabase
        .from('user_networks')
        .insert({
          user_id: userId,
          alumni_id: alumni.id,
          status: 'cold',
          contacted: false
        })

      if (error) throw error
      setAddedToNetwork(prev => new Set([...prev, alumni.id]))
    } catch (error) {
      console.error('Error adding to network:', error)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400'
      case 'medium': return 'text-amber-400'
      case 'low': return 'text-blue-400'
      default: return 'text-[--text-quaternary]'
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
            Coach
          </h1>
        </div>
        <p className="text-[--text-tertiary]">
          Your AI-powered career advisor. Get personalized action plans and networking recommendations.
        </p>
      </div>

      {/* Interest Input */}
      <div className="card p-6 mb-8">
        <h2 className="text-lg font-medium mb-4">What career path interests you?</h2>
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
        
        {/* Quick suggestions */}
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
        
        {error && (
          <p className="text-red-400 text-sm mt-4">{error}</p>
        )}
      </div>

      {/* Results */}
      {hasGenerated && (
        <div className="space-y-6 animate-fade-in">
          
          {/* Key Insight */}
          {keyInsight && (
            <div className="card p-4 bg-gradient-to-r from-[--school-primary]/10 to-[--school-primary-hover]/10 border-[--school-primary]/20">
              <div className="flex items-start gap-3">
                <Lightbulb size={20} className="text-[--school-primary] flex-shrink-0 mt-0.5" />
                <p className="text-[--text-secondary] text-sm">{keyInsight}</p>
              </div>
            </div>
          )}
          
          {/* Action Plans */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Short-term Actions */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center">
                  <Clock size={16} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-medium">This Week</h3>
                  <p className="text-xs text-[--text-quaternary]">Short-term action items</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {shortTermActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => toggleActionComplete(index, 'short')}
                    className="w-full flex items-start gap-3 text-left group"
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      action.completed 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-[--border-secondary] group-hover:border-emerald-500'
                    }`}>
                      {action.completed && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm ${action.completed ? 'text-[--text-quaternary] line-through' : 'text-[--text-secondary]'}`}>
                        {action.text}
                      </span>
                      <span className={`ml-2 text-xs ${getPriorityColor(action.priority)}`}>
                        •
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Long-term Actions */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
                  <Target size={16} className="text-blue-500" />
                </div>
                <div>
                  <h3 className="font-medium">Next Few Months</h3>
                  <p className="text-xs text-[--text-quaternary]">Long-term goals</p>
                </div>
              </div>
              
              <div className="space-y-3">
                {longTermActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={() => toggleActionComplete(index, 'long')}
                    className="w-full flex items-start gap-3 text-left group"
                  >
                    <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      action.completed 
                        ? 'bg-emerald-500 border-emerald-500' 
                        : 'border-[--border-secondary] group-hover:border-emerald-500'
                    }`}>
                      {action.completed && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div className="flex-1">
                      <span className={`text-sm ${action.completed ? 'text-[--text-quaternary] line-through' : 'text-[--text-secondary]'}`}>
                        {action.text}
                      </span>
                      <span className={`ml-2 text-xs ${getPriorityColor(action.priority)}`}>
                        •
                      </span>
                    </div>
                  </button>
                ))}
              </div>
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
                No exact matches found. Try a different industry or broader search term.
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
                        <h4 className="font-medium text-[--text-primary]">{alumni.full_name}</h4>
                        <p className="text-sm text-[--text-secondary]">
                          {alumni.role && alumni.company
                            ? `${alumni.role} @ ${alumni.company}`
                            : alumni.company || alumni.role || 'Cornell Athlete Alumni'}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {alumni.graduation_year && (
                            <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                              <GraduationCap size={12} />
                              {alumni.graduation_year}
                            </span>
                          )}
                          {alumni.sport && (
                            <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                              <Users size={12} />
                              {alumni.sport}
                            </span>
                          )}
                          {alumni.location && (
                            <span className="inline-flex items-center gap-1 text-xs text-[--text-quaternary]">
                              <MapPin size={12} />
                              {alumni.location}
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
                            title="View LinkedIn"
                          >
                            <Linkedin size={16} />
                          </a>
                        )}

                        {addedToNetwork.has(alumni.id) ? (
                          <span className="btn-secondary text-emerald-500 cursor-default flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            Added
                          </span>
                        ) : (
                          <button
                            onClick={() => handleAddToNetwork(alumni)}
                            className="btn-primary flex items-center gap-2"
                          >
                            <UserPlus size={16} />
                            Add to Network
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Find More Alumni Button */}
                <div className="mt-6 text-center">
                  <button
                    onClick={findMoreAlumni}
                    disabled={isFindingMore}
                    className="btn-secondary flex items-center gap-2 mx-auto"
                  >
                    {isFindingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Finding more...
                      </>
                    ) : (
                      <>
                        <Users size={16} />
                        Find More Alumni
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasGenerated && !isGenerating && (
        <div className="text-center py-16">
          <div className="w-16 h-16 bg-gradient-to-br from-[--school-primary]/20 to-[--school-primary-hover]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles size={28} className="text-[--school-primary]" />
          </div>
          <h3 className="text-lg font-medium text-[--text-secondary] mb-2">
            Ready to plan your career?
          </h3>
          <p className="text-[--text-tertiary] text-sm max-w-md mx-auto">
            Enter your career interest above and Coach will generate a personalized action plan
            along with relevant Cornell athlete alumni to connect with.
          </p>
        </div>
      )}
    </main>
  )
}

// Helper function to find relevant alumni based on keywords
function findRelevantAlumni(
  interest: string,
  allAlumni: Alumni[],
  excludeIds: Set<string> = new Set()
): { alumni: Alumni; reason: string }[] {
  const interestLower = interest.toLowerCase()
  const keywords: string[] = []

  // Extract keywords based on interest
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

  // Add the interest itself as keywords
  keywords.push(...interestLower.split(' ').filter(w => w.length > 3))

  // Score and filter alumni (excluding already shown)
  const scoredAlumni = allAlumni
    .filter(alumni => !excludeIds.has(alumni.id))
    .map(alumni => {
      let score = 0
      let reason = ''
      
      const company = (alumni.company || '').toLowerCase()
      const role = (alumni.role || '').toLowerCase()
      const industry = (alumni.industry || '').toLowerCase()

      for (const keyword of keywords) {
        if (company.includes(keyword)) {
          score += 3
          reason = `Works at ${alumni.company}`
        }
        if (role.includes(keyword)) {
          score += 2
          if (!reason) reason = `${alumni.role} role is relevant`
        }
        if (industry.includes(keyword)) {
          score += 2
          if (!reason) reason = `Works in ${alumni.industry}`
        }
      }

      // Bonus for having both company and role
      if (alumni.company && alumni.role) score += 1
      
      // Bonus for recent grads (more relatable)
      if (alumni.graduation_year && alumni.graduation_year >= 2015) score += 1

      if (!reason && score > 0) {
        reason = `Background aligns with ${interest}`
      }

      return { alumni, score, reason }
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)

  return scoredAlumni.map(({ alumni, reason }) => ({ alumni, reason }))
}