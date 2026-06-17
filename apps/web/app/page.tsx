'use client'

import Link from '@/components/Link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, GraduationCap, Briefcase } from 'lucide-react'
import Navbar from '@/components/Navbar'
import { postLoginPath } from '@/lib/auth/postLoginPath'
import type { UserRole } from '@scout/shared/types/database'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [showNavbar, setShowNavbar] = useState(false)

  useEffect(() => {
    const check = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_role, onboarding_completed')
        .eq('id', user.id)
        .single()
      router.push(
        postLoginPath(
          (profile?.account_role as UserRole | undefined) ?? 'student',
          Boolean(profile?.onboarding_completed),
        ),
      )
    }
    check()

    const onScroll = () => setShowNavbar(window.scrollY > window.innerHeight - 80)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [router])

  return (
    <>
      {/* Navbar — appears on scroll */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showNavbar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}>
        <Navbar user={user} />
      </div>

      <main>
        {/* ── Hero ── */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 relative">
          <div className="text-center max-w-3xl animate-fade-in-up">
            {/* Logo mark */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <img src="/favicon.svg" alt="Scout" className="w-10 h-10 opacity-90" />
              <span className="text-2xl font-bold tracking-tight">Scout</span>
            </div>

            {/* Eyebrow */}
            <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-5">
              Cornell Athletics Alumni Network
            </p>

            {/* Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05] tracking-tight text-[--text-primary]">
              Your network is<br />bigger than you think.
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-[--text-secondary] max-w-xl mx-auto mb-10 leading-relaxed">
              Connect with 18,000+ Cornell athlete alumni across every industry.
              Find mentors, land interviews, build your career.
            </p>

            {/* CTAs */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
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
            </div>
          </div>

          {/* Scroll hint */}
          <p className="absolute bottom-8 text-xs tracking-widest uppercase text-[--text-quaternary]">
            Scroll
          </p>
        </section>

        {/* ── How it works ── */}
        <section className="px-6 md:px-12 py-28 bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="mb-16">
              <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-3">How It Works</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                From cold outreach to warm introductions
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-px bg-[--border-primary] rounded-xl overflow-hidden border border-[--border-primary]">
              <div className="bg-[--bg-secondary] p-8">
                <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-4">01</p>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Discover</h3>
                <p className="text-sm text-[--text-secondary] leading-relaxed">
                  Search 55 years of Cornell athlete alumni by industry, company, sport, or graduation year.
                </p>
              </div>
              <div className="bg-[--bg-secondary] p-8">
                <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-4">02</p>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Connect</h3>
                <p className="text-sm text-[--text-secondary] leading-relaxed">
                  Generate personalized outreach messages in seconds. Reference shared experiences. Make it real.
                </p>
              </div>
              <div className="bg-[--bg-secondary] p-8">
                <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-4">03</p>
                <h3 className="text-lg font-semibold mb-3 tracking-tight">Track</h3>
                <p className="text-sm text-[--text-secondary] leading-relaxed">
                  Save contacts, manage conversations, and run your entire job search pipeline from one place.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Stats ── */}
        <section className="px-6 md:px-12 py-28">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
              {[
                { number: '55', label: 'Years of Rosters' },
                { number: '40+', label: 'Sports Represented' },
                { number: '18k+', label: 'Alumni Profiles' },
                { number: 'Free', label: 'For All Athletes' },
              ].map(({ number, label }) => (
                <div key={label} className="text-center">
                  <p className="text-4xl md:text-5xl font-bold text-[--school-primary] tracking-tight mb-1">{number}</p>
                  <p className="text-xs text-[--text-quaternary] tracking-wide">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Industries ── */}
        <section className="px-6 md:px-12 py-28 bg-[--bg-secondary]">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-xs font-medium tracking-widest uppercase text-[--text-quaternary] mb-3">Alumni in Every Industry</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              From Wall Street to Silicon Valley
            </h2>
            <p className="text-[--text-secondary] mb-10">Our alumni are everywhere.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {['Finance', 'Technology', 'Consulting', 'Healthcare', 'Law', 'Media', 'Real Estate', 'Education', 'Government'].map(ind => (
                <span key={ind} className="px-4 py-2 bg-[--bg-primary] border border-[--border-primary] rounded-lg text-sm text-[--text-secondary] font-medium">
                  {ind}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="px-6 md:px-12 py-32">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-5 tracking-tight">
              Ready to unlock your<br />athlete network?
            </h2>
            <p className="text-[--text-secondary] mb-8 max-w-md mx-auto">
              Join hundreds of Cornell athletes already building their careers through Scout.
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
        </section>
      </main>

      <footer className="px-6 md:px-12 py-8 border-t border-[--border-primary] text-center">
        <p className="text-xs text-[--text-quaternary]">© 2026 Scout. Built for Cornell Athletes. Not affiliated with Cornell University.</p>
      </footer>
    </>
  )
}
