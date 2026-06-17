import {
  MdSportsFootball, MdSportsBasketball, MdSportsSoccer, MdSportsVolleyball,
  MdSportsBaseball, MdSportsTennis, MdSportsHockey, MdSportsGolf,
  MdSportsGymnastics, MdSportsKabaddi, MdRowing, MdPool, MdDirectionsRun,
  MdSailing, MdEmojiEvents,
} from 'react-icons/md'
import { FaHorseHead } from 'react-icons/fa6'
import { GiFencer } from 'react-icons/gi'
import type { IconType } from 'react-icons'

// Production sport glyphs (Material Design + a couple of gap-fillers) so the
// badge reads as legit. Mapped by substring so gendered team names
// ("Men's Ice Hockey") resolve to the same base sport. Lacrosse has no glyph in
// any set, so it falls back to the trophy.
function iconFor(raw: string): IconType {
  const s = raw.toLowerCase()
  if (s.includes('basketball')) return MdSportsBasketball
  if (s.includes('soccer')) return MdSportsSoccer
  if (s.includes('volleyball')) return MdSportsVolleyball
  if (s.includes('baseball') || s.includes('softball')) return MdSportsBaseball
  if (s.includes('tennis') || s.includes('squash')) return MdSportsTennis
  if (s.includes('hockey')) return MdSportsHockey
  if (s.includes('rowing') || s.includes('crew')) return MdRowing
  if (s.includes('swim') || s.includes('diving')) return MdPool
  if (s.includes('track') || s.includes('cross country')) return MdDirectionsRun
  if (s.includes('golf')) return MdSportsGolf
  if (s.includes('gymnastics')) return MdSportsGymnastics
  if (s.includes('fencing')) return GiFencer
  if (s.includes('sailing')) return MdSailing
  if (s.includes('wrestling')) return MdSportsKabaddi
  if (s.includes('equestrian') || s.includes('polo')) return FaHorseHead
  if (s.includes('football')) return MdSportsFootball // after sprint-football etc.
  return MdEmojiEvents
}

interface Props { sport?: string | null; size?: number; className?: string }

export default function SportIcon({ sport, size = 16, className }: Props) {
  if (!sport) return null
  const Icon = iconFor(sport)
  return <Icon size={size} className={className} aria-hidden />
}
