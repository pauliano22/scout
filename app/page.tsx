'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ArrowRight, Users, Search, MessageSquare, Shield, ChevronDown } from 'lucide-react'
import Navbar from '@/components/Navbar'

export default function HomePage() {
  const [showNavbar, setShowNavbar] = useState(false)
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    // Check for user session
    const checkUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({ email: user.email! })
      }
    }
    checkUser()

    // Handle scroll for navbar visibility
    const handleScroll = () => {
      const heroHeight = window.innerHeight
      setShowNavbar(window.scrollY > heroHeight - 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToContent = () => {
    window.scrollTo({
      top: window.innerHeight,
      behavior: 'smooth'
    })
  }

  return (
    <>
      {/* Navbar - hidden until scroll */}
      <div className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showNavbar ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none'
      }`}>
        <Navbar user={user} />
      </div>

      <main>
        {/* Full Screen Hero */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6 relative">
          {/* Background gradient */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[--school-primary]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          </div>

          {/* Logo + Name */}
          <div className="flex items-center gap-3 mb-8 animate-fade-in">
            <img src="/favicon.svg" alt="Scout" className="w-16 h-16 md:w-20 md:h-20" />
            <span className="text-4xl md:text-5xl font-bold tracking-tight">Scout</span>
          </div>

          {/* Main Content */}
          <div className="text-center max-w-3xl animate-fade-in-up">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-semibold mb-6 leading-tight tracking-tight">
              <span className="whitespace-nowrap">Fast & Easy Networking</span>
              <br />
              <span className="text-[--school-primary] whitespace-nowrap">for Cornell Athletes</span>
            </h1>

            <p className="text-lg md:text-xl text-[--text-tertiary] max-w-xl mx-auto mb-10">
              Your network is bigger than you think.
            </p>

            <div className="flex gap-3 justify-center flex-wrap">
              <Link
                href={user ? '/discover' : '/signup'}
                className="btn-primary flex items-center gap-2 px-6 py-3 text-base"
              >
                {user ? 'Browse Alumni' : 'Get Started'}
                <ArrowRight size={18} />
              </Link>

              <Link
                href="/about"
                className="btn-secondary px-6 py-3 text-base"
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <button 
            onClick={scrollToContent}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[--text-quaternary] hover:text-[--text-secondary] transition-colors animate-bounce"
            aria-label="Scroll down"
          >
            <ChevronDown size={28} />
          </button>
        </section>

        {/* Features Section */}
        <section className="px-6 md:px-12 py-24 border-t border-[--border-primary] bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                How Scout Works
              </h2>
              <p className="text-[--text-tertiary] max-w-lg mx-auto">
                Three simple steps to tap into 20 years of Cornell athlete alumni.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-colors">
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Search size={22} className="text-blue-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Discover Alumni</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Search our database by industry, company, sport, or graduation year. Find exactly who you need.
                </p>
              </div>

              <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-colors">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-4">
                  <Users size={22} className="text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Build Your Network</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Save contacts, track outreach, and manage your entire job search in one place.
                </p>
              </div>

              <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-colors">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare size={22} className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">AI-Powered Outreach</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Generate personalized messages that reference shared experiences. No more awkward cold emails.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 md:px-12 py-24 border-t border-[--border-primary]">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[--text-primary] mb-2">
                  20
                </div>
                <p className="text-[--text-quaternary] text-sm">Years of Rosters</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[--text-primary] mb-2">
                  40+
                </div>
                <p className="text-[--text-quaternary] text-sm">Sports Represented</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[--text-primary] mb-2">
                  7000+
                </div>
                <p className="text-[--text-quaternary] text-sm">Alumni Profiles</p>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-[--school-primary] mb-2">
                  Free
                </div>
                <p className="text-[--text-quaternary] text-sm">For All Athletes</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="px-6 md:px-12 py-24 border-t border-[--border-primary] bg-[--bg-secondary]">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--bg-tertiary] border border-[--border-primary] rounded-full mb-6">
              <Shield size={14} className="text-[--text-quaternary]" />
              <span className="text-xs font-medium text-[--text-quaternary] uppercase tracking-wide">Privacy First</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4 tracking-tight">
              Built with respect for alumni privacy
            </h2>
            <p className="text-[--text-tertiary] max-w-xl mx-auto">
              Our database is built from public athletic rosters and LinkedIn profiles. 
              All alumni can control their visibility and opt out at any time.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-24 border-t border-[--border-primary]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
              Ready to tap into your network?
            </h2>
            <p className="text-[--text-tertiary] mb-8 max-w-md mx-auto">
              Join Scout for free and start connecting with Cornell athlete alumni today.
            </p>
            <Link
              href={user ? '/discover' : '/signup'}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base"
            >
              {user ? 'Start Networking' : 'Create Free Account'}
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-[--border-primary] text-center text-[--text-quaternary] text-xs">
        <p>© 2026 Scout. Built for Cornell Athletes. Not affiliated with Cornell University.</p>
      </footer>
    </>
  )
}