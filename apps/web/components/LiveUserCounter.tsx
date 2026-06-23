'use client'

import { useEffect, useRef, useState } from 'react'

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function LiveUserCounter() {
  const [displayValue, setDisplayValue] = useState(0)
  const [finalCount, setFinalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false

    async function fetchCount() {
      try {
        const res = await fetch('/api/stats/count')
        if (!res.ok) throw new Error('Failed to fetch')
        const data = await res.json()
        if (!cancelled) {
          setFinalCount(data.count)
          setLoading(false)
        }
      } catch {
        if (!cancelled) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchCount()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (finalCount === null) return

    const target = finalCount
    const duration = 1500 // ms
    startTimeRef.current = null

    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }

      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = easeOutCubic(progress)

      setDisplayValue(Math.round(easedProgress * target))

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [finalCount])

  if (loading) {
    return (
      <p className="text-sm text-[--text-quaternary] mt-6">
        <span className="font-bold text-[--school-primary] opacity-40">—</span>
        {' '}Cornell alumni on Scout
      </p>
    )
  }

  if (error) {
    return null // silently hide on error
  }

  return (
    <p className="text-sm text-[--text-quaternary] mt-6">
      <span className="font-bold text-[--school-primary] tabular-nums">
        {formatNumber(displayValue)}
      </span>
      {' '}Cornell alumni on Scout
    </p>
  )
}
