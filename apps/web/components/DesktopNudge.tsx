'use client'

import { useEffect, useState } from 'react'
import { Monitor, X } from 'lucide-react'

const DISMISS_KEY = 'scout_desktop_nudge_dismissed'

// Shown only on phone-width screens during onboarding: setup is easier on a
// bigger screen, but we never block continuing on mobile. Dismissal sticks.
export default function DesktopNudge() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (localStorage.getItem(DISMISS_KEY) === '1') return
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore storage failures — worst case the nudge shows again next visit
    }
    setVisible(false)
  }

  return (
    <div className="md:hidden fixed top-0 inset-x-0 z-50 bg-[--accent-warm] text-[--text-primary] shadow-sm">
      <div className="flex items-start gap-2 px-4 py-2.5 max-w-lg mx-auto">
        <Monitor size={15} className="mt-0.5 shrink-0" />
        <p className="text-xs leading-snug flex-1">
          Scout works best on a computer — but you can keep going here.
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="shrink-0 -m-1.5 p-1.5 opacity-70 hover:opacity-100"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}
