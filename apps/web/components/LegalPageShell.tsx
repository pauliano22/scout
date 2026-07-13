import Link from 'next/link'

// Server-component shell for the plain-prose legal pages (/privacy, /terms).
// No client JS — these pages must stay readable and cheap.

export function LegalSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight mb-3">{title}</h2>
      <div className="space-y-3 text-[15px] text-[--text-secondary] leading-relaxed">
        {children}
      </div>
    </section>
  )
}

export default function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <main className="min-h-screen px-4 py-12">
      <div className="w-full max-w-2xl mx-auto">
        {/* Warm beige accent bar at top */}
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />

        <Link href="/" className="flex items-center justify-center gap-2 mb-12">
          <img src="/favicon.svg" alt="Scout" className="w-7 h-7" />
          <span className="logo-text text-lg">Scout</span>
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight mb-2">{title}</h1>
        <p className="text-sm text-[--text-tertiary] mb-10">Last updated: {updated}</p>

        <div className="space-y-10">{children}</div>

        <footer className="mt-14 pt-6 border-t border-[--border-primary] text-xs text-[--text-tertiary] space-y-3">
          <p>
            Scout is an independent platform and is not affiliated with, endorsed by, or
            sponsored by Cornell University.
          </p>
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/privacy" className="underline hover:text-[--text-secondary]">
              Privacy Policy
            </Link>
            <Link href="/terms" className="underline hover:text-[--text-secondary]">
              Terms of Service
            </Link>
            <Link href="/remove" className="underline hover:text-[--text-secondary]">
              Remove my profile
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}
