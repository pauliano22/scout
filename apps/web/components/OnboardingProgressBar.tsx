'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Check, Camera, User, Users, Send } from 'lucide-react'
import type { OnboardingStep } from '@scout/shared/types/database'
import { ONBOARDING_STEPS, ONBOARDING_STEP_LABELS } from '@scout/shared/types/database'

// ── Icons for each step ────────────────────────────────────────────────
const STEP_ICONS: Record<OnboardingStep, React.ReactNode> = {
  add_photo: <Camera size={14} />,
  complete_bio: <User size={14} />,
  first_connection: <Users size={14} />,
  first_message: <Send size={14} />,
}

// ── Confetti particle ──────────────────────────────────────────────────
interface Particle {
  id: number
  x: number
  y: number
  color: string
  size: number
  rotation: number
  delay: number
  duration: number
  shape: 'circle' | 'square'
}

const CONFETTI_COLORS = [
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f97316', // orange
  '#06b6d4', // cyan
]

function generateParticles(count: number, originX: number, originY: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: originX,
    y: originY,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: Math.random() * 8 + 4,
    rotation: Math.random() * 360,
    delay: Math.random() * 0.3,
    duration: Math.random() * 0.8 + 0.6,
    shape: Math.random() > 0.5 ? 'circle' : 'square',
  }))
}

interface ConfettiBurstProps {
  /** Number of particles (default: 30) */
  particleCount?: number
  /** Fired once the animation finishes */
  onComplete?: () => void
}

