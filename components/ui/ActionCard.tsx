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
  type JobApplicationPayload,
} from '@/lib/smart-links'
import { Briefcase } from 'lucide-react'

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
  job_application: {
    icon: Briefcase,
    label: 'View Job',
    color: 'purple',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
    borderClass: 'border-purple-500/20',
    hoverClass: 'hover:bg-purple-500/20',
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
      case 'job_application': {
        const payload = action.payload as JobApplicationPayload
        return {
          title: payload.jobTitle,
          subtitle: payload.company,
          detail: '',
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

  // Full card version - compact layout
  return (
    <div className={`rounded-lg border ${config.borderClass} ${config.bgClass} overflow-hidden`}>
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg ${config.bgClass} flex items-center justify-center flex-shrink-0`}>
          <Icon size={16} className={config.textClass} />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-[--text-primary] truncate">
            {displayInfo.title}
          </h4>
          <p className="text-xs text-[--text-tertiary] truncate">
            {displayInfo.subtitle}
          </p>
        </div>

        {/* Action button */}
        <button
          onClick={handleAction}
          disabled={isCompleted || !actionUrl}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex-shrink-0 ${
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
              : `${config.bgClass} ${config.textClass} ${config.hoverClass} border ${config.borderClass}`
          }`}
        >
          {isCompleted ? (
            <>
              <Check size={12} />
              Done
            </>
          ) : (
            <>
              {config.label}
              <ExternalLink size={10} />
            </>
          )}
        </button>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="p-1 text-[--text-quaternary] hover:text-[--text-secondary] rounded transition-colors flex-shrink-0"
          title="Dismiss"
        >
          <X size={12} />
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
