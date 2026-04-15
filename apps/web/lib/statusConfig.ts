/**
 * STATUS BADGE COLOR SYSTEM
 * ─────────────────────────
 * Single source of truth for CRM status badge colors across all pages.
 * Import this wherever status badges are rendered to prevent color drift.
 *
 * COLOR ASSIGNMENTS (intentionally distinct from sport tag colors):
 *   interested        → blue   (initial interest, no action yet)
 *   awaiting_reply    → amber  (message sent, waiting)
 *   response_needed   → red    (they replied, your turn)
 *   meeting_scheduled → purple (call/meeting booked)
 *   met               → emerald (conversation happened)
 *
 * SPORT TAG COLORS (in NetworkClient only, for visual variety):
 *   Sport tags use their own color mapping (getSportColor utility).
 *   On Plan and Discover pages, sport tags use NEUTRAL/gray styling
 *   to avoid any confusion with status badge colors.
 */

import { Clock, Users, AlertCircle, Calendar, CheckCircle2 } from 'lucide-react'

export type CRMStatus = 'interested' | 'awaiting_reply' | 'response_needed' | 'meeting_scheduled' | 'met'

export const statusConfig: Record<CRMStatus, {
  label: string
  color: string
  bgClass: string
  borderClass: string
  textClass: string
  icon: typeof Clock
}> = {
  interested: {
    label: 'Interested',
    color: 'blue',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/20',
    textClass: 'text-blue-400',
    icon: Users,
  },
  awaiting_reply: {
    label: 'Awaiting Reply',
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/20',
    textClass: 'text-amber-400',
    icon: Clock,
  },
  response_needed: {
    label: 'Response Needed',
    color: 'red',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
    textClass: 'text-red-400',
    icon: AlertCircle,
  },
  meeting_scheduled: {
    label: 'Meeting Scheduled',
    color: 'purple',
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/20',
    textClass: 'text-purple-400',
    icon: Calendar,
  },
  met: {
    label: 'Met',
    color: 'emerald',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/20',
    textClass: 'text-emerald-400',
    icon: CheckCircle2,
  },
}

/** Returns the display config for a given status, defaulting to 'interested'. */
export function getStatusConfig(status: string | undefined | null) {
  return statusConfig[(status as CRMStatus) ?? 'interested'] ?? statusConfig.interested
}
