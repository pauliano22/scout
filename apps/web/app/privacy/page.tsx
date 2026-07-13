import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPageShell, { LegalSection } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy | Scout',
  description: 'How Scout collects, uses, and protects your information.',
}

const SUBPROCESSORS: Array<{ name: string; purpose: string }> = [
  { name: 'Supabase', purpose: 'Application hosting and database' },
  { name: 'Vercel', purpose: 'Web hosting and site analytics' },
  { name: 'Anthropic', purpose: 'AI drafting of outreach messages' },
  { name: 'OpenAI', purpose: 'Embeddings and search-query parsing' },
  { name: 'Resend', purpose: 'Transactional email (e.g., password resets)' },
  { name: 'Serper', purpose: 'Web search used to enrich alumni profiles' },
  { name: 'PostHog', purpose: 'Product analytics' },
  { name: 'Telegram', purpose: 'Operational alerts to Scout administrators' },
]

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="July 13, 2026">
      <LegalSection title="What Scout is">
        <p>
          Scout helps Cornell student-athletes find and reach out to alumni who played
          their sport. This page explains, in plain language, what information we hold
          and the choices you have.
        </p>
      </LegalSection>

      <LegalSection title="Information we hold">
        <p>
          <span className="font-medium text-[--text-primary]">Students</span> — your name
          and Cornell email, sport and graduation year, the career interests you enter,
          and your activity on Scout (alumni you save, messages you draft, sign-ins). We
          do not collect academic records, grades, or financial aid information.
        </p>
        <p>
          <span className="font-medium text-[--text-primary]">Alumni</span> —
          professional profiles: name, sport, graduation year, role, company, location,
          and LinkedIn URL. To be plain about it: many profiles were compiled by Scout
          from publicly available sources, such as published athletics rosters and public
          professional profiles, before the person signed up. You can claim your profile
          to update what&apos;s shown, or request removal at{' '}
          <Link href="/remove" className="underline hover:text-[--text-primary]">
            scoutcornell.com/remove
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          Matching students with relevant alumni, generating AI-assisted outreach drafts
          (students review every draft and send from their own email — Scout never
          messages alumni for you), and running and securing the product. We do not sell
          personal data and do not use it for advertising.
        </p>
      </LegalSection>

      <LegalSection title="Service providers">
        <p>Scout runs on a small set of providers that process data on our behalf:</p>
        <ul className="list-disc pl-5 space-y-1">
          {SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-[--text-primary]">{s.name}</span> —{' '}
              {s.purpose}
            </li>
          ))}
        </ul>
      </LegalSection>

      <LegalSection title="Cookies and retention">
        <p>
          Essential cookies keep you signed in; PostHog and Vercel Analytics help us
          improve the product. No advertising cookies. Account data is kept while your
          account is active and deleted when you delete it; some technical logs may
          persist for a limited period afterward.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          Students can delete their account anytime from Settings. Alumni can claim
          their profile or request removal (no account needed) at{' '}
          <Link href="/remove" className="underline hover:text-[--text-primary]">
            /remove
          </Link>
          . Anything else:{' '}
          <a
            href="mailto:contact@scoutcornell.com"
            className="underline hover:text-[--text-primary]"
          >
            contact@scoutcornell.com
          </a>{' '}
          — we confirm completed deletion requests in writing.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
