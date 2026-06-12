'use client'

import { useState } from 'react'

export default function MascotFeedback() {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{ position: 'fixed', bottom: 0, right: '24px', zIndex: 80 }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '76px',
            right: 0,
            width: '240px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: '0 0 8px', fontWeight: 600 }}>
            Hey! 👋
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '0 0 12px', lineHeight: '1.5' }}>
            I would love any feedback on Scout. Thanks!
          </p>
          <a
            href="mailto:ibw22@cornell.edu?subject=Scout Feedback"
            style={{
              display: 'block',
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'var(--school-primary, #B31B1B)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '13px',
              textDecoration: 'none',
            }}
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
          src="/mascot.png?v=2"
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
