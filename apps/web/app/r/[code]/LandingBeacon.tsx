'use client'

import { useEffect } from 'react'
import { trackEvent } from '@/lib/track'

// Anonymous visitors have no session for /api/track — PostHog leg only.
export default function LandingBeacon({ hasFor }: { hasFor: boolean }) {
  useEffect(() => {
    trackEvent('claim_landing_viewed', { has_for: hasFor }, { posthogOnly: true })
  }, [hasFor])
  return null
}
