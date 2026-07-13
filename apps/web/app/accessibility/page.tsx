import type { Metadata } from 'next'
import LegalPageShell, { LegalSection } from '@/components/LegalPageShell'

export const metadata: Metadata = {
  title: 'Accessibility | Scout',
  description: "Scout's accessibility commitment, known limitations, and how to reach us.",
}

export default function AccessibilityPage() {
  return (
    <LegalPageShell title="Accessibility" updated="July 13, 2026">
      <LegalSection title="Our commitment">
        <p>
          We want every Cornell student-athlete and alum to be able to use Scout,
          including people who rely on screen readers, keyboard navigation, or other
          assistive technology. Our target is conformance with the Web Content
          Accessibility Guidelines (WCAG) 2.2 Level AA.
        </p>
      </LegalSection>

      <LegalSection title="Where we are today">
        <p>
          We are not there yet. A recent internal review found real gaps, and we would
          rather list them honestly than claim conformance we haven&apos;t earned. Known
          limitations right now include:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            Many form fields — including sign-in and sign-up — rely on placeholder text
            and are not programmatically labeled for screen readers
          </li>
          <li>
            Dialogs (such as the alumni detail and message windows) do not yet announce
            themselves, trap keyboard focus, or close with the Escape key
          </li>
          <li>
            Some clickable cards and list rows cannot be reached or activated with a
            keyboard alone
          </li>
          <li>
            Some lighter text and status colors fall below recommended contrast ratios
          </li>
          <li>
            Some icon-only buttons and links lack accessible names, especially on small
            screens
          </li>
          <li>
            Errors and status updates are shown visually but are not yet announced to
            screen readers
          </li>
          <li>
            Animations do not yet respect the reduced-motion system preference, and the
            About page includes an auto-scrolling element without a pause control
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="What we're doing about it">
        <p>
          We are working through these issues, prioritizing the sign-in and sign-up
          forms, keyboard access to core flows, and dialog behavior, followed by contrast
          and screen-reader announcements. This page will be updated as gaps are closed.
        </p>
      </LegalSection>

      <LegalSection title="Feedback and help">
        <p>
          If you hit an accessibility barrier on Scout, or need any content from the
          service in a form that works for you, email{' '}
          <a
            href="mailto:contact@scoutcornell.com?subject=Accessibility"
            className="underline hover:text-[--text-primary]"
          >
            contact@scoutcornell.com
          </a>{' '}
          with &ldquo;Accessibility&rdquo; in the subject line. We aim to respond within
          5 business days and to work with you until you can do what you came to do.
        </p>
      </LegalSection>
    </LegalPageShell>
  )
}