function ConfettiBurst({ particleCount = 30, onComplete }: ConfettiBurstProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [visible, setVisible] = useState(true)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    setParticles(generateParticles(particleCount, 50, 50))
    setAnimKey(k => k + 1)
    setVisible(true)

    const timer = setTimeout(() => {
      setVisible(false)
      onComplete?.()
    }, 1800)

    return () => clearTimeout(timer)
  }, [particleCount, onComplete])

  if (!visible || particles.length === 0) return null

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" key={animKey}>
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute animate-confetti-particle"
          style={
            {
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
              borderRadius: p.shape === 'circle' ? '50%' : '2px',
              transform: `rotate(${p.rotation}deg)`,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
              '--p-x': `${(Math.random() - 0.5) * 200}px`,
              '--p-y': `${(Math.random() - 0.5) * 200}px`,
              '--p-r': `${Math.random() * 720}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}

// ── Props ──────────────────────────────────────────────────────────────

interface OnboardingProgressBarProps {
  completedSteps: OnboardingStep[]
  currentStepIndex: number
  totalSteps: number
  /** Optional className for the outer wrapper */
  className?: string
  /** Compact variant for embedding in small spaces (default: false) */
  compact?: boolean
  /** Callback when a step is clicked (links to the relevant page) */
  onStepClick?: (step: OnboardingStep) => void
}

// ── Component ──────────────────────────────────────────────────────────

export default function OnboardingProgressBar({
  completedSteps,
  currentStepIndex,
  totalSteps,
  className = '',
  compact = false,
  onStepClick,
}: OnboardingProgressBarProps) {
  const completedSet = useMemo(() => new Set(completedSteps), [completedSteps])
  const isComplete = completedSteps.length >= totalSteps

  // Track which steps are newly completed for confetti
  const [justCompleted, setJustCompleted] = useState<Set<number>>(new Set())
  const prevCompleted = useMemo(() => new Set<string>(), [completedSteps])

  useEffect(() => {
    const newCompletions = new Set<number>()
    ONBOARDING_STEPS.forEach((step, index) => {
      if (completedSet.has(step) && !prevCompleted.has(step)) {
        newCompletions.add(index)
      }
      prevCompleted.add(step)
    })
    if (newCompletions.size > 0) {
      setJustCompleted(newCompletions)
      const timer = setTimeout(() => setJustCompleted(new Set()), 2000)
      return () => clearTimeout(timer)
    }
  }, [completedSteps, completedSet, prevCompleted])

  // The current/progress percentage
  const progressPercent = Math.round((completedSteps.length / totalSteps) * 100)

  // ── Compact mode: just a single progress line ────────────────────
  if (compact) {
    return (
      <div className={`${className}`}>
        {!isComplete && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-[--bg-tertiary] rounded-full overflow-hidden">
              <div
                className="h-full bg-[--school-primary] rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[--text-secondary] whitespace-nowrap">
              {completedSteps.length}/{totalSteps}
            </span>
          </div>
        )}
        {isComplete && (
          <div className="flex items-center gap-2 text-xs text-green-400">
            <Check size={14} />
            <span>Onboarding complete</span>
          </div>
        )}
      </div>
    )
  }

  // ── Full bar: step indicators ─────────────────────────────────────
  return (
    <div className={`relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[--text-primary]">
          {isComplete ? 'Onboarding Complete!' : 'Getting Started'}
        </h3>
        <span className="text-xs text-[--text-quaternary] font-medium">
          {completedSteps.length}/{totalSteps}
        </span>
      </div>

      {/* Progress track */}
      <div className="h-1.5 bg-[--bg-tertiary] rounded-full mb-4">
        <div
          className="h-full bg-gradient-to-r from-[--school-primary] to-emerald-400 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-start gap-0">
        {ONBOARDING_STEPS.map((step, index) => {
          const isCompleted = completedSet.has(step)
          const isCurrent = index === currentStepIndex && !isCompleted
          const isJustCompleted = justCompleted.has(index)

          return (
            <div
              key={step}
              className={`relative flex-1 flex flex-col items-center gap-2 ${
                index < ONBOARDING_STEPS.length - 1 ? '' : ''
              }`}
            >
              {/* Connector line between circles */}
              {index < ONBOARDING_STEPS.length - 1 && (
                <div
                  className={`absolute top-3 left-[calc(50%+12px)] right-[calc(50%-12px)] h-0.5 ${
                    isCompleted ? 'bg-emerald-400' : 'bg-[--bg-tertiary]'
                  }`}
                />
              )}

              {/* Circle / Step indicator */}
              <button
                type="button"
                onClick={() => {
                  if (!isCompleted && onStepClick) onStepClick(step)
                }}
                disabled={!onStepClick || isCompleted}
                className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all duration-300 ${
                  isCompleted
                    ? 'bg-emerald-400 border-emerald-400 text-white'
                    : isCurrent
                      ? 'border-[--school-primary] bg-[--school-primary]/10 text-[--school-primary] ring-2 ring-[--school-primary]/30'
                      : 'border-[--border-secondary] bg-[--bg-secondary] text-[--text-quaternary]'
                } ${isJustCompleted ? 'animate-step-complete' : ''} ${onStepClick && !isCompleted ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
              >
                {isCompleted ? (
                  <Check size={12} strokeWidth={3} />
                ) : (
                  <span className="text-xs font-bold">{index + 1}</span>
                )}
              </button>

              {/* Label */}
              <span
                className={`text-[10px] leading-tight text-center max-w-[80px] transition-colors duration-300 ${
                  isCompleted
                    ? 'text-emerald-400 font-medium'
                    : isCurrent
                      ? 'text-[--text-primary] font-medium'
                      : 'text-[--text-quaternary]'
                }`}
              >
                {ONBOARDING_STEP_LABELS[step]}
              </span>

              {/* Confetti burst for newly completed step */}
              {isJustCompleted && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <ConfettiBurst particleCount={20} />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status message */}
      <div className="mt-4 pt-3 border-t border-[--border-primary]">
        {isComplete ? (
          <p className="text-xs text-emerald-400 flex items-center gap-1.5">
            <Check size={12} />
            You've completed all onboarding steps!
          </p>
        ) : (
          <p className="text-xs text-[--text-tertiary]">
            {completedSteps.length === 0
              ? 'Start by adding a photo to your profile.'
              : `Next up: ${ONBOARDING_STEP_LABELS[ONBOARDING_STEPS[currentStepIndex]]}`}
          </p>
        )}
      </div>
    </div>
  )
}
