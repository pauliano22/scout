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
      <LegalSection title="Who we are">
        <p>
          Scout is a career-networking platform that helps Cornell student-athletes find
          and reach out to alumni who played their sport. Scout is an independent platform
          and is not affiliated with, endorsed by, or sponsored by Cornell University.
        </p>
        <p>
          This policy explains, in plain language, what information we hold, where it
          comes from, how we use it, and the choices you have.
        </p>
      </LegalSection>

      <LegalSection title="Information we hold about students">
        <p>When you sign up as a student-athlete, we collect:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Your name and Cornell email address</li>
          <li>Your sport and graduation year</li>
          <li>Career interests and preferences you enter (industries, roles, locations)</li>
          <li>
            Your activity on Scout — for example alumni you save, messages you draft, and
            sign-ins
          </li>
        </ul>
        <p>
          We do not collect academic records, grades, or financial aid information.
        </p>
      </LegalSection>

      <LegalSection title="Information we hold about alumni">
        <p>
          Scout&apos;s alumni directory contains professional profiles — typically name,
          sport, graduation year, current role, company, industry, location, and LinkedIn
          URL. To be plain about it: many of these profiles were compiled by Scout from
          publicly available sources, such as published athletics rosters and public
          professional profiles, before the person ever signed up for Scout.
        </p>
        <p>
          If you are an alum, you can claim your profile to control exactly what is
          shown (including whether your email is visible to students), or ask us to
          remove your profile entirely — see &ldquo;Your choices and rights&rdquo; below.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <ul className="list-disc pl-5 space-y-1">
          <li>Matching students with relevant alumni and personalizing recommendations</li>
          <li>Generating AI-assisted outreach drafts (see the AI section below)</li>
          <li>Operating, securing, and improving the product</li>
          <li>Sending transactional emails such as password resets</li>
        </ul>
        <p>
          We do not sell personal data. We do not use your data for third-party
          advertising, and we do not use it to market unrelated commercial services.
        </p>
      </LegalSection>

      <LegalSection title="Service providers (subprocessors)">
        <p>
          Scout runs on a small set of service providers that process data on our behalf.
          The full list:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          {SUBPROCESSORS.map((s) => (
            <li key={s.name}>
              <span className="font-medium text-[--text-primary]">{s.name}</span> —{' '}
              {s.purpose}
            </li>
          ))}
        </ul>
        <p>
          These providers only process data as needed to run Scout. We will update this
          list if it changes.
        </p>
      </LegalSection>

      <LegalSection title="AI disclosure">
        <p>
          Scout uses AI (from Anthropic and OpenAI) to draft outreach messages and to
          power search. Drafts are suggestions only: the student reviews and edits every
          message and sends it from their own email account. Scout does not send messages
          to alumni on your behalf.
        </p>
      </LegalSection>

      <LegalSection title="Cookies and analytics">
        <p>
          We use essential cookies to keep you signed in. We also use PostHog and Vercel
          Analytics to understand how features are used so we can improve them. We do not
          use advertising cookies.
        </p>
      </LegalSection>

      <LegalSection title="Retention">
        <p>
          We keep your account data for as long as your account is active. When you
          delete your account, your profile and the personal data tied to it are deleted.
          Some technical records — such as security logs, signup logs, and analytics
          events — may persist for a limited period after deletion; we are actively
          working to shorten and automate that cleanup.
        </p>
      </LegalSection>

      <LegalSection title="Your choices and rights">
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <span className="font-medium text-[--text-primary]">Students</span> — you can
            delete your account at any time from Settings in the app. This removes your
            profile and personal data.
          </li>
          <li>
            <span className="font-medium text-[--text-primary]">Alumni</span> — claim
            your profile to control what students see, or request removal (no account
            needed) at{' '}
            <Link href="/remove" className="underline hover:text-[--text-primary]">
              scoutcornell.com/remove
            </Link>
            .
          </li>
          <li>
            <span className="font-medium text-[--text-primary]">Anything else</span> —
            email us at{' '}
            <a
              href="mailto:contact@scoutcornell.com"
              className="underline hover:text-[--text-primary]"
            >
              contact@scoutcornell.com
            </a>{' '}
            and we&apos;ll help. We confirm completed deletion requests in writing.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If we make material changes to this policy, we will update this page and the
          date at the top. Questions are always welcome at{' '}
          <a
            href="mailto:contact@scoutcornell.com"
            className="underline hover:text-[--text-primary]"
          >
            contact@scoutcornell.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
