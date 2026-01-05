import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import { 
  ArrowRight, 
  Users, 
  Database, 
  Mail, 
  Shield, 
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
  Zap
} from 'lucide-react'

export default async function AboutPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Navbar user={user ? { email: user.email! } : null} />

      <main className="overflow-hidden">
        {/* Hero Section */}
        <section className="px-6 md:px-12 py-20 md:py-28 max-w-5xl mx-auto relative">
          {/* Subtle gradient background */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-[--school-primary]/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <div className="animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--school-primary]/10 border border-[--school-primary]/20 rounded-full text-[--school-primary] text-xs font-medium mb-6">
              <Zap size={12} />
              Built by Cornell Athletes, for Cornell Athletes
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 leading-tight tracking-tight">
              Your unfair advantage
              <br />
              <span className="text-[--text-tertiary]">in the job market</span>
            </h1>
            
            <p className="text-lg md:text-xl text-[--text-secondary] max-w-2xl mb-8">
              Scout connects you with 20 years of Cornell athlete alumni — the network 
              you didn't know you had, now one search away.
            </p>

            <div className="flex gap-3 flex-wrap">
              <Link
                href={user ? '/discover' : '/signup'}
                className="btn-primary flex items-center gap-2"
              >
                {user ? 'Browse Alumni' : 'Get Started Free'}
                <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>

        {/* Current Features */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary] bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium mb-4">
                <CheckCircle2 size={12} />
                Available Now
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                What Scout Offers
              </h2>
              <p className="text-[--text-tertiary] max-w-xl mx-auto">
                Everything you need to tap into the most powerful network in college sports.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Feature 1 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-1">
                <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Database size={22} className="text-blue-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Alumni Database</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Access 20 years of Cornell athlete rosters — every sport, every graduation year, all searchable.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-2">
                <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Search size={22} className="text-purple-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Smart Search</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Filter by industry, company, sport, or graduation year. Find exactly who can help you break in.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-3">
                <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Sparkles size={22} className="text-amber-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">AI-Powered Outreach</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Generate personalized messages that reference shared experiences. No more awkward cold emails.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-4">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <UserPlus size={22} className="text-emerald-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Network Builder</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Save contacts, track who you've reached out to, and manage your entire job search in one place.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-5">
                <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Target size={22} className="text-rose-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Career Path Tracking</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Set daily goals, maintain streaks, and unlock achievements as you build your network.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="group bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 hover:border-[--border-secondary] transition-all duration-300 animate-fade-in-up stagger-5">
                <div className="w-12 h-12 bg-cyan-500/10 border border-cyan-500/20 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Mail size={22} className="text-cyan-400" />
                </div>
                <h3 className="text-base font-semibold mb-2">Direct Contact Info</h3>
                <p className="text-[--text-tertiary] text-sm leading-relaxed">
                  Get LinkedIn profiles and emails so you can reach out directly — no middleman required.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Coming Soon */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--school-primary]/10 border border-[--school-primary]/20 rounded-full text-[--school-primary] text-xs font-medium mb-4">
                <Clock size={12} />
                Coming Soon
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                What We're Building
              </h2>
              <p className="text-[--text-tertiary] max-w-xl mx-auto">
                We're just getting started. Here's what's on the roadmap.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Coming Soon 1 */}
              <div className="flex gap-4 p-5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl animate-fade-in-up stagger-1">
                <div className="w-10 h-10 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText size={18} className="text-[--text-secondary]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Resume & Cover Letter Tools</h3>
                  <p className="text-[--text-tertiary] text-sm">
                    AI-powered resume reviews and cover letter generators tailored for athlete backgrounds.
                  </p>
                </div>
              </div>

              {/* Coming Soon 2 */}
              <div className="flex gap-4 p-5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl animate-fade-in-up stagger-2">
                <div className="w-10 h-10 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageSquare size={18} className="text-[--text-secondary]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Interview Prep Resources</h3>
                  <p className="text-[--text-tertiary] text-sm">
                    Practice questions, mock interviews, and tips from alumni who've been through the process.
                  </p>
                </div>
              </div>

              {/* Coming Soon 3 */}
              <div className="flex gap-4 p-5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl animate-fade-in-up stagger-3">
                <div className="w-10 h-10 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase size={18} className="text-[--text-secondary]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Job & Opportunity Board</h3>
                  <p className="text-[--text-tertiary] text-sm">
                    Exclusive job postings and internship opportunities shared by the athlete alumni network.
                  </p>
                </div>
              </div>

              {/* Coming Soon 4 */}
              <div className="flex gap-4 p-5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl animate-fade-in-up stagger-4">
                <div className="w-10 h-10 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg flex items-center justify-center flex-shrink-0">
                  <GraduationCap size={18} className="text-[--text-secondary]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Athlete-Specific Career Resources</h3>
                  <p className="text-[--text-tertiary] text-sm">
                    Guides on translating athletic experience to professional skills that recruiters value.
                  </p>
                </div>
              </div>

              {/* Coming Soon 5 */}
              <div className="flex gap-4 p-5 bg-[--bg-secondary] border border-[--border-primary] rounded-xl animate-fade-in-up stagger-5 md:col-span-2">
                <div className="w-10 h-10 bg-[--bg-tertiary] border border-[--border-primary] rounded-lg flex items-center justify-center flex-shrink-0">
                  <UsersRound size={18} className="text-[--text-secondary]" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Team Collaboration Features</h3>
                  <p className="text-[--text-tertiary] text-sm">
                    Share contacts with teammates, coordinate outreach, and build your network together as a team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary] bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="animate-fade-in-up">
                <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">
                  Why we built this
                </h2>
                <div className="space-y-4 text-[--text-secondary]">
                  <p>
                    Student-athletes have one of the strongest built-in networks out there — thousands 
                    of alumni who played the same sport, understand the grind, and want to help.
                  </p>
                  <p>
                    But finding them is a nightmare. LinkedIn searches are slow. Alumni directories are 
                    outdated. And cold outreach to strangers gets ignored.
                  </p>
                  <p className="text-[--text-primary] font-medium">
                    We built Scout because we were tired of watching athletes from other schools land 
                    interviews through connections we didn't even know existed.
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 animate-fade-in-up stagger-2">
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-[--school-primary] mb-1">20</div>
                  <div className="text-[--text-tertiary] text-sm">Years of Rosters</div>
                </div>
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-blue-400 mb-1">40+</div>
                  <div className="text-[--text-tertiary] text-sm">Sports</div>
                </div>
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-emerald-400 mb-1">7000+</div>
                  <div className="text-[--text-tertiary] text-sm">Alumni Profiles</div>
                </div>
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6 text-center">
                  <div className="text-3xl md:text-4xl font-bold text-amber-400 mb-1">Free</div>
                  <div className="text-[--text-tertiary] text-sm">For Athletes</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who It's For */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary]">
          <div className="max-w-4xl mx-auto text-center animate-fade-in-up">
            <h2 className="text-2xl md:text-3xl font-semibold mb-6 tracking-tight">
              Built for every Cornell athlete
            </h2>
            <p className="text-[--text-secondary] text-lg mb-8 max-w-2xl mx-auto">
              Whether you're a freshman exploring options, a senior recruiting for full-time, 
              or an alum looking to give back — Scout is for you.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {['Football', 'Basketball', 'Lacrosse', 'Soccer', 'Tennis', 'Swimming', 'Track & Field', 'Hockey', 'Rowing', 'Wrestling'].map((sport) => (
                <span 
                  key={sport}
                  className="px-4 py-2 bg-[--bg-secondary] border border-[--border-primary] rounded-full text-sm text-[--text-secondary]"
                >
                  {sport}
                </span>
              ))}
              <span className="px-4 py-2 bg-[--bg-tertiary] border border-[--border-secondary] rounded-full text-sm text-[--text-primary] font-medium">
                + 30 more
              </span>
            </div>
          </div>
        </section>

        {/* What's Next */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary] bg-[--bg-secondary]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 animate-fade-in-up">
              <h2 className="text-2xl md:text-3xl font-semibold tracking-tight mb-3">
                Our Roadmap
              </h2>
              <p className="text-[--text-tertiary] max-w-xl mx-auto">
                Scout is launching at Cornell first — then expanding to universities nationwide.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="relative animate-fade-in-up stagger-1">
                <div className="bg-[--bg-primary] border-2 border-[--school-primary] rounded-xl p-6">
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-[--school-primary] text-white text-xs font-medium rounded-full">
                    Now
                  </div>
                  <div className="pt-2">
                    <Rocket size={24} className="text-[--school-primary] mb-3" />
                    <h3 className="font-semibold mb-2">Cornell Launch</h3>
                    <p className="text-[--text-tertiary] text-sm">
                      Free access for all Cornell athletes. Building the platform and gathering feedback.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative animate-fade-in-up stagger-2">
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6">
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-[--bg-tertiary] text-[--text-secondary] text-xs font-medium rounded-full border border-[--border-primary]">
                    Next
                  </div>
                  <div className="pt-2">
                    <Shield size={24} className="text-[--text-secondary] mb-3" />
                    <h3 className="font-semibold mb-2">Alumni Opt-In</h3>
                    <p className="text-[--text-tertiary] text-sm">
                      Tools for alumni to claim profiles, update info, and control their visibility.
                    </p>
                  </div>
                </div>
              </div>

              <div className="relative animate-fade-in-up stagger-3">
                <div className="bg-[--bg-primary] border border-[--border-primary] rounded-xl p-6">
                  <div className="absolute -top-3 left-6 px-3 py-1 bg-[--bg-tertiary] text-[--text-secondary] text-xs font-medium rounded-full border border-[--border-primary]">
                    2025
                  </div>
                  <div className="pt-2">
                    <School size={24} className="text-[--text-secondary] mb-3" />
                    <h3 className="font-semibold mb-2">More Schools</h3>
                    <p className="text-[--text-tertiary] text-sm">
                      Expanding to Ivy League and beyond. Same power, every campus.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-20 border-t border-[--border-primary]">
          <div className="max-w-3xl mx-auto text-center animate-fade-in-up">
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
              {user ? 'Browse Alumni' : 'Get Started Free'}
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