'use client'

import { useState } from 'react'
import {
  Calendar,
  Mail,
  Linkedin,
  Bell,
  ExternalLink,
  Check,
  X,
  Clock,
  Sparkles,
} from 'lucide-react'
import {
  generateActionUrl,
  type SuggestedAction,
  type CalendarEventPayload,
  type EmailDraftPayload,
  type LinkedInPayload,
  type FollowUpPayload,
} from '@/lib/smart-links'

interface ActionCardProps {
  action: SuggestedAction
  onComplete?: (actionId: string) => void
  onDismiss?: (actionId: string) => void
  compact?: boolean
}

// Action type configurations
const actionConfig = {
  calendar_event: {
    icon: Calendar,
    label: 'Add to Calendar',
    color: 'blue',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/20',
    hoverClass: 'hover:bg-blue-500/20',
  },
  email_draft: {
    icon: Mail,
    label: 'Open Email Draft',
    color: 'emerald',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/20',
    hoverClass: 'hover:bg-emerald-500/20',
  },
  linkedin_message: {
    icon: Linkedin,
    label: 'Open LinkedIn',
    color: 'sky',
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-400',
    borderClass: 'border-sky-500/20',
    hoverClass: 'hover:bg-sky-500/20',
  },
  follow_up: {
    icon: Bell,
    label: 'Set Reminder',
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
    borderClass: 'border-amber-500/20',
    hoverClass: 'hover:bg-amber-500/20',
  },
}

/**
 * ActionCard Component
 * Renders AI-suggested actions with one-click execution buttons.
 */
export default function ActionCard({
  action,
  onComplete,
  onDismiss,
  compact = false,
}: ActionCardProps) {
  const [isCompleted, setIsCompleted] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const config = actionConfig[action.type]
  const Icon = config.icon
  const actionUrl = generateActionUrl(action)

  const handleAction = () => {
    if (actionUrl) {
      window.open(actionUrl, '_blank', 'noopener,noreferrer')
      setIsCompleted(true)
      if (action.id && onComplete) {
        onComplete(action.id)
      }
    }
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    if (action.id && onDismiss) {
      onDismiss(action.id)
    }
  }

  // Don't render if dismissed
  if (isDismissed) return null

  // Get display info based on action type
  const getDisplayInfo = () => {
    switch (action.type) {
      case 'calendar_event': {
        const payload = action.payload as CalendarEventPayload
        const startDate = new Date(payload.startTime)
        return {
          title: payload.title,
          subtitle: `${startDate.toLocaleDateString()} at ${startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          detail: payload.location,
        }
      }
      case 'email_draft': {
        const payload = action.payload as EmailDraftPayload
        return {
          title: payload.subject,
          subtitle: `To: ${payload.recipientName || payload.recipientEmail}`,
          detail: payload.body.slice(0, 100) + (payload.body.length > 100 ? '...' : ''),
        }
      }
      case 'linkedin_message': {
        const payload = action.payload as LinkedInPayload
        return {
          title: `Message ${payload.recipientName}`,
          subtitle: 'Open LinkedIn profile',
          detail: payload.message.slice(0, 100) + (payload.message.length > 100 ? '...' : ''),
        }
      }
      case 'follow_up': {
        const payload = action.payload as FollowUpPayload
        const targetDate = new Date(payload.targetDate)
        return {
          title: `Follow up: ${payload.type}`,
          subtitle: targetDate.toLocaleDateString(),
          detail: payload.notes,
        }
      }
      default:
        return { title: 'Action', subtitle: '', detail: '' }
    }
  }

  const displayInfo = getDisplayInfo()

  // Compact version (inline button)
  if (compact) {
    return (
      <button
        onClick={handleAction}
        disabled={isCompleted || !actionUrl}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${config.bgClass} ${config.textClass} ${config.borderClass} border ${config.hoverClass} ${isCompleted ? 'opacity-50 cursor-default' : ''}`}
      >
        {isCompleted ? (
          <>
            <Check size={14} />
            Done
          </>
        ) : (
          <>
            <Icon size={14} />
            {config.label}
            <ExternalLink size={12} />
          </>
        )}
      </button>
    )
  }

  // Full card version
  return (
    <div className={`rounded-xl border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
      {/* Header */}
      <div className="flex items-start justify-between p-4 pb-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg ${config.bgClass} flex items-center justify-center flex-shrink-0`}>
            <Icon size={20} className={config.textClass} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-[--text-primary] truncate">
                {displayInfo.title}
              </h4>
              {action.confidence && action.confidence >= 0.8 && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <Sparkles size={10} />
                  Recommended
                </span>
              )}
            </div>
            <p className="text-sm text-[--text-tertiary] flex items-center gap-1">
              <Clock size={12} />
              {displayInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="p-1.5 text-[--text-quaternary] hover:text-[--text-secondary] hover:bg-[--bg-tertiary] rounded-md transition-colors"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>

      {/* Detail preview (if available) */}
      {displayInfo.detail && (
        <div className="px-4 pb-3">
          <p className="text-xs text-[--text-quaternary] line-clamp-2">
            {displayInfo.detail}
          </p>
        </div>
      )}

      {/* AI reasoning (if available) */}
      {action.reasoning && (
        <div className="px-4 pb-3">
          <p className="text-xs text-[--text-tertiary] italic">
            💡 {action.reasoning}
          </p>
        </div>
      )}

      {/* Action button */}
      <div className="px-4 pb-4">
        <button
          onClick={handleAction}
          disabled={isCompleted || !actionUrl}
          className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
              : `${config.bgClass} ${config.textClass} ${config.hoverClass} border ${config.borderClass}`
          }`}
        >
          {isCompleted ? (
            <>
              <Check size={16} />
              Completed
            </>
          ) : (
            <>
              <Icon size={16} />
              {config.label}
              <ExternalLink size={14} />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ============================================
// ACTION LIST COMPONENT
// ============================================

interface ActionListProps {
  actions: SuggestedAction[]
  onComplete?: (actionId: string) => void
  onDismiss?: (actionId: string) => void
  title?: string
}

/**
 * ActionList Component
 * Renders a list of suggested actions.
 */
export function ActionList({
  actions,
  onComplete,
  onDismiss,
  title = 'Suggested Actions',
}: ActionListProps) {
  if (actions.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-amber-400" />
        <h3 className="text-sm font-medium text-[--text-secondary]">{title}</h3>
      </div>
      <div className="grid gap-3">
        {actions.map((action, index) => (
          <ActionCard
            key={action.id || index}
            action={action}
            onComplete={onComplete}
            onDismiss={onDismiss}
          />
        ))}
      </div>
    </div>
  )
}

// ============================================
// INLINE ACTION BUTTONS (for embedding in text)
// ============================================

interface InlineActionButtonsProps {
  actions: SuggestedAction[]
}

/**
 * InlineActionButtons Component
 * Compact action buttons for embedding inline with content.
 */
export function InlineActionButtons({ actions }: InlineActionButtonsProps) {
  if (actions.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action, index) => (
        <ActionCard key={action.id || index} action={action} compact />
      ))}
    </div>
  )
}
