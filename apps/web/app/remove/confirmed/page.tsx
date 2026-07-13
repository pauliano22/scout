import Link from '@/components/Link'
import { ShieldCheck, ShieldAlert } from 'lucide-react'
import ScoutLogo from '@/components/ScoutLogo'

// Landing page for the removal-confirmation email link
// (/api/alumni/remove-request/confirm redirects here).

export const dynamic = 'force-dynamic'

export default function RemoveConfirmedPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const invalid = searchParams.status === 'invalid'

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="h-1 w-16 mx-auto mb-6 rounded-full bg-[--accent-warm]" />
        <ScoutLogo size="lg" className="justify-center mb-10" />

        <div className="relative bg-[--bg-secondary] border border-[--border-primary] rounded-xl p-8 overflow-hidden">
          <div className="relative z-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[--school-primary]/10 flex items-center justify-center mx-auto mb-4">
              {invalid ? (
                <ShieldAlert size={22} className="text-[--school-primary]" />
              ) : (
                <ShieldCheck size={22} className="text-[--school-primary]" />
              )}
            </div>
            {invalid ? (
              <>
                <h1 className="text-xl font-semibold mb-3">Link expired or invalid</h1>
                <p className="text-[--text-secondary] text-sm leading-relaxed">
                  This confirmation link has expired or was already used. You can submit a
                  new removal request and we&apos;ll send a fresh link.
                </p>
                <Link href="/remove" className="inline-block mt-6 text-[--school-primary] hover:underline text-sm">
                  Submit a new request
                </Link>
              </>
            ) : (
              <>
                <h1 className="text-xl font-semibold mb-3">Removal confirmed</h1>
                <p className="text-[--text-secondary] text-sm leading-relaxed">
                  Thanks for confirming. Any matching profile has been hidden from the
                  directory, and your request is queued for full deletion review. Removal
                  can take a few days to fully propagate.
                </p>
                <Link href="/" className="inline-block mt-6 text-[--school-primary] hover:underline text-sm">
                  Back to home
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
