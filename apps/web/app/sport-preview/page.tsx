// TEMPORARY preview — renders every Cornell sport's glyph for design review.
// Not linked anywhere; delete once the icon set is approved.
import SportIcon from '@/components/SportIcon'
import Avatar from '@/components/Avatar'
import { SPORTS_LIST } from '@/lib/sportUtils'

export default function SportPreviewPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Sport glyphs</h1>
      <p className="text-sm text-[--text-tertiary] mb-8">Temporary preview — every sport, at icon and badge size.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5">
        {SPORTS_LIST.map(sport => (
          <div key={sport} className="flex items-center gap-3">
            {/* Badge size, as it appears on a card avatar */}
            <div className="relative shrink-0">
              <Avatar name={sport.replace(/Men's |Women's /, '')} size="lg" />
              <span className="absolute -bottom-1 -right-1 w-[22px] h-[22px] rounded-full bg-[--bg-primary] ring-1 ring-[--border-primary] flex items-center justify-center text-[--text-secondary]">
                <SportIcon sport={sport} size={13} />
              </span>
            </div>
            {/* Larger, to judge the glyph itself */}
            <SportIcon sport={sport} size={24} className="text-[--text-secondary] shrink-0" />
            <span className="text-sm text-[--text-secondary] min-w-0 truncate">{sport}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
