// Stage presentation map for the recruiting CRM (echoes lib/statusConfig.ts).
// signed_up and activated are derived stages — locked in every editor UI.

import {
  Ban,
  Circle,
  Crosshair,
  MessageCircle,
  Send,
  UserCheck,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { EffectiveStage } from '@/lib/recruiting/merge'

export interface StageConfig {
  label: string
  icon: LucideIcon
  /** Tailwind classes for the badge chip. */
  badge: string
  /** Text color for icon-only accents. */
  text: string
  /** True when the stage is computed from product data, never hand-set. */
  derived: boolean
}

export const STAGE_ORDER: EffectiveStage[] = [
  'untouched',
  'targeted',
  'reached_out',
  'responded',
  'signed_up',
  'activated',
]

export const STAGES: Record<EffectiveStage, StageConfig> = {
  untouched: {
    label: 'Untouched',
    icon: Circle,
    badge: 'bg-zinc-500/10 text-zinc-500',
    text: 'text-zinc-500',
    derived: false,
  },
  targeted: {
    label: 'Targeted',
    icon: Crosshair,
    badge: 'bg-blue-500/10 text-blue-500',
    text: 'text-blue-500',
    derived: false,
  },
  reached_out: {
    label: 'Reached out',
    icon: Send,
    badge: 'bg-amber-500/10 text-amber-600',
    text: 'text-amber-600',
    derived: false,
  },
  responded: {
    label: 'Responded',
    icon: MessageCircle,
    badge: 'bg-purple-500/10 text-purple-500',
    text: 'text-purple-500',
    derived: false,
  },
  signed_up: {
    label: 'Signed up',
    icon: UserCheck,
    badge: 'bg-emerald-500/10 text-emerald-500',
    text: 'text-emerald-500',
    derived: true,
  },
  activated: {
    label: 'Activated',
    icon: Zap,
    badge: 'bg-emerald-500/15 text-emerald-600',
    text: 'text-emerald-600',
    derived: true,
  },
  not_now: {
    label: 'Not now',
    icon: Ban,
    badge: 'bg-zinc-500/10 text-zinc-400',
    text: 'text-zinc-400',
    derived: false,
  },
}

export const ACTIVITY_KIND_LABELS: Record<string, string> = {
  ig_dm: 'IG DM',
  in_person: 'In person',
  teammate_intro: 'Teammate intro',
  captain_intro: 'Captain intro',
  event: 'Event',
  other: 'Other',
}

export const ACTIVITY_OUTCOME_LABELS: Record<string, string> = {
  no_reply: 'No reply yet',
  replied_positive: 'Replied — positive',
  replied_negative: 'Replied — not interested',
  agreed_to_join: 'Agreed to join',
  met: 'Met',
}

export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}
