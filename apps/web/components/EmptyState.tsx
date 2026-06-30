'use client'

import Link from '@/components/Link'
import type { EmptyStateIconKey } from './empty-state-icons'
import { emptyStateIcons } from './empty-state-icons'

interface EmptyStateProps {
  /** Key into the branded icon set */
  icon?: EmptyStateIconKey
  /** Headline (bold, ~18px) */
  title: string
  /** Supporting text (secondary color) */
  description: string
  /** Primary CTA label */
  actionLabel?: string
  /** Primary CTA href */
  actionHref?: string
  /** Secondary CTA label */
  secondaryLabel?: string
  /** Secondary CTA href */
  secondaryHref?: string
  /** Optional override className */
  className?: string
}

/**
 * Branded empty state component.
 *
 * Renders a centered card (max-w-md, rounded-xl, warm beige background) with
 * an inline SVG icon, title, description, and up to two action links styled
 * in Scout's Cornell red.
 *
 * Usage:
 * ```tsx
 * <EmptyState
 *   icon="search-empty"
 *   title="No results found"
 *   description="Try adjusting your filters or search terms."
 *   actionLabel="Clear filters"
 *   actionHref="/search"
 * />
 * ```
 */
export default function EmptyState({
  icon = 'generic-empty',
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
  className = '',
}: EmptyStateProps) {
  const IconComponent = emptyStateIcons[icon]

  return (
    <div
      className={`flex flex-col items-center text-center px-6 py-12 mx-auto max-w-md rounded-xl ${className}`}
      style={{ backgroundColor: 'var(--accent-warm)' }}
    >
      {IconComponent && (
        <div className="mb-5">
          <IconComponent />
        </div>
      )}

      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
        {title}
      </h3>

      <p
        className="text-sm leading-relaxed mb-6 max-w-xs"
        style={{ color: 'var(--text-tertiary)' }}
      >
        {description}
      </p>

      {(actionLabel || secondaryLabel) && (
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {actionLabel && actionHref && (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-all duration-150 hover:opacity-90 active:scale-[0.97]"
              style={{ backgroundColor: 'var(--school-primary, #B31B1B)' }}
            >
              {actionLabel}
            </Link>
          )}

          {secondaryLabel && secondaryHref && (
            <Link
              href={secondaryHref}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-[0.97]"
              style={{
                color: 'var(--text-primary)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-primary)',
              }}
            >
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
