'use client'

import Link from '@/components/Link'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Users, Search, MessageSquare, Sparkles, ChevronDown, Zap, TrendingUp, Building2, UserPlus } from 'lucide-react'
import Navbar from '@/components/Navbar'

// Animated counter component
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const [hasAnimated, setHasAnimated] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !hasAnimated) {
          setHasAnimated(true)
          let start = 0
          const duration = 2000
          const increment = target / (duration / 16)

          const timer = setInterval(() => {
            start += increment
            if (start >= target) {
              setCount(target)
              clearInterval(timer)
            } else {
              setCount(Math.floor(start))
            }
          }, 16)
        }
      },
      { threshold: 0.5 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target, hasAnimated])

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>
}

// Floating orb component
function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <div
      className={`absolute rounded-full blur-3xl animate-float ${className}`}
      style={{ animationDelay: `${delay}s` }}
    />
  )
}

export default function HomePage() {
  const router = useRouter()
  const [showNavbar, setShowNavbar] = useState(false)
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/coach')
        return
      }
    }
    checkUser()

    const handleScroll = () => {
      const heroHeight = window.innerHeight
      setShowNavbar(window.scrollY > heroHeight - 100)
    }

    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [router])

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
        <section className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden">
          {/* Animated mesh gradient background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-[--bg-primary] via-[--bg-primary] to-[--bg-secondary]" />

            {/* Floating orbs */}
            <FloatingOrb className="top-1/4 left-1/4 w-[500px] h-[500px] bg-[--school-primary]/20" delay={0} />
            <FloatingOrb className="top-1/3 right-1/4 w-[400px] h-[400px] bg-blue-500/10" delay={1} />
            <FloatingOrb className="bottom-1/4 left-1/3 w-[300px] h-[300px] bg-purple-500/10" delay={2} />
            <FloatingOrb className="bottom-1/3 right-1/3 w-[350px] h-[350px] bg-amber-500/10" delay={0.5} />

            {/* Grid pattern overlay */}
            <div
              className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: `linear-gradient(var(--text-quaternary) 1px, transparent 1px),
                                  linear-gradient(90deg, var(--text-quaternary) 1px, transparent 1px)`,
                backgroundSize: '60px 60px'
              }}
            />
          </div>

          {/* Content */}
          <div className="relative z-10 text-center max-w-4xl">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8 animate-fade-in">
              <img src="/favicon.svg" alt="Scout" className="w-14 h-14 md:w-16 md:h-16" />
              <span className="text-3xl md:text-4xl font-bold tracking-tight">Scout</span>
            </div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[--school-primary]/10 border border-[--school-primary]/20 rounded-full text-[--school-primary] text-sm font-medium mb-6 animate-fade-in backdrop-blur-sm">
              <Sparkles size={14} className="animate-pulse" />
              AI-Powered Career Networking
            </div>

            {/* Main heading */}
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-[1.1] tracking-tight animate-fade-in-up">
              Your network is
              <br />
              <span className="bg-gradient-to-r from-[--school-primary] via-red-500 to-orange-500 bg-clip-text text-transparent">
                bigger than you think
              </span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-[--text-secondary] max-w-2xl mx-auto mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              Connect with <span className="text-[--text-primary] font-semibold">7,000+ Cornell athlete alumni</span> across
              every industry. Find mentors, land interviews, and build your career.
            </p>

            {/* CTA Buttons */}
            <div className="flex gap-4 justify-center flex-wrap animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <Link
                href={user ? '/discover' : '/signup'}
                className="btn-primary flex items-center gap-2 px-8 py-4 text-base font-semibold group"
              >
                {user ? 'Browse Alumni' : 'Get Started Free'}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>

              <Link
                href="/join"
                className="btn-secondary flex items-center gap-2 px-8 py-4 text-base font-semibold group"
              >
                <UserPlus size={18} />
                Alumni? Join Here
              </Link>
            </div>
          </div>

          {/* Scroll indicator */}
          <button
            onClick={scrollToContent}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[--text-quaternary] hover:text-[--text-secondary] transition-colors"
            aria-label="Scroll down"
          >
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs uppercase tracking-widest">Scroll</span>
              <ChevronDown size={20} className="animate-bounce" />
            </div>
          </button>
        </section>

        {/* Features Section - Bento Grid */}
        <section className="px-6 md:px-12 py-24 bg-[--bg-secondary] relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-[--school-primary]/5 to-transparent rounded-full blur-3xl" />

          <div className="max-w-6xl mx-auto relative">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-medium mb-4">
                <Zap size={12} />
                How It Works
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                From cold outreach to warm introductions
              </h2>
              <p className="text-[--text-tertiary] max-w-xl mx-auto text-lg">
                Everything you need to turn your athletic network into career opportunities.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid md:grid-cols-3 gap-4">
              {/* Large feature card */}
              <div className="md:col-span-2 md:row-span-2 group relative bg-gradient-to-br from-[--bg-primary] to-[--bg-tertiary] border border-[--border-primary] rounded-2xl p-8 overflow-hidden hover:border-[--school-primary]/50 transition-all duration-500">
                <div className="absolute top-0 right-0 w-64 h-64 bg-[--school-primary]/10 rounded-full blur-3xl group-hover:bg-[--school-primary]/20 transition-all duration-500" />

                <div className="relative">
                  <div className="w-14 h-14 bg-gradient-to-br from-[--school-primary] to-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-[--school-primary]/20">
                    <Search size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Discover Your Network</h3>
                  <p className="text-[--text-secondary] text-lg leading-relaxed mb-6">
                    Search 20 years of Cornell athlete alumni by industry, company, sport, or graduation year.
                    Your next mentor is one search away.
                  </p>

                  {/* Mini search preview */}
                  <div className="bg-[--bg-primary]/50 backdrop-blur border border-[--border-primary] rounded-xl p-4">
                    <div className="flex gap-2 mb-3">
                      <span className="px-3 py-1 bg-[--school-primary]/10 text-[--school-primary] text-sm rounded-full">Finance</span>
                      <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-sm rounded-full">Tech</span>
                      <span className="px-3 py-1 bg-purple-500/10 text-purple-400 text-sm rounded-full">Consulting</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[--text-tertiary]">
                      <span>Goldman Sachs</span>
                      <span>•</span>
                      <span>Google</span>
                      <span>•</span>
                      <span>McKinsey</span>
                      <span>•</span>
                      <span className="text-[--school-primary]">+2,400 more</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Card */}
              <div className="group relative bg-gradient-to-br from-[--bg-primary] to-[--bg-tertiary] border border-[--border-primary] rounded-2xl p-6 overflow-hidden hover:border-amber-500/50 transition-all duration-500">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all duration-500" />

                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-amber-500/20">
                    <MessageSquare size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">AI-Powered Outreach</h3>
                  <p className="text-[--text-tertiary] text-sm leading-relaxed">
                    Generate personalized messages that reference shared experiences. No more awkward cold emails.
                  </p>
                </div>
              </div>

              {/* Network Card */}
              <div className="group relative bg-gradient-to-br from-[--bg-primary] to-[--bg-tertiary] border border-[--border-primary] rounded-2xl p-6 overflow-hidden hover:border-emerald-500/50 transition-all duration-500">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all duration-500" />

                <div className="relative">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                    <Users size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Track & Manage</h3>
                  <p className="text-[--text-tertiary] text-sm leading-relaxed">
                    Save contacts, track conversations, and manage your entire job search pipeline.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 md:px-12 py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-[--school-primary]/5 via-transparent to-blue-500/5" />

          <div className="max-w-5xl mx-auto relative">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center group">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-[--school-primary] to-red-500 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter target={20} />
                </div>
                <p className="text-[--text-tertiary] text-sm">Years of Rosters</p>
              </div>
              <div className="text-center group">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter target={40} suffix="+" />
                </div>
                <p className="text-[--text-tertiary] text-sm">Sports Represented</p>
              </div>
              <div className="text-center group">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent mb-2">
                  <AnimatedCounter target={7000} suffix="+" />
                </div>
                <p className="text-[--text-tertiary] text-sm">Alumni Profiles</p>
              </div>
              <div className="text-center group">
                <div className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent mb-2">
                  Free
                </div>
                <p className="text-[--text-tertiary] text-sm">For All Athletes</p>
              </div>
            </div>
          </div>
        </section>

        {/* Industries Section */}
        <section className="px-6 md:px-12 py-24 bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Alumni in every industry
              </h2>
              <p className="text-[--text-tertiary] text-lg">
                From Wall Street to Silicon Valley, our alumni are everywhere.
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <div className="flex items-center gap-2 px-5 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 font-medium hover:scale-105 transition-transform cursor-default">
                <TrendingUp size={18} />
                Finance
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 font-medium hover:scale-105 transition-transform cursor-default">
                <Zap size={18} />
                Technology
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 font-medium hover:scale-105 transition-transform cursor-default">
                <Building2 size={18} />
                Consulting
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-pink-500/10 border border-pink-500/20 rounded-xl text-pink-400 font-medium hover:scale-105 transition-transform cursor-default">
                <Users size={18} />
                Healthcare
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 font-medium hover:scale-105 transition-transform cursor-default">
                <Building2 size={18} />
                Law
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-orange-500/10 border border-orange-500/20 rounded-xl text-orange-400 font-medium hover:scale-105 transition-transform cursor-default">
                <MessageSquare size={18} />
                Media
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-24 relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-t from-[--school-primary]/10 to-transparent" />
            <FloatingOrb className="top-1/4 left-1/4 w-[400px] h-[400px] bg-[--school-primary]/10" delay={0} />
            <FloatingOrb className="bottom-1/4 right-1/4 w-[300px] h-[300px] bg-blue-500/10" delay={1} />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              Ready to unlock your
              <br />
              <span className="bg-gradient-to-r from-[--school-primary] to-orange-500 bg-clip-text text-transparent">
                athlete network?
              </span>
            </h2>
            <p className="text-[--text-secondary] mb-10 text-lg max-w-md mx-auto">
              Join hundreds of Cornell athletes already building their careers through Scout.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
              <Link
                href={user ? '/discover' : '/signup'}
                className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg font-semibold group"
              >
                {user ? 'Start Networking' : 'Get Started Free'}
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/join"
                className="btn-secondary inline-flex items-center gap-2 px-6 py-4 text-base font-medium"
              >
                <UserPlus size={18} />
                Alumni? Join Here
              </Link>
            </div>
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
