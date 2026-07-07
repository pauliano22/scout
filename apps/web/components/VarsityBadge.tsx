'use client'

import { Award, Shield, Star } from 'lucide-react'
import type { AmbassadorTier, AmbassadorBadgeType } from '@scout/shared/types/database'

interface VarsityBadgeProps {
  sport: string
  tier?: AmbassadorTier
  badgeType?: AmbassadorBadgeType
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const tierColors: Record<AmbassadorTier, { bg: string; text: string; border: string }> = {
  bronze: {
    bg: 'bg-amber-900/30',
    text: 'text-amber-300',
    border: 'border-amber-600/40',
  },
  silver: {
    bg: 'bg-slate-600/30',
    text: 'text-slate-200',
    border: 'border-slate-400/40',
  },
  gold: {
    bg: 'bg-yellow-700/30',
    text: 'text-yellow-300',
    border: 'border-yellow-500/40',
  },
  platinum: {
    bg: 'bg-indigo-800/30',
    text: 'text-indigo-300',
    border: 'border-indigo-500/40',
  },
}

const badgeIcons: Record<AmbassadorBadgeType, typeof Award> = {
  varsity: Shield,
  captain: Star,
  hall_of_fame: Award,
}

const badgeLabels: Record<AmbassadorBadgeType, string> = {
  varsity: 'Varsity Ambassador',
  captain: 'Team Captain',
  hall_of_fame: 'Hall of Fame',
}

const sizeMap = {
  sm: { icon: 12, padding: 'px-1.5 py-0.5', text: 'text-[10px]' },
  md: { icon: 14, padding: 'px-2 py-1', text: 'text-xs' },
  lg: { icon: 18, padding: 'px-3 py-1.5', text: 'text-sm' },
}

export default function VarsityBadge({
  sport,
  tier = 'bronze',
  badgeType = 'varsity',
  size = 'md',
  showLabel = true,
}: VarsityBadgeProps) {
  const colors = tierColors[tier]
  const IconComponent = badgeIcons[badgeType]
  const { icon: iconSize, padding, text } = sizeMap[size]
  const label = badgeLabels[badgeType]

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium rounded-full border ${colors.bg} ${colors.text} ${colors.border} ${padding} ${text}`}
      title={`${label} — ${sport}`}
    >
      <IconComponent size={iconSize} className="shrink-0" />
      {showLabel && (
        <>
          <span className="leading-none">{label}</span>
          <span className="opacity-60 leading-none">·</span>
          <span className="leading-none font-semibold">{sport}</span>
        </>
      )}
    </span>
  )
}
