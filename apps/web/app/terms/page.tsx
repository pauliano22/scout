import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPageShell, { LegalSection } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Terms of Service | Scout',
  description: 'The terms that govern your use of Scout.',
}

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" updated="July 13, 2026">
      <LegalSection title="Agreement">
        <p>
          By creating an account or using Scout, you agree to these terms and to our{' '}
          <Link href="/privacy" className="underline hover:text-[--text-primary]">
            Privacy Policy
          </Link>
          . You must be at least 18 years old; student accounts require a valid Cornell
          email address.
        </p>
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>
          Scout is for personal career networking between student-athletes and alumni.
          You agree not to:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Scrape, bulk-export, resell, or redistribute the alumni directory</li>
          <li>Spam, harass, or misrepresent who you are</li>
          <li>Use Scout for advertising or commercial purposes unrelated to your own career</li>
          <li>Circumvent security, access data that isn&apos;t yours, or break the law</li>
        </ul>
      </LegalSection>

      <LegalSection title="Directory and AI drafts">
        <p>
          Alumni starter profiles are compiled from publicly available sources and can be
          edited or removed by the alumni they describe. AI-generated outreach drafts are
          suggestions only — you review every message and send it from your own email
          account.
        </p>
      </LegalSection>

      <LegalSection title="Termination">
        <p>
          We may suspend accounts that violate these terms. You can delete your account
          at any time from Settings.
        </p>
      </LegalSection>

      <LegalSection title="Disclaimers">
        <p>
          Scout is provided &ldquo;as is,&rdquo; without warranties of any kind. To the
          maximum extent permitted by law, we are not liable for indirect or
          consequential damages. These terms are governed by New York law.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          Material changes will be posted here with an updated date. Questions:{' '}
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
