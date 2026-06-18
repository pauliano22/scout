'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Users, Send, UserCheck } from 'lucide-react'

type Step = {
  icon: typeof Search
  label: string
  description: string
}

const steps: Step[] = [
  { icon: Search, label: 'Discover', description: 'Search alumni by industry, company, or role' },
  { icon: Users, label: 'Network', description: 'Add promising alumni to your network' },
  { icon: Send, label: 'Message', description: 'Send a thoughtful outreach message' },
  { icon: UserCheck, label: 'Intro', description: 'Get introduced and grow your career' },
]

export default function OnboardingVideo() {
  const [state, setState] = useState<'idle' | 'playing'>('idle')
  const [visible, setVisible] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Intersection Observer for scroll-based fade-in
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Progress bar + step cycling during play
  useEffect(() => {
    if (state !== 'playing') return

    const totalDuration = 30000 // 30s
    const stepInterval = totalDuration / steps.length // 7.5s per step

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        const next = prev + 100 / (totalDuration / 50) // ~2% per 50ms tick
        return next >= 100 ? 100 : next
      })
    }, 50)

    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => {
        const next = prev + 1
        return next >= steps.length ? steps.length - 1 : next
      })
    }, stepInterval)

    // Auto reset after 30s
    const resetTimer = setTimeout(() => {
      setState('idle')
      setProgress(0)
      setCurrentStep(0)
    }, totalDuration + 500)

    return () => {
      clearInterval(progressTimer)
      clearInterval(stepTimer)
      clearTimeout(resetTimer)
    }
  }, [state])

  const handlePlay = () => {
    setState('playing')
  }

  return (
    <div
      ref={containerRef}
      className={`
        transition-all duration-700 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
      `}
    >
      <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl overflow-hidden">
        {/* Video / Poster Area */}
        <div className="relative aspect-video overflow-hidden">
          {/* Gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#B31B1B] via-[#B31B1B]/80 to-[#F5F0EB]/20" />

          {/* Subtle pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '24px 24px'
          }} />

          {state === 'idle' ? (
            /* ─── IDLE STATE: Play button overlay ─── */
            <div className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer group" onClick={handlePlay} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handlePlay()}>
              {/* Play button */}
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-active:scale-95 border border-white/30">
                <div className="w-0 h-0 border-t-[12px] border-b-[12px] border-l-[18px] border-t-transparent border-b-transparent border-l-white ml-1" />
              </div>
              <span className="mt-3 text-xs font-medium text-white/80 backdrop-blur-sm px-3 py-1 rounded-full bg-black/20">
                Play demo (30s)
              </span>

              {/* Step labels on idle poster */}
              <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-4 md:gap-6">
                {steps.map((step, i) => {
                  const Icon = step.icon
                  return (
                    <div key={step.label} className="flex flex-col items-center gap-1">
                      <div className="w-8 h-8 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/10">
                        <Icon size={14} className="text-white/70" />
                      </div>
                      <span className="text-[10px] font-medium text-white/60">{step.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            /* ─── PLAYING STATE: Animated steps ─── */
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              {/* Current step indicator */}
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-3 border border-white/20">
                  {(() => {
                    const Icon = steps[currentStep].icon
                    return <Icon size={24} className="text-white" />
                  })()}
                </div>
                <h3 className="text-white font-semibold text-lg">{steps[currentStep].label}</h3>
                <p className="text-white/70 text-sm mt-1 max-w-xs mx-auto">{steps[currentStep].description}</p>
              </div>

              {/* Step dots */}
              <div className="flex gap-2 mb-4">
                {steps.map((s, i) => (
                  <div
                    key={s.label}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'bg-white w-6'
                        : i < currentStep
                          ? 'bg-white/50'
                          : 'bg-white/20'
                    }`}
                  />
                ))}
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-[200px] h-1 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-[50ms] linear"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Bottom text */}
        <div className="px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[--school-primary]" />
            <span className="text-xs text-[--text-tertiary] font-medium">See how Scout works (30s)</span>
          </div>
          {state === 'playing' && (
            <button
              type="button"
              onClick={() => {
                setState('idle')
                setProgress(0)
                setCurrentStep(0)
              }}
              className="text-[10px] text-[--text-quaternary] hover:text-[--text-secondary] transition underline"
            >
              Replay
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
