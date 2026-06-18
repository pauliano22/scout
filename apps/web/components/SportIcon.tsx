import {
  PiFootball, PiBasketball, PiSoccerBall, PiVolleyball, PiBaseball,
  PiTennisBall, PiRacquet, PiHockey, PiSailboat,
  PiPersonSimpleSwim, PiPersonSimpleRun, PiGolf,
  PiPersonArmsSpread, PiBoxingGlove, PiHorse, PiTrophy,
} from 'react-icons/pi'
import { GiFencer } from 'react-icons/gi'
import { MdRowing } from 'react-icons/md'
import type { IconType } from 'react-icons'

// One consistent icon family (Phosphor) so the set reads as legit. Distinct
// glyphs for sports that are genuinely different — tennis (ball) vs squash
// (racquet), rowing (boat) vs sailing (sailboat), equestrian (horse) vs polo
// (mallet). Lacrosse and polo have no glyph in any library, so they're drawn
// here in Phosphor's outline style. Same-family pairs (ice/field hockey,
// baseball/softball, track/cross-country) intentionally share a glyph.

type Custom = 'lacrosse' | 'polo' | 'fieldhockey'

function resolve(raw: string): IconType | Custom {
  const s = raw.toLowerCase()
  if (s.includes('basketball')) return PiBasketball
  if (s.includes('soccer')) return PiSoccerBall
  if (s.includes('volleyball')) return PiVolleyball
  if (s.includes('baseball') || s.includes('softball')) return PiBaseball
  if (s.includes('squash')) return PiRacquet
  if (s.includes('tennis')) return PiTennisBall
  if (s.includes('field hockey')) return 'fieldhockey' // before generic hockey
  if (s.includes('hockey')) return PiHockey
  if (s.includes('lacrosse')) return 'lacrosse'
  if (s.includes('rowing') || s.includes('crew')) return MdRowing
  if (s.includes('sailing')) return PiSailboat
  if (s.includes('swim') || s.includes('diving')) return PiPersonSimpleSwim
  if (s.includes('track') || s.includes('cross country')) return PiPersonSimpleRun
  if (s.includes('golf')) return PiGolf
  if (s.includes('gymnastics')) return PiPersonArmsSpread
  if (s.includes('fencing')) return GiFencer
  if (s.includes('wrestling')) return PiBoxingGlove
  if (s.includes('polo')) return 'polo'              // before football & horse
  if (s.includes('equestrian')) return PiHorse
  if (s.includes('football')) return PiFootball       // after sprint-football
  return PiTrophy
}

interface Props { sport?: string | null; size?: number; className?: string }

export default function SportIcon({ sport, size = 16, className }: Props) {
  if (!sport) return null
  const r = resolve(sport)
  if (r === 'lacrosse') return <LacrosseStick size={size} className={className} />
  if (r === 'polo') return <PoloMallet size={size} className={className} />
  if (r === 'fieldhockey') return <FieldHockeySticks size={size} className={className} />
  const Icon = r
  return <Icon size={size} className={className} aria-hidden />
}

// Custom glyphs — Phosphor-style outline: 24 grid, ~1.7 stroke, round caps.
function Frame({ size, className, children }: { size: number; className?: string; children: React.ReactNode }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden
    >
      {children}
    </svg>
  )
}

function LacrosseStick({ size, className }: { size: number; className?: string }) {
  return (
    <Frame size={size} className={className}>
      <line x1="4" y1="20" x2="13.4" y2="10.6" />
      <ellipse cx="15.6" cy="8.2" rx="2.9" ry="4.2" transform="rotate(42 15.6 8.2)" />
      <line x1="13.9" y1="6.4" x2="17.3" y2="10" />
    </Frame>
  )
}

function PoloMallet({ size, className }: { size: number; className?: string }) {
  return (
    <Frame size={size} className={className}>
      <line x1="5.5" y1="19" x2="15" y2="9" />
      <line x1="12.4" y1="6.4" x2="17.6" y2="11.6" />
      <circle cx="5" cy="20" r="1.1" fill="currentColor" stroke="none" />
    </Frame>
  )
}

// Crossed field-hockey sticks — straight shafts with the J-hook head, distinct
// from ice hockey's blade.
function FieldHockeySticks({ size, className }: { size: number; className?: string }) {
  return (
    <Frame size={size} className={className}>
      <path d="M8 4 L 14.6 13.8 C 15.9 15.8 15 17.8 13 17.5" />
      <path d="M16 4 L 9.4 13.8 C 8.1 15.8 9 17.8 11 17.5" />
    </Frame>
  )
}
