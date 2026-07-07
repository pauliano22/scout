'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react'

interface SpotlightStory {
  name: string
  sport: string
  industry: string
  quote: string
  photoUrl: string
}

export default function SpotlightStories() {
  const [stories, setStories] = useState<SpotlightStory[]>([])
  const [current, setCurrent] = useState(0)
  const [loading, setLoading] = useState(true)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const fetchStories = async () => {
      try {
        const res = await fetch('/api/stories/spotlight')
        if (res.ok) {
          const data = await res.json()
          setStories(data)
        }
      } catch {
        // fallback silently
      } finally {
        setLoading(false)
      }
    }
    fetchStories()
  }, [])

  const total = stories.length

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % total) + total) % total)
    },
    [total],
  )

  const next = useCallback(() => goTo(current + 1), [current, goTo])
  const prev = useCallback(() => goTo(current - 1), [current, goTo])

  // Auto-rotation every 5 seconds
  useEffect(() => {
    if (total === 0) return
    timerRef.current = setInterval(next, 5000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [next, total])

  // Reset timer on manual navigation
  const handleNext = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    next()
  }

  const handlePrev = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    prev()
  }

  if (loading) {
    return (
      <section className="px-6 md:px-12 py-28">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        </div>
      </section>
    )
  }

  if (total === 0) return null

  const story = stories[current]

  return (
    <section className="px-6 md:px-12 py-28 bg-[--bg-secondary]">
      <div className="max-w-4xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-3">
            Alumni Spotlight
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Real connections, real results
          </h2>
        </div>

        {/* Carousel card */}
        <div className="relative">
          <div className="border border-[--border-primary] rounded-2xl p-8 md:p-12 bg-[--bg-primary] transition-all duration-500">
            <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
              {/* Photo */}
              <div className="shrink-0">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden border-2 border-[--school-primary]/30 bg-[--bg-tertiary] flex items-center justify-center">
                  <img
                    src={story.photoUrl}
                    alt={story.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 mb-3">
                  <h3 className="text-xl font-bold tracking-tight text-[--text-primary]">
                    {story.name}
                  </h3>
                  <div className="flex items-center justify-center md:justify-start gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[--school-primary]/15 text-[--school-primary] border border-[--school-primary]/20">
                      {story.sport}
                    </span>
                    <span className="text-sm text-[--text-tertiary]">
                      {story.industry}
                    </span>
                  </div>
                </div>

                {/* Quote */}
                <div className="relative">
                  <Quote
                    size={18}
                    className="absolute -top-1 -left-1 text-[--school-primary]/20 hidden md:block"
                  />
                  <p className="text-base md:text-lg text-[--text-secondary] leading-relaxed italic pl-0 md:pl-6">
                    &ldquo;{story.quote}&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <button
            onClick={handlePrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-[--bg-secondary] border border-[--border-primary] flex items-center justify-center text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] transition-all shadow-sm"
            aria-label="Previous story"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-10 h-10 rounded-full bg-[--bg-secondary] border border-[--border-primary] flex items-center justify-center text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary] transition-all shadow-sm"
            aria-label="Next story"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {stories.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current)
                goTo(i)
              }}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? 'bg-[--school-primary] w-6'
                  : 'bg-[--border-primary] hover:bg-[--text-quaternary]'
              }`}
              aria-label={`Go to story ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
