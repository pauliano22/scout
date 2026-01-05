'use client'

import { 
  Flame, 
  Users,
  MessageSquare,
  ChevronRight,
  Sparkles,
  Trophy,
  Target,
  Lock,
  Calendar
} from 'lucide-react'
import Link from '@/components/Link'

interface CareerPathClientProps {
  userId: string
  stats: {
    current_streak?: number
    longest_streak?: number
    total_connections?: number
    total_messages_sent?: number
  }
  dailyGoals?: {
    connections_goal: number
    connections_made: number
    messages_goal: number
    messages_sent: number
  }
}

export default function CareerPathClient({
  userId,
  stats,
  dailyGoals,
}: CareerPathClientProps) {
  const currentStreak = stats.current_streak || 0
  const longestStreak = stats.longest_streak || 0
  const totalConnections = stats.total_connections || 0
  const totalMessages = stats.total_messages_sent || 0

  // Daily goals with defaults
  const goals = dailyGoals || {
    connections_goal: 3,
    connections_made: 0,
    messages_goal: 2,
    messages_sent: 0,
  }

  // Achievement path milestones
  const streakMilestones = [3, 7, 14, 30]
  const connectionMilestones = [5, 15, 25, 30, 50, 100]
  const messageMilestones = [3, 5, 10, 25, 50, 100]

  const getCompletedCount = (value: number, milestones: number[]) => {
    return milestones.filter(m => value >= m).length
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  return (
    <main className="px-6 md:px-12 py-10 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Career Path
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Track your networking journey, maintain your streak, and unlock achievements.
        </p>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Streak */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${currentStreak > 0 ? 'bg-amber-500/10' : 'bg-[--bg-tertiary]'}`}>
              <Flame size={18} className={currentStreak > 0 ? 'text-amber-400' : 'text-[--text-quaternary]'} />
            </div>
            <div>
              <p className="text-[--text-tertiary] text-xs">Streak</p>
              <p className="text-xl font-semibold">{currentStreak}d</p>
            </div>
          </div>
          {longestStreak > 0 && (
            <p className="text-[--text-quaternary] text-xs">Best: {longestStreak}d</p>
          )}
        </div>

        {/* Connections */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[--text-tertiary] text-xs">Connections</p>
              <p className="text-xl font-semibold">{totalConnections}</p>
            </div>
          </div>
          <Link href="/network" className="text-blue-400 text-xs flex items-center gap-1 hover:underline">
            View <ChevronRight size={12} />
          </Link>
        </div>

        {/* Messages */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MessageSquare size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[--text-tertiary] text-xs">Messages</p>
              <p className="text-xl font-semibold">{totalMessages}</p>
            </div>
          </div>
          <p className="text-[--text-quaternary] text-xs">Keep going!</p>
        </div>
      </div>

      {/* Today's Goals */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[--school-primary]/10">
              <Target size={18} className="text-[--school-primary]" />
            </div>
            <div>
              <h2 className="font-semibold">Today's Goals</h2>
              <p className="text-[--text-quaternary] text-xs">Complete daily tasks to maintain your streak</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[--text-quaternary] text-xs">
            <Calendar size={12} />
            {today}
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Connections Goal */}
          <div className="bg-[--bg-tertiary] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-400" />
                <span className="text-sm">Add connections</span>
              </div>
              <span className="text-[--text-quaternary] text-sm">
                {goals.connections_made} / {goals.connections_goal}
              </span>
            </div>
            <div className="h-2 bg-[--bg-primary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (goals.connections_made / goals.connections_goal) * 100)}%` }}
              />
            </div>
          </div>

          {/* Messages Goal */}
          <div className="bg-[--bg-tertiary] rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-400" />
                <span className="text-sm">Send messages</span>
              </div>
              <span className="text-[--text-quaternary] text-sm">
                {goals.messages_sent} / {goals.messages_goal}
              </span>
            </div>
            <div className="h-2 bg-[--bg-primary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (goals.messages_sent / goals.messages_goal) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <Link 
            href="/discover"
            className="btn-primary flex items-center justify-center gap-2 py-2.5"
          >
            <Sparkles size={16} />
            Find Alumni
          </Link>
          <Link 
            href="/network"
            className="btn-secondary flex items-center justify-center gap-2 py-2.5"
          >
            <MessageSquare size={16} />
            Message Network
          </Link>
        </div>
      </div>

      {/* Achievement Paths */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Trophy size={18} className="text-amber-400" />
          <h2 className="font-semibold">Achievement Paths</h2>
        </div>

        <div className="space-y-4">
          {/* Streak Master */}
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame size={16} className="text-amber-400" />
                <span className="font-medium">Streak Master</span>
              </div>
              <span className="text-[--text-quaternary] text-xs">
                {getCompletedCount(currentStreak, streakMilestones)} completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              {streakMilestones.map((milestone, index) => {
                const isCompleted = currentStreak >= milestone
                const isNext = !isCompleted && (index === 0 || currentStreak >= streakMilestones[index - 1])
                return (
                  <div key={milestone} className="flex items-center flex-1">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center text-lg
                      ${isCompleted 
                        ? 'bg-amber-500/20 border-2 border-amber-500' 
                        : isNext
                          ? 'bg-[--bg-tertiary] border-2 border-[--border-secondary]'
                          : 'bg-[--bg-tertiary] border border-[--border-primary]'
                      }
                    `}>
                      {isCompleted ? (
                        <Flame size={20} className="text-amber-400" />
                      ) : (
                        <Lock size={16} className="text-[--text-quaternary]" />
                      )}
                    </div>
                    {index < streakMilestones.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${
                        currentStreak >= streakMilestones[index + 1] 
                          ? 'bg-amber-500/50' 
                          : 'bg-[--border-primary]'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              {streakMilestones.map(milestone => (
                <span key={milestone} className="text-xs text-[--text-quaternary] w-12 text-center">
                  {milestone}
                </span>
              ))}
            </div>
          </div>

          {/* Network Builder */}
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-400" />
                <span className="font-medium">Network Builder</span>
              </div>
              <span className="text-[--text-quaternary] text-xs">
                {getCompletedCount(totalConnections, connectionMilestones)} completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              {connectionMilestones.map((milestone, index) => {
                const isCompleted = totalConnections >= milestone
                const isNext = !isCompleted && (index === 0 || totalConnections >= connectionMilestones[index - 1])
                return (
                  <div key={milestone} className="flex items-center flex-1">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center text-lg
                      ${isCompleted 
                        ? 'bg-blue-500/20 border-2 border-blue-500' 
                        : isNext
                          ? 'bg-[--bg-tertiary] border-2 border-[--border-secondary]'
                          : 'bg-[--bg-tertiary] border border-[--border-primary]'
                      }
                    `}>
                      {isCompleted ? (
                        <Users size={20} className="text-blue-400" />
                      ) : (
                        <Lock size={16} className="text-[--text-quaternary]" />
                      )}
                    </div>
                    {index < connectionMilestones.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${
                        totalConnections >= connectionMilestones[index + 1] 
                          ? 'bg-blue-500/50' 
                          : 'bg-[--border-primary]'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              {connectionMilestones.map(milestone => (
                <span key={milestone} className="text-xs text-[--text-quaternary] w-12 text-center">
                  {milestone}
                </span>
              ))}
            </div>
          </div>

          {/* Outreach Pro */}
          <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-400" />
                <span className="font-medium">Outreach Pro</span>
              </div>
              <span className="text-[--text-quaternary] text-xs">
                {getCompletedCount(totalMessages, messageMilestones)} completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              {messageMilestones.map((milestone, index) => {
                const isCompleted = totalMessages >= milestone
                const isNext = !isCompleted && (index === 0 || totalMessages >= messageMilestones[index - 1])
                return (
                  <div key={milestone} className="flex items-center flex-1">
                    <div className={`
                      w-12 h-12 rounded-lg flex items-center justify-center text-lg
                      ${isCompleted 
                        ? 'bg-emerald-500/20 border-2 border-emerald-500' 
                        : isNext
                          ? 'bg-[--bg-tertiary] border-2 border-[--border-secondary]'
                          : 'bg-[--bg-tertiary] border border-[--border-primary]'
                      }
                    `}>
                      {isCompleted ? (
                        <MessageSquare size={20} className="text-emerald-400" />
                      ) : (
                        <Lock size={16} className="text-[--text-quaternary]" />
                      )}
                    </div>
                    {index < messageMilestones.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-1 ${
                        totalMessages >= messageMilestones[index + 1] 
                          ? 'bg-emerald-500/50' 
                          : 'bg-[--border-primary]'
                      }`} />
                    )}
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-2">
              {messageMilestones.map(milestone => (
                <span key={milestone} className="text-xs text-[--text-quaternary] w-12 text-center">
                  {milestone}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}