import { createClient } from '@/lib/supabase/server'
import Link from '@/components/Link'
import { notFound } from 'next/navigation'
import { ArrowRight, Users, Briefcase, GraduationCap } from 'lucide-react'
import type { Metadata } from 'next'

// ── Slug → team-name mapping ──────────────────────────────────────────
// Maps clean URL slugs like "hockey" to the official Cornell team names.
// Supports both generic slugs ("basketball" → both men's + women's) and
// specific slugs ("mens-basketball", "womens-basketball").
const SLUG_MAP: Record<string, string[]> = {
  baseball: ['Baseball'],
  basketball: ["Men's Basketball", "Women's Basketball"],
  'mens-basketball': ["Men's Basketball"],
  'womens-basketball': ["Women's Basketball"],
  equestrian: ['Equestrian'],
  fencing: ['Fencing'],
  'field-hockey': ['Field Hockey'],
  football: ['Football'],
  'sprint-football': ['Sprint Football'],
  golf: ["Men's Golf"],
  hockey: ["Men's Ice Hockey", "Women's Ice Hockey", 'Field Hockey'],
  'mens-hockey': ["Men's Ice Hockey"],
  'womens-hockey': ["Women's Ice Hockey"],
  lacrosse: ["Men's Lacrosse", "Women's Lacrosse"],
  'mens-lacrosse': ["Men's Lacrosse"],
  'womens-lacrosse': ["Women's Lacrosse"],
  rowing: ["Men's Rowing", "Women's Rowing", 'Rowing'],
  soccer: ["Men's Soccer", "Women's Soccer"],
  'mens-soccer': ["Men's Soccer"],
  'womens-soccer': ["Women's Soccer"],
  softball: ['Softball'],
  squash: ["Men's Squash", "Women's Squash"],
  swimming: ["Men's Swimming And Diving", "Women's Swimming And Diving"],
  tennis: ["Men's Tennis", "Women's Tennis"],
  'mens-tennis': ["Men's Tennis"],
  'womens-tennis': ["Women's Tennis"],
  track: ["Men's Track And Field", "Women's Track And Field"],
  volleyball: ["Women's Volleyball"],
  wrestling: ['Wrestling'],
  polo: ['Polo'],
  sailing: ["Women's Sailing"],
  gymnastics: ["Women's Gymnastics"],
}

// ── Sport metadata ─────────────────────────────────────────────────────
const SPORT_META: Record<string, { description: string; longDescription: string }> = {
  baseball: {
    description: 'Connect with Cornell Baseball alumni across every industry.',
    longDescription:
      "From the diamond to the boardroom — Cornell Baseball alumni have built careers across finance, tech, law, and beyond. Whether you're a current player scouting internships or an alum looking to network, Scout makes it easy to find your people.",
  },
  basketball: {
    description: 'Connect with Cornell Basketball alumni across every industry.',
    longDescription:
      "Cornell basketball alumni are making moves across every industry. Scout connects current players and alumni who share the hardwood bond — opening doors at top firms, startups, and everything in between.",
  },
  football: {
    description: 'Connect with Cornell Football alumni across every industry.',
    longDescription:
      "Cornell Football runs deep. Over decades, Big Red football players have gone on to lead in finance, tech, medicine, law, and more. Scout puts that entire network in your pocket — connect with alumni who've walked the same path from gridiron to career.",
  },
  hockey: {
    description: 'Connect with Cornell Hockey alumni across every industry.',
    longDescription:
      "Lynah Faithful for life. Cornell Hockey alumni form one of the tightest networks in college sports — and Scout connects you directly to them. From the ice to the executive suite, find the alumni who can open doors.",
  },
  soccer: {
    description: 'Connect with Cornell Soccer alumni across every industry.',
    longDescription:
      "Cornell Soccer alumni are spread across every field — not just the pitch. Scout helps current players and alumni connect, network, and build careers together. One tap to find an alum at your dream company.",
  },
  lacrosse: {
    description: 'Connect with Cornell Lacrosse alumni across every industry.',
    longDescription:
      "Cornell Lacrosse has produced leaders in every arena. Scout connects the lax community — from Schoellkopf to Wall Street, from Teagle to Silicon Valley. Find your next mentor, referral, or hire.",
  },
}

