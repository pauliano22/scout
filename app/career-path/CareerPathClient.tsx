'use client'

import { 
  Flame, 
  Users,
  MessageSquare,
  ChevronRight,
  Sparkles,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'

interface CareerPathClientProps {
  userId: string
  stats: {
    current_streak?: number
    longest_streak?: number
    total_connections?: number
    total_messages_sent?: number
  }
}

export default function CareerPathClient({
  userId,
  stats,
}: CareerPathClientProps) {
  const currentStreak = stats.current_streak || 0
  const longestStreak = stats.longest_streak || 0
  const totalConnections = stats.total_connections || 0
  const totalMessages = stats.total_messages_sent || 0

  // Simple milestones for progress bars
  const connectionMilestones = [10, 25, 50, 100, 250]
  const messageMilestones = [5, 15, 30, 50, 100]
  const streakMilestones = [3, 7, 14, 30, 60]

  const getProgress = (value: number, milestones: number[]) => {
    const nextMilestone = milestones.find(m => value < m) || milestones[milestones.length - 1]
    const prevMilestone = milestones[milestones.indexOf(nextMilestone) - 1] || 0
    const progress = ((value - prevMilestone) / (nextMilestone - prevMilestone)) * 100
    return { progress: Math.min(100, Math.max(0, progress)), nextMilestone }
  }

  const connectionProgress = getProgress(totalConnections, connectionMilestones)
  const messageProgress = getProgress(totalMessages, messageMilestones)
  const streakProgress = getProgress(currentStreak, streakMilestones)

  return (
    <main className="px-6 md:px-12 py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2 tracking-tight">
          Your Progress
        </h1>
        <p className="text-[--text-tertiary] text-sm">
          Track your networking journey and build meaningful connections.
        </p>
      </div>

      {/* Main Stats Cards */}
      <div className="space-y-4 mb-8">
        {/* Connections Card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Users size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[--text-tertiary] text-xs">Connections</p>
                <p className="text-2xl font-semibold">{totalConnections}</p>
              </div>
            </div>
            <Link 
              href="/network" 
              className="btn-ghost text-sm flex items-center gap-1 text-blue-400"
            >
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[--text-quaternary]">
              <span>Progress to {connectionProgress.nextMilestone}</span>
              <span>{totalConnections} / {connectionProgress.nextMilestone}</span>
            </div>
            <div className="h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${connectionProgress.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Messages Card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-500/10">
                <MessageSquare size={20} className="text-emerald-400" />
              </div>
              <div>
                <p className="text-[--text-tertiary] text-xs">Messages Sent</p>
                <p className="text-2xl font-semibold">{totalMessages}</p>
              </div>
            </div>
            <Link 
              href="/network" 
              className="btn-ghost text-sm flex items-center gap-1 text-emerald-400"
            >
              Send more <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-[--text-quaternary]">
              <span>Progress to {messageProgress.nextMilestone}</span>
              <span>{totalMessages} / {messageProgress.nextMilestone}</span>
            </div>
            <div className="h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${messageProgress.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Streak Card */}
        <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${currentStreak > 0 ? 'bg-amber-500/10' : 'bg-[--bg-tertiary]'}`}>
                <Flame size={20} className={currentStreak > 0 ? 'text-amber-400' : 'text-[--text-quaternary]'} />
              </div>
              <div>
                <p className="text-[--text-tertiary] text-xs">Daily Streak</p>
                <p className="text-2xl font-semibold">{currentStreak} <span className="text-base font-normal text-[--text-tertiary]">days</span></p>
              </div>
            </div>
            {longestStreak > 0 && (
              <div className="text-right">
                <p className="text-[--text-quaternary] text-xs">Best</p>
                <p className="text-sm font-medium">{longestStreak}d</p>
              </div>
            )}
          </div>
          {currentStreak > 0 ? (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-[--text-quaternary]">
                <span>Next milestone: {streakProgress.nextMilestone} days</span>
                <span>{currentStreak} / {streakProgress.nextMilestone}</span>
              </div>
              <div className="h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${streakProgress.progress}%` }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[--text-quaternary] text-sm">
              Add a connection or send a message today to start your streak!
            </p>
          )}
        </div>
      </div>

      {/* Quick Stats Summary */}
      <div className="bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-[--school-primary]" />
          <h2 className="font-semibold">Summary</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-semibold text-blue-400">{totalConnections}</p>
            <p className="text-xs text-[--text-tertiary]">Connections</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-emerald-400">{totalMessages}</p>
            <p className="text-xs text-[--text-tertiary]">Messages</p>
          </div>
          <div>
            <p className="text-2xl font-semibold text-amber-400">{currentStreak}</p>
            <p className="text-xs text-[--text-tertiary]">Day Streak</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Link 
          href="/discover"
          className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
        >
          <Sparkles size={18} />
          Find Alumni
        </Link>
        <Link 
          href="/network"
          className="btn-secondary flex-1 flex items-center justify-center gap-2 py-3"
        >
          <MessageSquare size={18} />
          My Network
        </Link>
      </div>
    </main>
  )
}