'use client'

import { useState, useEffect } from 'react'
import { 
  Flame, 
  Trophy, 
  Target, 
  Zap, 
  Star, 
  Lock,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  TrendingUp,
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
  bronze: 'from-amber-700 to-amber-500',
  silver: 'from-gray-400 to-gray-300',
  gold: 'from-yellow-500 to-yellow-300',
  platinum: 'from-purple-500 to-pink-400',
}

const tierBgColors = {
  bronze: 'bg-amber-500/10 border-amber-500/30',
  silver: 'bg-gray-400/10 border-gray-400/30',
  gold: 'bg-yellow-500/10 border-yellow-500/30',
  platinum: 'bg-purple-500/10 border-purple-500/30',
}

export default function CareerPathClient({
  userId,
  stats,
  allAchievements,
  unlockedAchievementIds,
  dailyGoal,
}: CareerPathClientProps) {
  const [showCelebration, setShowCelebration] = useState(false)
  const [animatedXp, setAnimatedXp] = useState(0)
  
  const currentStreak = stats.current_streak || 0
  const longestStreak = stats.longest_streak || 0
  const totalXp = stats.total_xp || 0
  const currentLevel = stats.current_level || 1
  const totalConnections = stats.total_connections || 0
  const totalMessages = stats.total_messages_sent || 0

  // Animate XP counter on mount
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

  // Group achievements by type
  const achievementsByType = {
    streak: allAchievements.filter(a => a.requirement_type === 'streak'),
    connections: allAchievements.filter(a => a.requirement_type === 'connections'),
    messages: allAchievements.filter(a => a.requirement_type === 'messages'),
  }

  const renderAchievementPath = (achievements: Achievement[], currentValue: number, icon: React.ReactNode, title: string) => (
    <div className="glass-card p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className="text-white/50 text-sm ml-auto">{currentValue} completed</span>
      </div>
      
      <div className="relative">
        {/* Connection line */}
        <div className="absolute top-8 left-8 right-8 h-1 bg-white/10 rounded-full" />
        <div 
          className="absolute top-8 left-8 h-1 bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000"
          style={{ 
            width: `${Math.min(100, (currentValue / achievements[achievements.length - 1]?.requirement_value || 1) * 100)}%`,
            maxWidth: 'calc(100% - 64px)'
          }}
        />
        
        {/* Nodes */}
        <div className="flex justify-between relative z-10">
          {achievements.map((achievement, index) => {
            const isUnlocked = unlockedAchievementIds.includes(achievement.id)
            const isNext = !isUnlocked && (index === 0 || unlockedAchievementIds.includes(achievements[index - 1]?.id))
            const progress = Math.min(100, (currentValue / achievement.requirement_value) * 100)
            
            return (
              <div 
                key={achievement.id}
                className={`flex flex-col items-center ${index === 0 ? '' : ''}`}
              >
                {/* Node */}
                <div 
                  className={`
                    relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl
                    transition-all duration-500 cursor-pointer group
                    ${isUnlocked 
                      ? `bg-gradient-to-br ${tierColors[achievement.tier]} shadow-lg path-node completed` 
                      : isNext 
                        ? 'bg-white/10 border-2 border-white/30 path-node current'
                        : 'bg-white/5 border border-white/10 path-node locked'
                    }
                  `}
                >
                  {isUnlocked ? (
                    <span className="animate-bounce">{achievement.icon}</span>
                  ) : isNext ? (
                    <div className="relative">
                      <span className="opacity-50">{achievement.icon}</span>
                      <div 
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: `conic-gradient(from 0deg, rgba(255,255,255,0.3) ${progress}%, transparent ${progress}%)`,
                          borderRadius: '16px',
                        }}
                      />
                    </div>
                  ) : (
                    <Lock size={20} className="text-white/30" />
                  )}
                  
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    <div className="bg-gray-900 border border-white/20 rounded-xl p-3 min-w-[180px] text-center shadow-xl">
                      <p className="font-semibold text-sm mb-1">{achievement.name}</p>
                      <p className="text-white/60 text-xs mb-2">{achievement.description}</p>
                      <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs">
                        <Zap size={12} />
                        +{achievement.xp_reward} XP
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Label */}
                <span className={`mt-2 text-xs font-medium ${isUnlocked ? 'text-white' : 'text-white/40'}`}>
                  {achievement.requirement_value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <main className="px-6 md:px-12 py-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10 animate-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-bold font-display mb-3 tracking-tight">
          Career Path
        </h1>
        <p className="text-white/50 text-lg max-w-xl">
          Track your networking journey, maintain your streak, and unlock achievements.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {/* Streak */}
        <div className="glass-card p-5 animate-fade-in-up stagger-1 opacity-0">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2.5 rounded-xl ${currentStreak > 0 ? 'streak-counter' : 'bg-white/10'}`}>
              <Flame size={22} className={currentStreak > 0 ? 'streak-fire text-white' : 'text-white/50'} />
            </div>
            <div>
              <p className="text-white/50 text-xs">Current Streak</p>
              <p className="text-2xl font-bold">{currentStreak} <span className="text-sm font-normal text-white/50">days</span></p>
            </div>
          </div>
          {currentStreak > 0 && (
            <p className="text-xs text-amber-400">
              🔥 Keep it going! Best: {longestStreak} days
            </p>
          )}
        </div>

        {/* Level & XP */}
        <div className="glass-card p-5 animate-fade-in-up stagger-2 opacity-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="level-badge p-2.5 rounded-xl">
              <Star size={22} className="text-white" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Level</p>
              <p className="text-2xl font-bold">{currentLevel}</p>
            </div>
          </div>
          <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="xp-bar h-full rounded-full transition-all duration-1000"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1">{animatedXp.toLocaleString()} XP</p>
        </div>

        {/* Connections */}
        <div className="glass-card p-5 animate-fade-in-up stagger-3 opacity-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-500/20 p-2.5 rounded-xl">
              <Users size={22} className="text-blue-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Connections</p>
              <p className="text-2xl font-bold">{totalConnections}</p>
            </div>
          </div>
          <Link href="/network" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
            View network <ChevronRight size={12} />
          </Link>
        </div>

        {/* Messages */}
        <div className="glass-card p-5 animate-fade-in-up stagger-4 opacity-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-green-500/20 p-2.5 rounded-xl">
              <MessageSquare size={22} className="text-green-400" />
            </div>
            <div>
              <p className="text-white/50 text-xs">Messages Sent</p>
              <p className="text-2xl font-bold">{totalMessages}</p>
            </div>
          </div>
          <p className="text-xs text-white/40">Keep reaching out!</p>
        </div>
      </div>

      {/* Daily Goals */}
      <div className="glass-card p-6 mb-10 animate-fade-in-up stagger-5 opacity-0">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-orange-500 to-pink-500 p-2.5 rounded-xl">
              <Target size={22} className="text-white" />
            </div>
            <div>
              <h3 className="font-semibold">Today's Goals</h3>
              <p className="text-white/50 text-sm">Complete daily tasks to maintain your streak</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">
              <Calendar size={12} className="inline mr-1" />
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Connection Goal */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-blue-400" />
                <span className="text-sm font-medium">Add connections</span>
              </div>
              <span className="text-sm text-white/50">
                {dailyGoal?.connections_made || 0} / {dailyGoal?.connections_goal || 3}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, ((dailyGoal?.connections_made || 0) / (dailyGoal?.connections_goal || 3)) * 100)}%` 
                }}
              />
            </div>
          </div>

          {/* Message Goal */}
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-green-400" />
                <span className="text-sm font-medium">Send messages</span>
              </div>
              <span className="text-sm text-white/50">
                {dailyGoal?.messages_sent || 0} / {dailyGoal?.messages_goal || 2}
              </span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-500"
                style={{ 
                  width: `${Math.min(100, ((dailyGoal?.messages_sent || 0) / (dailyGoal?.messages_goal || 2)) * 100)}%` 
                }}
              />
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-6 flex gap-3">
          <Link 
            href="/discover"
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <Sparkles size={18} />
            Find Alumni to Connect
          </Link>
          <Link 
            href="/network"
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <MessageSquare size={18} />
            Message Your Network
          </Link>
        </div>
      </div>

      {/* Achievement Paths */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold font-display mb-6 flex items-center gap-3">
          <Trophy className="text-yellow-400" />
          Achievement Paths
        </h2>

        {renderAchievementPath(
          achievementsByType.streak,
          currentStreak,
          <Flame className="text-orange-400" size={24} />,
          'Streak Master'
        )}

        {renderAchievementPath(
          achievementsByType.connections,
          totalConnections,
          <Users className="text-blue-400" size={24} />,
          'Network Builder'
        )}

        {renderAchievementPath(
          achievementsByType.messages,
          totalMessages,
          <MessageSquare className="text-green-400" size={24} />,
          'Outreach Pro'
        )}
      </div>

      {/* All Achievements Grid */}
      <div className="glass-card p-6">
        <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
          <Award className="text-purple-400" />
          All Achievements
          <span className="text-white/50 text-sm font-normal ml-auto">
            {unlockedAchievementIds.length} / {allAchievements.length} unlocked
          </span>
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {allAchievements.map((achievement) => {
            const isUnlocked = unlockedAchievementIds.includes(achievement.id)
            
            return (
              <div 
                key={achievement.id}
                className={`
                  p-4 rounded-xl border transition-all duration-300
                  ${isUnlocked 
                    ? tierBgColors[achievement.tier]
                    : 'bg-white/5 border-white/10 opacity-50 grayscale'
                  }
                `}
              >
                <div className="text-3xl mb-2">
                  {isUnlocked ? achievement.icon : '🔒'}
                </div>
                <p className="font-medium text-sm mb-1">{achievement.name}</p>
                <p className="text-white/50 text-xs mb-2">{achievement.description}</p>
                <div className="flex items-center gap-1 text-yellow-400 text-xs">
                  <Zap size={12} />
                  +{achievement.xp_reward} XP
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
