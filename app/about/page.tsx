'use client'

import Link from '@/components/Link'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import {
  ArrowRight,
  Users,
  Database,
  Mail,
  Target,
  Rocket,
  School,
  Search,
  MessageSquare,
  UserPlus,
  Sparkles,
  FileText,
  Briefcase,
  GraduationCap,
  UsersRound,
  CheckCircle2,
  Clock,
  Zap,
  Quote,
  ArrowUpRight,
  ChevronRight
} from 'lucide-react'

export default function AboutPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)

  useEffect(() => {
    const checkUser = async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUser({ email: user.email! })
      }
    }
    checkUser()
  }, [])

  return (
    <>
      <Navbar user={user} />

      <main className="overflow-hidden">
        {/* Hero Section - Different treatment with angled gradient */}
        <section className="relative px-6 md:px-12 pt-20 pb-32 md:pt-28 md:pb-40">
          {/* Angled background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-br from-[--bg-primary] via-[--bg-secondary] to-[--bg-primary]" />
            <div
              className="absolute bottom-0 left-0 right-0 h-32 bg-[--bg-secondary]"
              style={{ clipPath: 'polygon(0 100%, 100% 100%, 100% 0, 0 100%)' }}
            />
            {/* Accent line */}
            <div className="absolute top-1/2 left-0 w-1/3 h-px bg-gradient-to-r from-transparent via-[--school-primary]/30 to-transparent" />
            <div className="absolute top-1/3 right-0 w-1/4 h-px bg-gradient-to-l from-transparent via-blue-500/20 to-transparent" />
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="max-w-3xl animate-fade-in-up">
              {/* Eyebrow */}
              <div className="flex items-center gap-3 mb-6">
                <div className="h-px w-12 bg-[--school-primary]" />
                <span className="text-[--school-primary] text-sm font-semibold uppercase tracking-wider">Our Mission</span>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-[1.1] tracking-tight">
                Career success shouldn't
                <br />
                depend on <span className="text-[--text-tertiary]">who you know</span>
              </h1>

              <p className="text-xl text-[--text-secondary] max-w-2xl mb-8 leading-relaxed">
                But it does. Scout levels the playing field by giving every Cornell athlete
                access to the most powerful network in college sports.
              </p>

              <div className="flex gap-4 flex-wrap">
                {user ? (
                  <Link
                    href="/coach"
                    className="btn-primary flex items-center gap-2 group px-8 py-4 text-lg font-semibold shadow-lg shadow-[--school-primary]/30"
                  >
                    <Sparkles size={20} />
                    Get Your Career Plan
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className="btn-primary flex items-center gap-2 group"
                  >
                    Get Started Free
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* The Problem - Full width quote style */}
        <section className="bg-[--bg-secondary] px-6 md:px-12 py-20 md:py-28 relative">
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              <Quote size={48} className="text-[--school-primary]/20 absolute -top-4 -left-4" />
              <blockquote className="text-2xl md:text-3xl font-medium leading-relaxed text-[--text-primary] pl-8 border-l-4 border-[--school-primary]">
                We built Scout because we were tired of watching athletes from other schools
                land interviews through connections we didn't even know existed.
              </blockquote>
              <p className="mt-6 text-[--text-tertiary] pl-8">— The Scout Team</p>
            </div>
          </div>
        </section>

        {/* Stats - Horizontal scroll cards */}
        <section className="px-6 md:px-12 py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-[--bg-secondary] to-[--bg-primary]" />

          <div className="max-w-6xl mx-auto relative">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {[
                { value: '55', label: 'Years of Data', color: 'from-[--school-primary] to-red-500' },
                { value: '40+', label: 'Sports', color: 'from-blue-400 to-cyan-400' },
                { value: '17,000+', label: 'Alumni Profiles', color: 'from-emerald-400 to-teal-400' },
                { value: 'Free', label: 'For Athletes', color: 'from-amber-400 to-orange-400' },
              ].map((stat, i) => (
                <div
                  key={stat.label}
                  className="group relative bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className={`text-4xl md:text-5xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent mb-2`}>
                    {stat.value}
                  </div>
                  <div className="text-[--text-tertiary] text-sm">{stat.label}</div>

                  {/* Hover glow */}
                  <div className={`absolute inset-0 bg-gradient-to-r ${stat.color} opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity duration-300`} />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Offer - Staggered cards */}
        <section className="px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-12 bg-emerald-500" />
              <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">Features</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Everything you need to network
            </h2>
            <p className="text-[--text-tertiary] max-w-xl text-lg mb-12">
              Stop juggling LinkedIn, spreadsheets, and email. Scout brings it all together.
            </p>

            {/* Staggered feature cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Large left card */}
              <div className="md:row-span-2 group">
                <div className="h-full bg-gradient-to-br from-[--school-primary]/10 to-transparent border border-[--school-primary]/20 rounded-2xl p-8 hover:border-[--school-primary]/40 transition-all duration-300">
                  <div className="w-14 h-14 bg-[--school-primary] rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <Database size={28} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-3">Verified Alumni Database</h3>
                  <p className="text-[--text-secondary] leading-relaxed mb-6">
                    55 years of Cornell athlete rosters, enriched with LinkedIn data.
                    Every profile includes current role, company, industry, and contact info.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['Finance', 'Tech', 'Consulting', 'Law'].map(tag => (
                      <span key={tag} className="px-3 py-1 bg-[--bg-tertiary] text-[--text-tertiary] text-sm rounded-full">
                        {tag}
                      </span>
                    ))}
                    <span className="px-3 py-1 bg-[--school-primary]/10 text-[--school-primary] text-sm rounded-full">
                      +12 more
                    </span>
                  </div>
                </div>
              </div>

              {/* Right stacked cards */}
              <div className="group">
                <div className="h-full bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 hover:border-amber-500/40 transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Sparkles size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">AI Message Generation</h3>
                  <p className="text-[--text-tertiary] text-sm leading-relaxed">
                    Generate personalized outreach that references your shared athletic background.
                    No more generic templates.
                  </p>
                </div>
              </div>

              <div className="group">
                <div className="h-full bg-[--bg-secondary] border border-[--border-primary] rounded-2xl p-6 hover:border-emerald-500/40 transition-all duration-300">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <UserPlus size={22} className="text-white" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Network Tracker</h3>
                  <p className="text-[--text-tertiary] text-sm leading-relaxed">
                    Save contacts, track conversations, mark who you've reached out to.
                    Your entire pipeline in one place.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Coming Soon - Timeline style */}
        <section className="bg-[--bg-secondary] px-6 md:px-12 py-20 md:py-28">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-12 bg-blue-500" />
              <span className="text-blue-400 text-sm font-semibold uppercase tracking-wider">Roadmap</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-12">
              What's next
            </h2>

            {/* Timeline */}
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-8 top-0 bottom-0 w-px bg-[--border-primary] hidden md:block" />

              <div className="space-y-8">
                {[
                  {
                    status: 'live',
                    title: 'Cornell Launch',
                    description: 'Alumni database, search, AI outreach, network tracking',
                    icon: Rocket
                  },
                  {
                    status: 'building',
                    title: 'Career Coach AI',
                    description: 'Personalized guidance on who to contact, when, and how',
                    icon: Sparkles
                  },
                  {
                    status: 'planned',
                    title: 'Interview Prep',
                    description: 'Practice questions, mock interviews, and tips from alumni',
                    icon: MessageSquare
                  },
                  {
                    status: 'planned',
                    title: 'More Schools',
                    description: 'Expanding to Ivy League and beyond',
                    icon: School
                  },
                ].map((item, i) => (
                  <div key={item.title} className="flex gap-6 items-start group animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                    {/* Status dot */}
                    <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 ${
                      item.status === 'live'
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/30'
                        : item.status === 'building'
                        ? 'bg-[--school-primary] shadow-lg shadow-[--school-primary]/30'
                        : 'bg-[--bg-tertiary] border border-[--border-primary]'
                    }`}>
                      <item.icon size={24} className={item.status === 'planned' ? 'text-[--text-tertiary]' : 'text-white'} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold">{item.title}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          item.status === 'live'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.status === 'building'
                            ? 'bg-[--school-primary]/10 text-[--school-primary]'
                            : 'bg-[--bg-tertiary] text-[--text-tertiary]'
                        }`}>
                          {item.status === 'live' ? 'Live' : item.status === 'building' ? 'Building' : 'Planned'}
                        </span>
                      </div>
                      <p className="text-[--text-tertiary]">{item.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For - Marquee style sports */}
        <section className="px-6 md:px-12 py-20 md:py-28 relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Built for every Cornell athlete
            </h2>
            <p className="text-[--text-secondary] text-lg">
              Freshman exploring options. Seniors recruiting for full-time. Alumni looking to give back.
            </p>
          </div>

          {/* Scrolling sports marquee */}
          <div className="relative">
            <div className="flex gap-3 animate-marquee">
              {['Football', 'Basketball', 'Lacrosse', 'Soccer', 'Tennis', 'Swimming', 'Track & Field', 'Hockey', 'Rowing', 'Wrestling', 'Baseball', 'Volleyball', 'Golf', 'Fencing', 'Squash', 'Football', 'Basketball', 'Lacrosse', 'Soccer', 'Tennis'].map((sport, i) => (
                <span
                  key={`${sport}-${i}`}
                  className="px-5 py-2.5 bg-[--bg-secondary] border border-[--border-primary] rounded-full text-sm text-[--text-secondary] whitespace-nowrap hover:border-[--school-primary]/50 hover:text-[--text-primary] transition-colors cursor-default"
                >
                  {sport}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Alumni Join Section */}
        <section className="px-6 md:px-12 py-16 bg-gradient-to-r from-[--school-primary]/10 via-[--school-primary]/5 to-transparent border-y border-[--school-primary]/20">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-[--school-primary] rounded-2xl flex items-center justify-center shadow-lg shadow-[--school-primary]/30">
                <UserPlus size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Are you a Cornell athlete alumnus?</h3>
                <p className="text-[--text-tertiary]">Add your info so current athletes can find and connect with you.</p>
              </div>
            </div>
            <Link
              href="/join"
              className="btn-primary flex items-center gap-2 px-8 py-4 text-base font-semibold group whitespace-nowrap"
            >
              <UserPlus size={18} />
              Join the Network
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-20 md:py-28 relative">
          {/* Background accent */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-t from-[--school-primary]/5 to-transparent" />
            <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-[--school-primary]/10 rounded-full blur-3xl" />
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
          </div>

          <div className="max-w-3xl mx-auto text-center relative">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
              Start building your network
              <br />
              <span className="text-[--text-tertiary]">today</span>
            </h2>
            <p className="text-[--text-secondary] mb-10 text-lg max-w-md mx-auto">
              Join hundreds of Cornell athletes already using Scout to land interviews and build careers.
            </p>
            {user ? (
              <Link
                href="/coach"
                className="btn-primary inline-flex items-center gap-2 px-10 py-4 text-lg font-semibold group shadow-lg shadow-[--school-primary]/30"
              >
                <Sparkles size={20} />
                Start with Coach
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Link
                  href="/signup"
                  className="btn-primary inline-flex items-center gap-2 px-8 py-4 text-lg font-semibold group"
                >
                  Get Started Free
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  href="/join"
                  className="btn-secondary inline-flex items-center gap-2 px-6 py-4 text-base"
                >
                  <UserPlus size={18} />
                  Alumni? Add Your Info
                </Link>
              </div>
            )}
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
