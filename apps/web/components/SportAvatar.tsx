'use client'

import Avatar from '@/components/Avatar'
import SportIcon from '@/components/SportIcon'

// Avatar with a sport glyph tucked into the bottom-right — one consistent badge
// across every surface a person is shown. Sizes scale with the avatar so the
// badge reads at a glance without crowding the photo.
type Size = 'sm' | 'md' | 'lg' | 'xl' | '2xl'

const BADGE: Record<Size, { box: number; glyph: number; offset: string }> = {
  sm:   { box: 15, glyph: 9,  offset: '-bottom-0.5 -right-0.5' },
  md:   { box: 18, glyph: 11, offset: '-bottom-0.5 -right-0.5' },
  lg:   { box: 22, glyph: 13, offset: '-bottom-1 -right-1' },
  xl:   { box: 26, glyph: 15, offset: '-bottom-1 -right-1' },
  '2xl':{ box: 34, glyph: 20, offset: '-bottom-1 -right-1' },
}

interface Props {
  name: string
  sport?: string | null
  imageUrl?: string | null
  size?: Size
  className?: string
  /** Hide the badge (e.g. for non-athletes / custom contacts). */
  showSport?: boolean
}

export default function SportAvatar({
  name, sport, imageUrl, size = 'md', className = '', showSport = true,
}: Props) {
  const b = BADGE[size]
  return (
    <div className="relative inline-flex flex-shrink-0">
      <Avatar name={name} sport={sport ?? undefined} imageUrl={imageUrl} size={size} className={className} />
      {showSport && sport && (
        <span
          className={`absolute ${b.offset} flex items-center justify-center rounded-full bg-[--bg-primary] text-[--text-secondary] ring-1 ring-[--border-primary] shadow-sm`}
          style={{ width: b.box, height: b.box }}
          title={sport}
        >
          <SportIcon sport={sport} size={b.glyph} />
        </span>
      )}
    </div>
  )
}
