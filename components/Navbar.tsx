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

  const isActive = (path: string) => pathname === path

  return (
    <nav className="flex justify-between items-center px-4 md:px-6 py-3 border-b border-[#27272a] sticky top-0 z-50 bg-[#0a0a0b]">
      {/* Logo & School Selector */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="logo-mark">
            <span>S</span>
          </div>
          <span className="logo-text hidden sm:block">scout</span>
        </Link>
        
        {/* School Badge/Selector */}
        <div className="relative">
          <button 
            onClick={() => setShowSchoolDropdown(!showSchoolDropdown)}
            className="flex items-center gap-1.5 text-xs px-2.5 py-1 bg-[#18181b] border border-[#27272a] rounded-md text-[#a1a1aa] font-medium hover:bg-[#1f1f23] transition-colors"
          >
            CORNELL
            <ChevronDown size={12} className={`transition-transform ${showSchoolDropdown ? 'rotate-180' : ''}`} />
          </button>
          
          {showSchoolDropdown && (
            <div className="absolute top-full mt-1 left-0 bg-[#111113] border border-[#27272a] rounded-lg shadow-lg overflow-hidden min-w-[160px] animate-fade-in">
              <div className="p-1">
                <button className="w-full text-left px-3 py-2 rounded-md bg-[#18181b] text-[#fafafa] text-sm font-medium">
                  Cornell University
                </button>
                <div className="px-3 py-2 text-[#52525b] text-xs">
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
                  ? 'bg-[#18181b] text-[#fafafa]' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
              }`}
            >
              <Search size={16} />
              <span className="hidden sm:inline">Discover</span>
            </Link>
            
            <Link 
              href="/network" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/network') 
                  ? 'bg-[#18181b] text-[#fafafa]' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
              }`}
            >
              <Users size={16} />
              <span className="hidden sm:inline">Network</span>
              {networkCount > 0 && (
                <span className="bg-[#27272a] px-1.5 py-0.5 rounded text-xs text-[#a1a1aa]">
                  {networkCount}
                </span>
              )}
            </Link>

            <Link 
              href="/career-path" 
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive('/career-path') 
                  ? 'bg-[#18181b] text-[#fafafa]' 
                  : 'text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b]'
              }`}
            >
              <Trophy size={16} />
              <span className="hidden sm:inline">Career Path</span>
              {currentStreak > 0 && (
                <span className="flex items-center gap-1 bg-[#27272a] text-amber-500 px-1.5 py-0.5 rounded text-xs">
                  <Flame size={10} />
                  {currentStreak}
                </span>
              )}
            </Link>

            <div className="w-px h-5 bg-[#27272a] mx-2 hidden sm:block" />

            <Link
              href="/profile"
              className="p-2 rounded-md text-[#a1a1aa] hover:text-[#fafafa] hover:bg-[#18181b] transition-colors"
              title="Profile"
            >
              <User size={16} />
            </Link>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-md text-[#a1a1aa] hover:text-red-500 hover:bg-[#18181b] transition-colors"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
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