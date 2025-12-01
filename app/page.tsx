import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import { ArrowRight, Users, Search, MessageSquare, Shield } from 'lucide-react'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <Navbar user={user ? { email: user.email! } : null} />
      
      <main>
        {/* Hero Section */}
        <section className="px-6 md:px-12 py-24 md:py-32 max-w-6xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-cornell-red/10 border border-cornell-red/30 rounded-full">
            <span className="text-cornell-red-light text-sm font-semibold">
              🏆 Built by Cornell Athletes, for Cornell Athletes
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold font-display mb-6 leading-tight">
            Your network is your{' '}
            <span className="bg-gradient-to-r from-cornell-red to-cornell-red-light bg-clip-text text-transparent">
              competitive edge
            </span>
          </h1>
          
          <p className="text-xl text-white/50 max-w-2xl mx-auto mb-10">
            Connect with Cornell athlete alumni who've made it in finance, tech, consulting, and more. 
            Get personalized introductions and insider advice.
          </p>

          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href={user ? '/discover' : '/signup'}
              className="btn-primary flex items-center gap-2 text-lg"
            >
              {user ? 'Browse Alumni' : 'Get Started'}
              <ArrowRight size={20} />
            </Link>
            <Link
              href="/about"
              className="btn-secondary text-lg"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-6 md:px-12 py-20 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold font-display text-center mb-16">
              How Scout Works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-8">
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-cornell-red/20 to-cornell-red-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Search size={28} className="text-cornell-red-light" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Discover Alumni</h3>
                <p className="text-white/50">
                  Search our database of Cornell athlete alumni by industry, company, sport, or name.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-cornell-red/20 to-cornell-red-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users size={28} className="text-cornell-red-light" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Build Your Network</h3>
                <p className="text-white/50">
                  Save promising contacts to your network and track who you've reached out to.
                </p>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 text-center">
                <div className="w-14 h-14 bg-gradient-to-br from-cornell-red/20 to-cornell-red-light/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <MessageSquare size={28} className="text-cornell-red-light" />
                </div>
                <h3 className="text-xl font-semibold mb-3">AI-Powered Outreach</h3>
                <p className="text-white/50">
                  Generate personalized messages based on their background and your interests.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 md:px-12 py-20 bg-gradient-to-r from-cornell-red/5 to-transparent">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-4xl md:text-5xl font-bold font-display text-cornell-red-light mb-2">
                  500+
                </div>
                <p className="text-white/50">Alumni in Database</p>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-display text-cornell-red-light mb-2">
                  40+
                </div>
                <p className="text-white/50">Sports Represented</p>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-display text-cornell-red-light mb-2">
                  85%
                </div>
                <p className="text-white/50">Response Rate</p>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-display text-cornell-red-light mb-2">
                  Top 50
                </div>
                <p className="text-white/50">Companies Represented</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="px-6 md:px-12 py-20 border-t border-white/5">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-6 text-white/50">
              <Shield size={20} />
              <span className="text-sm font-medium">Privacy First</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              Built with respect for alumni privacy
            </h2>
            <p className="text-white/50 max-w-2xl mx-auto">
              Our database is built from opt-in signups, public records, and alumni referrals. 
              All alumni have the ability to control their visibility and can opt out at any time.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-24">
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-cornell-red/20 to-cornell-red-light/10 border border-cornell-red/20 rounded-3xl p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold font-display mb-4">
              Ready to level up your network?
            </h2>
            <p className="text-white/60 mb-8 max-w-xl mx-auto">
              Join hundreds of Cornell athletes already using Scout to land dream internships and jobs.
            </p>
            <Link
              href={user ? '/discover' : '/signup'}
              className="btn-primary inline-flex items-center gap-2 text-lg"
            >
              {user ? 'Start Networking' : 'Create Free Account'}
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-white/5 text-center text-white/30 text-sm">
        <p>© 2024 Scout. Built for Cornell Athletes. Not affiliated with Cornell University.</p>
      </footer>
    </>
  )
}
