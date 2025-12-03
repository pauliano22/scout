'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Users, LogOut, User, Flame, Trophy, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface NavbarProps {
  user?: {
    email: string
    full_name?: string
  } | null
  networkCount?: number
  currentStreak?: number
}

export default function Navbar({ user, networkCount = 0, currentStreak = 0 }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const navLinkClass = (path: string) => `
    flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200
    ${pathname === path
      ? 'bg-gradient-to-r from-[var(--school-primary)] to-[var(--school-primary-light)] shadow-lg'
      : 'bg-white/5 hover:bg-white/10'
    }
  `

  return (
    <nav className="flex justify-between items-center px-4 md:px-10 py-4 border-b border-white/[0.08] backdrop-blur-xl sticky top-0 z-50 bg-[#0f0f0f]/80">
      {/* Logo & School Selector */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-br from-[var(--school-primary)] to-[var(--school-primary-light)] rounded-xl flex items-center justify-center text-lg font-bold font-display shadow-lg">
            S
          </div>
          <span className="text-xl font-bold font-display tracking-tight hidden sm:block">Scout</span>
        </Link>
        
        {/* School Badge/Selector */}
        <div className="relative">
          <button 
            onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
            className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 bg-[var(--school-primary)]/20 border border-[var(--school-primary)]/40 rounded-full text-[var(--school-primary-light)] font-semibold hover:bg-[var(--school-primary)]/30 transition-all"
          >
            CORNELL
            <ChevronDown size={12} className={`transition-transform ${showSchoolDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {/* Dropdown - for future multi-school */}
          {showSchoolDropdown && (
            <div className="absolute top-full mt-2 left-0 bg-gray-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[180px] animate-fade-in-scale">
              <div className="p-2">
                <button className="w-full text-left px-3 py-2 rounded-lg bg-[var(--school-primary)]/20 text-[var(--school-primary-light)] text-sm font-medium">
                  Cornell University
                </button>
                <div className="px-3 py-2 text-white/30 text-xs">
                  More schools coming soon...
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-2">
        {user ? (
          <>
            <Link href="/discover" className={navLinkClass('/discover')}>
              <Search size={16} />
              <span className="hidden sm:inline">Discover</span>
            </Link>
            
            <Link href="/network" className={navLinkClass('/network')}>
              <Users size={16} />
              <span className="hidden sm:inline">Network</span>
              {networkCount > 0 && (
                <span className="bg-white/20 px-1.5 py-0.5 rounded-md text-xs">
                  {networkCount}
                </span>
              )}
            </Link>

            <Link href="/career-path" className={navLinkClass('/career-path')}>
              <Trophy size={16} />
              <span className="hidden sm:inline">Career Path</span>
              {currentStreak > 0 && (
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-md text-xs">
                  <Flame size={10} />
                  {currentStreak}
                </span>
              )}
            </Link>

            <div className="w-px h-6 bg-white/10 mx-1 hidden sm:block" />

            <Link
              href="/profile"
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all"
              title="Profile"
            >
              <User size={18} />
            </Link>

            <button
              onClick={handleSignOut}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-white/5 hover:bg-white/10 transition-all"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-[var(--school-primary)] to-[var(--school-primary-light)] shadow-lg transition-all hover:shadow-xl"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
