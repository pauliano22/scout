'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

// Helper for tracking custom events anywhere in the app
export { usePostHog } from 'posthog-js/react'

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined') {
    posthog.capture(event, properties)
  }
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

    if (!key) return // No key configured yet

    posthog.init(key, {
      api_host: host,
      capture_pageview: true,
      capture_pageleave: true,
      person_profiles: 'identified_only',
    })
  }, [])

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return <>{children}</>

  return <PHProvider client={posthog}>{children}</PHProvider>
}
