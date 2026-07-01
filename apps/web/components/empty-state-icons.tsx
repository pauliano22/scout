import type { SVGProps } from 'react'

// -------------------------------------------------------------------
// Branded empty-state SVG icons for Scout
// Each icon uses a consistent 80×80 viewBox with Scout's Cornell red
// (#B31B1B) as the primary color and a warm secondary tone for depth.
// -------------------------------------------------------------------

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function Frame({ size = 80, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

/** Search empty — magnifying glass */
export function SearchEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <circle cx="34" cy="34" r="18" stroke="#B31B1B" strokeWidth="2.5" />
      <line x1="47" y1="47" x2="62" y2="62" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="34" cy="34" r="10" fill="#B31B1B" fillOpacity="0.08" />
    </Frame>
  )
}

/** Messages empty — chat bubble */
export function MessagesEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <path
        d="M16 28C16 23.6 19.6 20 24 20H56C60.4 20 64 23.6 64 28V48C64 52.4 60.4 56 56 56H44L36 64V56H24C19.6 56 16 52.4 16 48V28Z"
        stroke="#B31B1B"
        strokeWidth="2.5"
        fill="#B31B1B"
        fillOpacity="0.06"
      />
      <line x1="30" y1="34" x2="50" y2="34" stroke="#B31B1B" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="42" x2="44" y2="42" stroke="#B31B1B" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  )
}

/** Connections empty — two people / network nodes */
export function ConnectionsEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      {/* Person 1 */}
      <circle cx="28" cy="26" r="8" stroke="#B31B1B" strokeWidth="2.5" fill="#B31B1B" fillOpacity="0.06" />
      <path d="M16 58C16 48.6 21.4 42 28 42C34.6 42 40 48.6 40 58" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      {/* Person 2 */}
      <circle cx="52" cy="26" r="8" stroke="#B31B1B" strokeWidth="2.5" fill="#B31B1B" fillOpacity="0.06" />
      <path d="M40 58C40 48.6 45.4 42 52 42C58.6 42 64 48.6 64 58" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      {/* Connection line */}
      <line x1="36" y1="26" x2="44" y2="26" stroke="#B31B1B" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  )
}

/** Notifications empty — bell */
export function NotificationsEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <path
        d="M26 32C26 24.3 32.3 18 40 18C47.7 18 54 24.3 54 32V44L58 50H22L26 44V32Z"
        stroke="#B31B1B"
        strokeWidth="2.5"
        fill="#B31B1B"
        fillOpacity="0.06"
      />
      <path
        d="M34 54C34 57.3 36.7 60 40 60C43.3 60 46 57.3 46 54"
        stroke="#B31B1B"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="48" cy="22" r="6" fill="#B31B1B" />
    </Frame>
  )
}

/** Jobs empty — briefcase */
export function JobsEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <rect x="18" y="32" width="44" height="28" rx="4" stroke="#B31B1B" strokeWidth="2.5" fill="#B31B1B" fillOpacity="0.06" />
      <path d="M32 32V26C32 23.8 33.8 22 36 22H44C46.2 22 48 23.8 48 26V32" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="40" x2="40" y2="52" stroke="#B31B1B" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="44" x2="50" y2="44" stroke="#B31B1B" strokeWidth="2" strokeLinecap="round" />
    </Frame>
  )
}

/** Events empty — calendar */
export function EventsEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <rect x="16" y="24" width="48" height="44" rx="4" stroke="#B31B1B" strokeWidth="2.5" fill="#B31B1B" fillOpacity="0.06" />
      <line x1="16" y1="36" x2="64" y2="36" stroke="#B31B1B" strokeWidth="2.5" />
      <line x1="28" y1="16" x2="28" y2="26" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="52" y1="16" x2="52" y2="26" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="44" r="3" fill="#B31B1B" />
      <circle cx="40" cy="44" r="3" fill="#B31B1B" fillOpacity="0.4" />
      <circle cx="52" cy="44" r="3" fill="#B31B1B" fillOpacity="0.4" />
      <circle cx="28" cy="54" r="3" fill="#B31B1B" fillOpacity="0.4" />
      <circle cx="40" cy="54" r="3" fill="#B31B1B" />
    </Frame>
  )
}

/** Generic empty — circle with slash / nothing-here indicator */
export function GenericEmpty({ size }: { size?: number }) {
  return (
    <Frame size={size}>
      <circle cx="40" cy="40" r="22" stroke="#B31B1B" strokeWidth="2.5" fill="#B31B1B" fillOpacity="0.06" />
      <line x1="26" y1="26" x2="54" y2="54" stroke="#B31B1B" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="40" cy="40" r="4" fill="#B31B1B" />
    </Frame>
  )
}

/** Lookup map: icon key -> component */
export const emptyStateIcons = {
  'search-empty': SearchEmpty,
  'messages-empty': MessagesEmpty,
  'connections-empty': ConnectionsEmpty,
  'notifications-empty': NotificationsEmpty,
  'jobs-empty': JobsEmpty,
  'events-empty': EventsEmpty,
  'generic-empty': GenericEmpty,
} as const

export type EmptyStateIconKey = keyof typeof emptyStateIcons
