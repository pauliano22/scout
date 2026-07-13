'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  Users,
  Flag,
  Activity,
  ShieldCheck,
  BarChart3,
  ArrowLeft,
  Loader2,
  ToggleLeft,
  UserCheck,
  UserX,
  GraduationCap,
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/data', label: 'Data', icon: BarChart3 },
  { href: '/admin/ad-report', label: 'AD Report', icon: GraduationCap },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/claims', label: 'Claims', icon: UserCheck },
  { href: '/admin/removals', label: 'Removals', icon: UserX },
  { href: '/admin/verification', label: 'Verification', icon: ShieldCheck },
  { href: '/admin/reports', label: 'Reports', icon: Flag },
  { href: '/admin/activity', label: 'Activity', icon: Activity },
  { href: '/admin/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.ok) {
          setIsAuthorized(true)
        } else if (res.status === 401 || res.status === 403) {
          router.push('/login')
        } else {
          setIsAuthorized(false)
        }
      } catch {
        setIsAuthorized(false)
      }
    }
    checkAuth()
  }, [router])

  if (isAuthorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg-primary]">
        <Loader2 size={32} className="animate-spin text-[--text-tertiary]" />
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[--bg-primary]">
        <div className="text-center">
          <p className="text-[--text-secondary] mb-4">You don&apos;t have access to this area.</p>
          <Link href="/" className="btn-primary">
            <ArrowLeft size={16} className="mr-2" />
            Back to Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[--bg-primary] flex">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 border-r border-[--border-primary] bg-[--bg-secondary] hidden md:flex flex-col">
        <div className="p-4 border-b border-[--border-primary]">
          <Link href="/admin" className="flex items-center gap-2">
            <img src="/favicon.svg" alt="Scout" className="w-5 h-5" />
            <span className="text-sm font-semibold">Admin</span>
          </Link>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname?.startsWith(item.href) ?? false
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-[--bg-active] text-[--text-primary] font-medium'
                    : 'text-[--text-secondary] hover:bg-[--bg-hover] hover:text-[--text-primary]'
                }`}
              >
                <Icon size={16} />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="p-3 border-t border-[--border-primary]">
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-[--text-tertiary] hover:text-[--text-secondary] hover:bg-[--bg-hover] transition-colors"
          >
            <ArrowLeft size={14} />
            Back to App
          </Link>
        </div>
      </aside>

      {/* Mobile nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[--bg-secondary] border-t border-[--border-primary] flex">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                isActive
                  ? 'text-[--school-primary]'
                  : 'text-[--text-tertiary]'
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