function getDefaultMeta(sport: string): { description: string; longDescription: string } {
  const displayName = sport
    .split('-')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .replace(/^Mens /, "Men's ")
    .replace(/^Womens /, "Women's ")
  return {
    description: `Connect with Cornell ${displayName} alumni across every industry.`,
    longDescription: `Cornell ${displayName} alumni have built incredible careers across every industry. Scout connects current athletes and alumni, making it easy to find mentors, land interviews, and grow your network.`,
  }
}

// ── Generate metadata for SEO ──────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>
}): Promise<Metadata> {
  const { sport } = await params
  const resolvedSlug = sport.toLowerCase()
  const teamNames = SLUG_MAP[resolvedSlug]

  if (!teamNames) {
    return {
      title: 'Sport Not Found | Scout Cornell',
      description: 'This sport page could not be found.',
    }
  }

  const meta = SPORT_META[resolvedSlug] ?? getDefaultMeta(resolvedSlug)
  const displayName = teamNames.length === 1
    ? teamNames[0]
    : teamNames.map(n => n.replace(/^Men's |^Women's /, '')).filter((v, i, a) => a.indexOf(v) === i).join(' & ')

  return {
    title: `Cornell ${displayName} Alumni Network | Scout`,
    description: meta.description,
    openGraph: {
      title: `Cornell ${displayName} Alumni Network | Scout`,
      description: meta.description,
    },
  }
}

