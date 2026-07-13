import type { Metadata } from 'next'
import Link from 'next/link'
import LegalPageShell, { LegalSection } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy | Scout',
  description: 'How Scout collects, uses, and protects your information.',
}

export default function PrivacyPage() {
  return (
    <LegalPageShell title="Privacy Policy" updated="July 13, 2026">
      <LegalSection title="What Scout is">
        <p>
          Scout helps Cornell student-athletes find and reach out to alumni who played
          their sport. Here, in plain language, is what information we hold and the
          choices you have.
        </p>
      </LegalSection>

      <LegalSection title="What we hold">
        <p>
          <span className="font-medium text-[--text-primary]">Students</span> — your
          name and Cornell email, sport and graduation year, the career interests you
          enter, and your activity on Scout. We do not collect academic records, grades,
          or financial information.
        </p>
        <p>
          <span className="font-medium text-[--text-primary]">Alumni</span> —
          professional profiles: name, sport, graduation year, role, company, location,
          and LinkedIn URL. Many were compiled from publicly available sources, such as
          published athletics rosters and public professional profiles. You can claim
          your profile to update it, or request removal at{' '}
          <Link href="/remove" className="underline hover:text-[--text-primary]">
            scoutcornell.com/remove
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>
          To match students with relevant alumni, to draft AI-assisted outreach messages
          (you review every draft and send it from your own email), and to run and
          secure Scout. A small number of service providers — hosting, email, AI, and
          analytics — process data only as needed to run Scout. We never sell personal
          data or use it for advertising. Essential cookies keep you signed in.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          Delete your account anytime from Settings. Alumni can request removal — no
          account needed — at{' '}
          <Link href="/remove" className="underline hover:text-[--text-primary]">
            /remove
          </Link>
          . Questions or requests:{' '}
          <a
            href="mailto:ian@scoutcornell.com"
            className="underline hover:text-[--text-primary]"
          >
            ian@scoutcornell.com
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
