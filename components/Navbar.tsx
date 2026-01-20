'use client'

import Link from '@/components/Link'
import { usePathname } from 'next/navigation'
import { Search, Users, LogOut, User, ChevronDown, Info, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'

interface NavbarProps {
  user?: {
    email: string
    full_name?: string
  } | null
  networkCount?: number
  currentStreak?: number
}

export default function Navbar({ user, networkCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [showSchoolDropdown, setShowSchoolDropdown] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (path: string) => pathname === path

  return (
    <nav className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-[--border-primary] sticky top-0 z-50 bg-[--bg-primary]">
      {/* Logo & School Selector */}
      <div className="flex items-center gap-3">
        <Link href={user ? "/coach" : "/"} className="flex items-center gap-2 group">
          <img src="/favicon.svg" alt="Scout" className="w-8 h-8" />
        </Link>
        
        {/* School Badge/Selector */}
        <div className="relative">
          <button 
            onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[--bg-tertiary] border border-[--border-primary] rounded-md text-[--text-secondary] font-medium hover:bg-[--bg-hover] transition-colors"
          >
            CORNELL
            <ChevronDown size={12} className={`transition-transform ${showSchoolDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showSchoolDropdown && (
            <div className="absolute top-full mt-1 left-0 bg-[--bg-secondary] border border-[--border-primary] rounded-lg shadow-lg overflow-hidden min-w-[160px] animate-fade-in">
              <div className="p-1">
                <button className="w-full text-left px-3 py-2 rounded-md bg-[--bg-tertiary] text-[--text-primary] text-sm font-medium">
                  Cornell University
                </button>
                <div className="px-3 py-2 text-[--text-quaternary] text-xs">
                  More schools coming soon
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex items-center gap-1">
        {user ? (
          <>
            <Link 
              href="/discover" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/discover') 
                  ? 'bg-[--bg-tertiary] text-[--text-primary]' 
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
              }`}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Alumni</span>
            </Link>
            
            <Link 
              href="/network" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/network') 
                  ? 'bg-[--bg-tertiary] text-[--text-primary]' 
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
              }`}
            >
              <Users size={16} />
              <span className="hidden sm:inline">Network</span>
              {networkCount > 0 && (
                <span className="bg-[--bg-active] px-1.5 py-0.5 rounded text-xs text-[--text-secondary]">
                  {networkCount}
                </span>
              )}
            </Link>

            <Link 
              href="/coach" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/coach') 
                  ? 'bg-[--bg-tertiary] text-[--text-primary]' 
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
              }`}
            >
              <Sparkles size={16} />
              <span className="hidden sm:inline">Coach</span>
            </Link>

            <Link 
              href="/about" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about') 
                  ? 'bg-[--bg-tertiary] text-[--text-primary]' 
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
              }`}
            >
              <Info size={16} />
              <span className="hidden sm:inline">About</span>
            </Link>

            <div className="w-px h-5 bg-[--border-primary] mx-2 hidden sm:block" />

            <ThemeToggle />

            <Link
              href="/profile"
              className="btn-ghost p-2"
              title="Profile"
            >
              <User size={16} />
            </Link>

            <button
              onClick={handleSignOut}
              className="btn-ghost p-2 hover:text-red-500"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <Link 
              href="/about" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/about') 
                  ? 'bg-[--bg-tertiary] text-[--text-primary]' 
                  : 'text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-tertiary]'
              }`}
            >
              About
            </Link>
            <ThemeToggle />
            <Link
              href="/login"
              className="btn-ghost"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="btn-primary"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}