// ── Page component ─────────────────────────────────────────────────────
export default async function SportLandingPage({
  params,
}: {
  params: Promise<{ sport: string }>
}) {
  const { sport } = await params
  const resolvedSlug = sport.toLowerCase()
  const teamNames = SLUG_MAP[resolvedSlug]

  // 404 if the slug doesn't map to any team
  if (!teamNames) {
    notFound()
  }

  const supabase = createClient()

  // Fetch alumni count for this sport
  const { count: alumniCount, error: countError } = await supabase
    .from('alumni')
    .select('id', { count: 'exact', head: true })
    .in('sport', teamNames)

  // Fetch a few featured alumni to show off (recent grads with companies)
  const { data: featuredAlumni } = await supabase
    .from('alumni')
    .select('id, full_name, company, role, graduation_year, sport')
    .in('sport', teamNames)
    .not('company', 'is', null)
    .not('role', 'is', null)
    .order('graduation_year', { ascending: false })
    .limit(6)

  const meta = SPORT_META[resolvedSlug] ?? getDefaultMeta(resolvedSlug)
  const displayName = teamNames.length === 1
    ? teamNames[0]
    : teamNames.map(n => n.replace(/^Men's |^Women's /, '')).filter((v, i, a) => a.indexOf(v) === i).join(' & ')

  const totalCount = alumniCount ?? 0

  return (
    <main className="min-h-screen">
      {/* ── Hero ── */}
      <section className="relative px-6 md:px-12 pt-20 pb-24 md:pt-28 md:pb-32">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-[--bg-primary] via-[--bg-secondary] to-[--bg-primary]" />

        <div className="max-w-4xl mx-auto">
          <div className="max-w-3xl animate-fade-in-up">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-[--text-tertiary] mb-6">
              <Link href="/" className="hover:text-[--school-primary] transition-colors">
                Home
              </Link>
              <span>/</span>
              <span className="text-[--text-primary] font-medium">{displayName}</span>
            </div>

            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-10 bg-[--school-primary]" />
              <span className="text-[--school-primary] text-xs font-semibold uppercase tracking-wider">
                Cornell {displayName} Network
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-5 leading-[1.05] tracking-tight">
              Cornell {displayName}
              <br />
              <span className="text-[--text-tertiary]">Alumni Network</span>
            </h1>

            <p className="text-lg md:text-xl text-[--text-secondary] max-w-2xl mb-8 leading-relaxed">
              {meta.longDescription}
            </p>

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 md:gap-6 mb-10">
              <div className="flex items-center gap-2 bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3">
                <Users size={18} className="text-[--school-primary]" />
                <div>
                  <span className="text-lg font-bold">{totalCount.toLocaleString()}</span>
                  <span className="text-[--text-tertiary] text-sm ml-1">Alumni</span>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-[--bg-secondary] border border-[--border-primary] rounded-xl px-4 py-3">
                <Briefcase size={18} className="text-[--school-primary]" />
                <div>
                  <span className="text-lg font-bold">{featuredAlumni?.length ?? 0}</span>
                  <span className="text-[--text-tertiary] text-sm ml-1">Featured</span>
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup?role=student"
                className="btn-primary flex items-center gap-2 px-7 py-3 text-sm font-semibold"
              >
                <GraduationCap size={15} />
                Join as Student-Athlete
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/signup?role=alumni"
                className="btn-secondary flex items-center gap-2 px-7 py-3 text-sm font-medium"
              >
                <Briefcase size={15} />
                Join as Alumni
              </Link>
              <Link
                href="/discover"
                className="btn-ghost flex items-center gap-2 px-7 py-3 text-sm"
              >
                Browse All Alumni
                <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Alumni preview (if any) ── */}
      {featuredAlumni && featuredAlumni.length > 0 && (
        <section className="px-6 md:px-12 py-16 md:py-20 bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-10 bg-[--school-primary]" />
              <span className="text-[--school-primary] text-xs font-semibold uppercase tracking-wider">
                Notable Alumni
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
              {displayName} alumni making moves
            </h2>
            <p className="text-[--text-tertiary] mb-8 max-w-lg">
              Recent graduates from Cornell {displayName} now working across industries.
            </p>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {featuredAlumni.map((alum) => (
                <div
                  key={alum.id}
                  className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-5 hover:border-[--border-secondary] transition-all duration-200"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar placeholder */}
                    <div className="w-10 h-10 rounded-full bg-[--bg-tertiary] flex items-center justify-center flex-shrink-0 text-xs font-bold text-[--text-tertiary]">
                      {alum.full_name
                        .split(' ')
                        .map((n: string) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{alum.full_name}</p>
                      {alum.role && (
                        <p className="text-[--text-tertiary] text-xs truncate">{alum.role}</p>
                      )}
                      {alum.company && (
                        <p className="text-[--text-tertiary] text-xs truncate">{alum.company}</p>
                      )}
                      <p className="text-[--text-quaternary] text-xs mt-0.5">
                        {alum.sport} &middot; &lsquo;{String(alum.graduation_year).slice(2)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA banner ── */}
      <section className="px-6 md:px-12 py-20 md:py-24">
        <div className="max-w-3xl mx-auto text-center">
          <div className="bg-[--bg-secondary] border border-[--school-primary]/20 rounded-2xl p-10 md:p-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Get access to {totalCount.toLocaleString()}+ {displayName} alumni
            </h2>
            <p className="text-[--text-secondary] mb-8 max-w-md mx-auto">
              Join Cornell athletes who are already connecting, networking, and landing
              opportunities through Scout.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
              <Link
                href="/signup?role=student"
                className="btn-primary inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold"
              >
                <GraduationCap size={15} />
                Join as Student-Athlete
                <ArrowRight size={15} />
              </Link>
              <Link
                href="/signup?role=alumni"
                className="btn-secondary inline-flex items-center gap-2 px-8 py-3.5 text-sm font-medium"
              >
                <Briefcase size={15} />
                Join as Alumni
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 md:px-12 py-8 border-t border-[--border-primary] text-center">
        <p className="text-xs text-[--text-quaternary]">
          &copy; 2026 Scout. Built for Cornell Athletes. Not affiliated with Cornell University.
        </p>
      </footer>
    </main>
  )
}
