'use client'

import { useState } from 'react'
import Link from '@/components/Link'
import { createClient } from '@/lib/supabase/client'
import {
  Sparkles,
  Users,
  MessageSquare,
  CheckCircle2,
  Check,
  ChevronRight,
  Clock,
  UserPlus,
  Send,
  Target
} from 'lucide-react'

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

interface DashboardClientProps {
  userId: string
  userName: string
  plans: Plan[]
  networkCount: number
  messagesCount: number
  recentActivity: ActivityItem[]
}

export default function DashboardClient({
  userId,
  userName,
  plans,
  networkCount,
  messagesCount,
  recentActivity
}: DashboardClientProps) {
  const supabase = createClient()
  const [localPlans, setLocalPlans] = useState<Plan[]>(plans)

  const toggleActionItem = async (planId: string, actionIndex: number) => {
    // Update local state
    setLocalPlans(prev => prev.map(plan => {
      if (plan.id !== planId) return plan

      const newActionItems = plan.action_items.map((item, i) =>
        i === actionIndex ? { ...item, completed: !item.completed } : item
      )
      return { ...plan, action_items: newActionItems }
    }))

    // Update in database
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

  return (
    <main className="px-6 md:px-12 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-2">
          Welcome back, {userName.split(' ')[0]}
        </h1>
        <p className="text-[--text-tertiary]">
          Here's your career progress at a glance.
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
        {/* Career Plans */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium">Your Career Plans</h2>
            <Link href="/coach" className="text-sm text-[--school-primary] hover:underline flex items-center gap-1">
              Create new
              <ChevronRight size={14} />
            </Link>
          </div>

          {localPlans.length === 0 ? (
            <div className="card p-8 text-center">
              <div className="w-14 h-14 bg-gradient-to-br from-[--school-primary]/20 to-[--school-primary-hover]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={24} className="text-[--school-primary]" />
              </div>
              <h3 className="font-medium mb-2">No plans yet</h3>
              <p className="text-sm text-[--text-tertiary] mb-4">
                Get personalized career guidance from Coach
              </p>
              <Link href="/coach" className="btn-primary inline-flex items-center gap-2">
                <Sparkles size={16} />
                Start with Coach
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {localPlans.map((plan) => {
                const completion = getCompletionPercentage(plan)
                return (
                  <div key={plan.id} className="card p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-medium">{plan.interest}</h3>
                        <p className="text-xs text-[--text-quaternary] mt-1">
                          Created {formatDate(plan.created_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium text-[--text-secondary]">{completion}%</div>
                        <div className="w-20 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-300"
                            style={{ width: `${completion}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {plan.action_items?.slice(0, 4).map((item, index) => (
                        <button
                          key={index}
                          onClick={() => toggleActionItem(plan.id, index)}
                          className="w-full flex items-start gap-3 text-left group p-2 rounded-lg hover:bg-[--bg-tertiary] transition-colors"
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
                      ))}
                      {plan.action_items?.length > 4 && (
                        <p className="text-xs text-[--text-quaternary] pl-8">
                          +{plan.action_items.length - 4} more items
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div>
          <h2 className="text-lg font-medium mb-4">Recent Activity</h2>
          <div className="card p-4">
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
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      item.type === 'network_add'
                        ? 'bg-emerald-500/10'
                        : 'bg-blue-500/10'
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
                          <>Added <span className="font-medium text-[--text-primary]">{item.alumniName}</span> to network</>
                        ) : (
                          <>Sent message to <span className="font-medium text-[--text-primary]">{item.alumniName}</span></>
                        )}
                      </p>
                      <p className="text-xs text-[--text-quaternary]">{formatDate(item.date)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-6">
            <h2 className="text-lg font-medium mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link
                href="/coach"
                className="card p-4 flex items-center gap-3 hover:border-[--school-primary]/50 transition-colors"
              >
                <div className="w-10 h-10 bg-[--school-primary]/10 rounded-xl flex items-center justify-center">
                  <Sparkles size={18} className="text-[--school-primary]" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Get Career Advice</div>
                  <div className="text-xs text-[--text-quaternary]">Talk to Coach</div>
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
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
