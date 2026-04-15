'use client'

import { useState, useRef, useEffect } from 'react'

export default function MascotFeedback() {
  const [open, setOpen] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div style={{ position: 'fixed', bottom: 0, right: '24px', zIndex: 50 }}>
      {open && (
        <div
          ref={popupRef}
          style={{
            position: 'absolute',
            bottom: '76px',
            right: 0,
            width: '240px',
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 600 }}>
            Hey! 👋
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px', lineHeight: '1.5' }}>
            I would love any feedback on Scout. Thanks!
          </p>
          <a
            href="mailto:ibw22@cornell.edu?subject=Scout Feedback"
            style={{
              display: 'block',
              padding: '8px 14px',
              borderRadius: '8px',
              background: '#B31B1B',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
            }}
            onClick={() => setOpen(false)}
          >
            ibw22@cornell.edu
          </a>
        </div>
      )}

      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Give feedback"
        title="Give feedback"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'block' }}
      >
        <img
          src="/mascot.png"
          alt=""
          aria-hidden="true"
          style={{ width: '64px', display: 'block', userSelect: 'none', transition: 'transform 0.15s ease' }}
          onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
          onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
        />
      </button>
    </div>
  )
}
