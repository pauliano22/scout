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
        <section className="px-6 md:px-12 py-24 md:py-32 max-w-5xl mx-auto text-center">
          <div className="inline-block mb-6 px-4 py-2 bg-[#111113] border border-[#27272a] rounded-full">
            <span className="text-[#a1a1aa] text-sm font-medium">
              Built by Cornell Athletes, for Cornell Athletes
            </span>
          </div>
          
          <h1 className="text-4xl md:text-6xl font-semibold mb-6 leading-tight tracking-tight">
            Your network is your{' '}
            <span className="text-[#B31B1B]">
              competitive edge
            </span>
          </h1>
          
          <p className="text-lg text-[#71717a] max-w-2xl mx-auto mb-10">
            Connect with Cornell athlete alumni who've made it in finance, tech, consulting, and more. 
            Get personalized introductions and insider advice.
          </p>

          <div className="flex gap-3 justify-center flex-wrap">
            <Link
              href={user ? '/discover' : '/signup'}
              className="btn-primary flex items-center gap-2"
            >
              {user ? 'Browse Alumni' : 'Get Started'}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/about"
              className="btn-secondary"
            >
              Learn More
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="px-6 md:px-12 py-20 border-t border-[#1f1f23]">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-semibold text-center mb-16 tracking-tight">
              How Scout Works
            </h2>
            
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-[#111113] border border-[#27272a] rounded-xl p-6">
                <div className="w-10 h-10 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mb-4">
                  <Search size={20} className="text-[#a1a1aa]" />
                </div>
                <h3 className="text-base font-semibold mb-2">Discover Alumni</h3>
                <p className="text-[#71717a] text-sm">
                  Search our database of Cornell athlete alumni by industry, company, sport, or name.
                </p>
              </div>

              <div className="bg-[#111113] border border-[#27272a] rounded-xl p-6">
                <div className="w-10 h-10 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mb-4">
                  <Users size={20} className="text-[#a1a1aa]" />
                </div>
                <h3 className="text-base font-semibold mb-2">Build Your Network</h3>
                <p className="text-[#71717a] text-sm">
                  Save promising contacts to your network and track who you've reached out to.
                </p>
              </div>

              <div className="bg-[#111113] border border-[#27272a] rounded-xl p-6">
                <div className="w-10 h-10 bg-[#18181b] border border-[#27272a] rounded-lg flex items-center justify-center mb-4">
                  <MessageSquare size={20} className="text-[#a1a1aa]" />
                </div>
                <h3 className="text-base font-semibold mb-2">AI-Powered Outreach</h3>
                <p className="text-[#71717a] text-sm">
                  Generate personalized messages based on their background and your interests.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="px-6 md:px-12 py-20 border-t border-[#1f1f23]">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl md:text-4xl font-semibold text-[#fafafa] mb-1">
                  500+
                </div>
                <p className="text-[#52525b] text-sm">Alumni in Database</p>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-semibold text-[#fafafa] mb-1">
                  40+
                </div>
                <p className="text-[#52525b] text-sm">Sports Represented</p>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-semibold text-[#fafafa] mb-1">
                  85%
                </div>
                <p className="text-[#52525b] text-sm">Response Rate</p>
              </div>
              <div>
                <div className="text-3xl md:text-4xl font-semibold text-[#fafafa] mb-1">
                  Top 50
                </div>
                <p className="text-[#52525b] text-sm">Companies Represented</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Section */}
        <section className="px-6 md:px-12 py-20 border-t border-[#1f1f23]">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 mb-4 text-[#52525b]">
              <Shield size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">Privacy First</span>
            </div>
            <h2 className="text-xl md:text-2xl font-semibold mb-3">
              Built with respect for alumni privacy
            </h2>
            <p className="text-[#71717a] text-sm max-w-xl mx-auto">
              Our database is built from opt-in signups, public records, and alumni referrals. 
              All alumni have the ability to control their visibility and can opt out at any time.
            </p>
          </div>
        </section>

        {/* CTA Section */}
        <section className="px-6 md:px-12 py-20">
          <div className="max-w-3xl mx-auto bg-[#111113] border border-[#27272a] rounded-2xl p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold mb-3 tracking-tight">
              Ready to level up your network?
            </h2>
            <p className="text-[#71717a] mb-8 max-w-md mx-auto text-sm">
              Join hundreds of Cornell athletes already using Scout to land dream internships and jobs.
            </p>
            <Link
              href={user ? '/discover' : '/signup'}
              className="btn-primary inline-flex items-center gap-2"
            >
              {user ? 'Start Networking' : 'Create Free Account'}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-8 border-t border-[#1f1f23] text-center text-[#52525b] text-xs">
        <p>© 2024 Scout. Built for Cornell Athletes. Not affiliated with Cornell University.</p>
      </footer>
    </>
  )
}