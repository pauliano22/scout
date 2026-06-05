'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/Link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, Users, LogOut, User, ClipboardList, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@scout/shared/types/database'
import { isInCampaignHome } from '@scout/shared/featureFlags/campaignHome'
import ThemeToggle from './ThemeToggle'

interface NavbarProps {
  user?: { email: string; full_name?: string } | null
  networkCount?: number
  /** Optional — when omitted, Navbar fetches the role itself. */
  role?: UserRole | null
}

export default function Navbar({ user, networkCount = 0, role: roleProp }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [role, setRole] = useState<UserRole | null>(roleProp ?? null)
  const [campaignHome, setCampaignHome] = useState(false)

  useEffect(() => {
    if (roleProp !== undefined) setRole(roleProp)
    if (!user) return
    let cancelled = false
    ;(async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u || cancelled) return
      setCampaignHome(isInCampaignHome(u.id))
      if (roleProp === undefined) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('account_role')
          .eq('id', u.id)
          .single()
        if (!cancelled) setRole((profile?.account_role as UserRole | null) ?? 'student')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, roleProp])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  const navLink = (href: string, icon: React.ReactNode, label: string, count?: number) => (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive(href)
          ? 'bg-[--bg-tertiary] text-[--text-primary]'
          : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
      {count != null && count > 0 && (
        <span className="text-[--text-quaternary] text-xs tabular-nums">({count})</span>
      )}
    </Link>
  )

  const isAlumni = role === 'alumni'
  const showCampaignHome = campaignHome && role === 'student'
  const studentHome = showCampaignHome ? '/campaign' : '/plan'
  const homeHref = !user ? '/' : isAlumni ? '/profile' : studentHome

  return (
    <nav className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-[--border-primary] sticky top-0 z-50 bg-[--bg-primary]/95 backdrop-blur-sm">

      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <Link href={homeHref} className="flex items-center gap-2">
          <img src="/favicon.svg" alt="Scout" className="w-6 h-6" />
          <span className="logo-text hidden sm:block">Scout</span>
        </Link>
        <span className="hidden sm:block text-[--text-quaternary] text-xs font-medium tracking-widest">
          CORNELL
        </span>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-0.5">
        {user ? (
          <>
            {isAlumni ? (
              <>
                {/* Profile is the alumni's primary surface */}
                <Link
                  href="/profile"
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive('/profile')
                      ? 'bg-[--school-primary] text-white'
                      : 'text-[--school-primary] hover:bg-[--school-primary]/8'
                  }`}
                >
                  <User size={14} />
                  <span className="hidden sm:inline">Profile</span>
                </Link>
                {navLink('/discover', <Search size={14} />, 'Discover')}
                {navLink('/network', <Users size={14} />, 'Network', networkCount > 0 ? networkCount : undefined)}
              </>
            ) : (
              <>
                <Link
                  href={studentHome}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    isActive(studentHome)
                      ? 'bg-[--school-primary] text-white'
                      : 'text-[--school-primary] hover:bg-[--school-primary]/8'
                  }`}
                >
                  {showCampaignHome ? <Home size={14} /> : <ClipboardList size={14} />}
                  <span className="hidden sm:inline">{showCampaignHome ? 'Home' : 'Plan'}</span>
                </Link>

                {navLink('/discover', <Search size={14} />, 'Discover')}
                {navLink('/network',  <Users  size={14} />, 'Network', networkCount > 0 ? networkCount : undefined)}
              </>
            )}

            <div className="w-px h-4 bg-[--border-primary] mx-1 hidden sm:block" />

            <ThemeToggle />

            {!isAlumni && (
              <Link href="/profile" className="btn-ghost p-2" title="Profile">
                <User size={14} />
              </Link>
            )}
            <button onClick={handleSignOut} className="btn-ghost p-2 hover:text-red-400" title="Sign Out">
              <LogOut size={14} />
            </button>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link href="/login"  className="btn-ghost text-sm">Log In</Link>
            <Link href="/signup" className="btn-primary text-sm">Sign Up</Link>
          </>
        )}
      </div>
    </nav>
  )
}
