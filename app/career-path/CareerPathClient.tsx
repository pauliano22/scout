'use client'

import { useState, useEffect } from 'react'
import { 
  Flame, 
  Trophy, 
  Target, 
  Zap, 
  Star, 
  Lock,
  ChevronRight,
  Sparkles,
  Calendar,
  Users,
  MessageSquare,
  Award
} from 'lucide-react'
import Link from 'next/link'
import { Achievement, UserStats, DailyGoal, getXpProgress } from '@/types/database'

interface CareerPathClientProps {
  userId: string
  stats: Partial<UserStats>
  allAchievements: Achievement[]
  unlockedAchievementIds: string[]
  dailyGoal: DailyGoal | null
}

const tierColors = {
  bronze: 'border-amber-600 bg-amber-500/10',
  silver: 'border-gray-400 bg-gray-400/10',
  gold: 'border-yellow-500 bg-yellow-500/10',
  platinum: 'border-purple-400 bg-purple-500/10',
}

export default function CareerPathClient({
  userId,
  stats,
  allAchievements,
  unlockedAchievementIds,
  dailyGoal,
}: CareerPathClientProps) {
  const [animatedXp, setAnimatedXp] = useState(0)
  
  const currentStreak = stats.current_streak || 0
  const longestStreak = stats.longest_streak || 0
  const totalXp = stats.total_xp || 0
  const currentLevel = stats.current_level || 1
  const totalConnections = stats.total_connections || 0
  const totalMessages = stats.total_messages_sent || 0

  useEffect(() => {
    const duration = 1500
    const steps = 60
    const increment = totalXp / steps
    let current = 0
    
    const timer = setInterval(() => {
      current += increment
      if (current >= totalXp) {
        setAnimatedXp(totalXp)
        clearInterval(timer)
      } else {
        setAnimatedXp(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [totalXp])

  const xpProgress = getXpProgress(totalXp, currentLevel)

  // Sort achievements by requirement_value within each type
  const achievementsByType = {
    streak: allAchievements
      .filter(a => a.requirement_type === 'streak')
      .sort((a, b) => a.requirement_value - b.requirement_value),
    connections: allAchievements
      .filter(a => a.requirement_type === 'connections')
      .sort((a, b) => a.requirement_value - b.requirement_value),
    messages: allAchievements
      .filter(a => a.requirement_type === 'messages')
      .sort((a, b) => a.requirement_value - b.requirement_value),
  }

  const renderAchievementPath = (achievements: Achievement[], currentValue: number, icon: React.ReactNode, title: string) => {
    if (achievements.length === 0) return null
    
    // Find where we are in the progression
    const maxValue = achievements[achievements.length - 1]?.requirement_value || 1
    const completedCount = achievements.filter(a => currentValue >= a.requirement_value).length
    
    // Calculate progress percentage based on milestones, not raw value
    // This makes the line stop AT milestones rather than between them
    let progressPercent = 0
    if (achievements.length > 1) {
      const nodeWidth = 100 / (achievements.length - 1)
      for (let i = 0; i < achievements.length; i++) {
        if (currentValue >= achievements[i].requirement_value) {
          progressPercent = i * nodeWidth
        } else if (i > 0) {
          // Partial progress between last completed and next
          const prevValue = achievements[i - 1].requirement_value
          const nextValue = achievements[i].requirement_value
          const partialProgress = (currentValue - prevValue) / (nextValue - prevValue)
          progressPercent = ((i - 1) + partialProgress) * nodeWidth
          break
        } else {
          // Haven't reached first milestone
          const partialProgress = currentValue / achievements[0].requirement_value
          progressPercent = partialProgress * nodeWidth * 0.5 // Only go halfway to first node
          break
        }
      }
    }
    
    return (
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-4">
        <div className="flex items-center gap-3 mb-5">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-[--text-quaternary] text-xs ml-auto">{completedCount} completed</span>
        </div>
        
        <div className="relative">
          {/* Connection line - background */}
          <div className="absolute top-6 left-6 right-6 h-0.5 bg-[--border-primary] rounded-full" />
          {/* Connection line - progress */}
          <div 
            className="absolute top-6 left-6 h-0.5 bg-emerald-500 rounded-full transition-all duration-1000"
            style={{ 
              width: `calc(${Math.min(100, progressPercent)}% * (100% - 48px) / 100)`,
            }}
          />
          
          {/* Nodes */}
          <div className="flex justify-between relative z-10">
            {achievements.map((achievement, index) => {
              // Check if unlocked based on actual current value, not just database
              const isUnlocked = currentValue >= achievement.requirement_value
              const isInDatabase = unlockedAchievementIds.includes(achievement.id)
              const isNext = !isUnlocked && (index === 0 || currentValue >= achievements[index - 1]?.requirement_value)
              
              return (
                <div key={achievement.id} className="flex flex-col items-center">
                  <div 
                    className={`
                      relative w-12 h-12 rounded-lg flex items-center justify-center text-lg
                      transition-all cursor-pointer group border
                      ${isUnlocked 
                        ? tierColors[achievement.tier]
                        : isNext 
                          ? 'bg-[--bg-tertiary] border-[--border-secondary]'
                          : 'bg-[--bg-secondary] border-[--border-primary] opacity-40'
                      }
                    `}
                  >
                    {isUnlocked ? (
                      <span>{achievement.icon}</span>
                    ) : isNext ? (
                      <span className="opacity-50">{achievement.icon}</span>
                    ) : (
                      <Lock size={16} className="text-[--text-quaternary]" />
                    )}
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                      <div className="bg-[--bg-tertiary] border border-[--border-primary] rounded-lg p-3 min-w-[160px] text-center shadow-lg">
                        <p className="font-medium text-xs mb-1">{achievement.name}</p>
                        <p className="text-[--text-tertiary] text-xs mb-2">{achievement.description}</p>
                        {isUnlocked ? (
                          <div className="flex items-center justify-center gap-1 text-emerald-400 text-xs">
                            <span>✓ Unlocked!</span>
                          </div>
                        ) : (
                          <>
                            <p className="text-[--text-quaternary] text-xs mb-1">
                              {currentValue} / {achievement.requirement_value}
                            </p>
                            <div className="flex items-center justify-center gap-1 text-amber-400 text-xs">
                              <Zap size={10} />
                              +{achievement.xp_reward} XP
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <span className={`mt-2 text-xs ${isUnlocked ? 'text-[--text-secondary]' : 'text-[--text-quaternary]'}`}>
                    {achievement.requirement_value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Career Path
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Track your networking journey, maintain your streak, and unlock achievements.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {/* Streak */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-lg ${currentStreak > 0 ? 'bg-amber-500/10' : 'bg-[--bg-tertiary]'}`}>
              <Flame size={18} className={currentStreak > 0 ? 'text-amber-400' : 'text-[--text-quaternary]'} />
            </div>
            <div>
              <p className="text-[--text-quaternary] text-xs">Streak</p>
              <p className="text-lg font-semibold">{currentStreak}d</p>
            </div>
          </div>
          {currentStreak > 0 && (
            <p className="text-xs text-[--text-tertiary]">Best: {longestStreak}d</p>
          )}
        </div>

        {/* Level & XP */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Star size={18} className="text-purple-400" />
            </div>
            <div>
              <p className="text-[--text-quaternary] text-xs">Level</p>
              <p className="text-lg font-semibold">{currentLevel}</p>
            </div>
          </div>
          <div className="relative h-1.5 bg-[--border-primary] rounded-full overflow-hidden">
            <div 
              className="bg-purple-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-xs text-[--text-quaternary] mt-1">{animatedXp.toLocaleString()} XP</p>
        </div>

        {/* Connections */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Users size={18} className="text-blue-400" />
            </div>
            <div>
              <p className="text-[--text-quaternary] text-xs">Connections</p>
              <p className="text-lg font-semibold">{totalConnections}</p>
            </div>
          </div>
          <Link href="/network" className="text-xs text-blue-400 hover:underline flex items-center gap-0.5">
            View <ChevronRight size={10} />
          </Link>
        </div>

        {/* Messages */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <MessageSquare size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[--text-quaternary] text-xs">Messages</p>
              <p className="text-lg font-semibold">{totalMessages}</p>
            </div>
          </div>
          <p className="text-xs text-[--text-quaternary]">Keep going!</p>
        </div>
      </div>

      {/* Daily Goals */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[--school-primary]/10">
              <Target size={18} className="text-[--school-primary]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Today's Goals</h3>
              <p className="text-[--text-quaternary] text-xs">Complete daily tasks to maintain your streak</p>
            </div>
          </div>
          <p className="text-xs text-[--text-quaternary]">
            <Calendar size={10} className="inline mr-1" />
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {/* Connection Goal */}
          <div className="bg-[--bg-primary] rounded-lg p-4 border border-[--border-primary]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-blue-400" />
                <span className="text-sm">Add connections</span>
              </div>
              <span className="text-xs text-[--text-quaternary]">
                {dailyGoal?.connections_made || 0} / {dailyGoal?.connections_goal || 3}
              </span>
            </div>
            <div className="h-1.5 bg-[--border-primary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(100, ((dailyGoal?.connections_made || 0) / (dailyGoal?.connections_goal || 3)) * 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Message Goal */}
          <div className="bg-[--bg-primary] rounded-lg p-4 border border-[--border-primary]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MessageSquare size={14} className="text-emerald-400" />
                <span className="text-sm">Send messages</span>
              </div>
              <span className="text-xs text-[--text-quaternary]">
                {dailyGoal?.messages_sent || 0} / {dailyGoal?.messages_goal || 2}
              </span>
            </div>
            <div className="h-1.5 bg-[--border-primary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ 
                  width: `${Math.min(100, ((dailyGoal?.messages_sent || 0) / (dailyGoal?.messages_goal || 2)) * 100)}%` 
                }}
              />
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <Link 
            href="/discover"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Sparkles size={16} />
            Find Alumni
          </Link>
          <Link 
            href="/network"
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <MessageSquare size={16} />
            Message Network
          </Link>
        </div>
      </div>

      {/* Achievement Paths */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Trophy size={18} className="text-amber-400" />
          Achievement Paths
        </h2>

        {renderAchievementPath(
          achievementsByType.streak,
          currentStreak,
          <Flame className="text-amber-400" size={18} />,
          'Streak Master'
        )}

        {renderAchievementPath(
          achievementsByType.connections,
          totalConnections,
          <Users className="text-blue-400" size={18} />,
          'Network Builder'
        )}

        {renderAchievementPath(
          achievementsByType.messages,
          totalMessages,
          <MessageSquare className="text-emerald-400" size={18} />,
          'Outreach Pro'
        )}
      </div>

      {/* All Achievements Grid */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Award size={16} className="text-purple-400" />
          All Achievements
          <span className="text-[--text-quaternary] text-xs font-normal ml-auto">
            {unlockedAchievementIds.length} / {allAchievements.length}
          </span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {allAchievements.map((achievement) => {
            const isUnlocked = unlockedAchievementIds.includes(achievement.id)
            
            return (
              <div 
                key={achievement.id}
                className={`
                  p-3 rounded-lg border transition-colors
                  ${isUnlocked 
                    ? tierColors[achievement.tier]
                    : 'bg-[--bg-primary] border-[--border-primary] opacity-40'
                  }
                `}
              >
                <div className="text-2xl mb-2">
                  {isUnlocked ? achievement.icon : '🔒'}
                </div>
                <p className="font-medium text-xs mb-0.5">{achievement.name}</p>
                <p className="text-[--text-quaternary] text-xs mb-2">{achievement.description}</p>
                <div className="flex items-center gap-1 text-amber-400 text-xs">
                  <Zap size={10} />
                  +{achievement.xp_reward}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}