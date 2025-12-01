'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Users, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  user?: {
    email: string
    full_name?: string
  } | null
  networkCount?: number
}

export default function Navbar({ user, networkCount = 0 }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="flex justify-between items-center px-6 md:px-12 py-5 border-b border-white/[0.08] backdrop-blur-xl sticky top-0 z-50 bg-[#0f0f0f]/80">
      <Link href="/" className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-cornell-red to-cornell-red-light rounded-xl flex items-center justify-center text-xl font-bold font-display">
          S
        </div>
        <span className="text-2xl font-bold font-display tracking-tight">Scout</span>
        <span className="text-[11px] px-2.5 py-1 bg-cornell-red/20 border border-cornell-red/40 rounded-full text-cornell-red-light font-semibold ml-1">
          CORNELL
        </span>
      </Link>

      <div className="flex items-center gap-3">
        {user ? (
          <>
            <Link
              href="/discover"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                pathname === '/discover'
                  ? 'bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/40'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Search size={16} />
              Discover
            </Link>
            
            <Link
              href="/network"
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                pathname === '/network'
                  ? 'bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/40'
                  : 'bg-white/5 hover:bg-white/10'
              }`}
            >
              <Users size={16} />
              My Network
              {networkCount > 0 && (
                <span className="ml-1 bg-white/20 px-2 py-0.5 rounded-lg text-xs">
                  {networkCount}
                </span>
              )}
            </Link>

            <div className="w-px h-6 bg-white/10 mx-2" />

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
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-white/5 hover:bg-white/10 transition-all"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-cornell-red to-cornell-red-light shadow-lg shadow-cornell-red/40 transition-all hover:shadow-cornell-red/60"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
