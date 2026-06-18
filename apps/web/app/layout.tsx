import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import PostHogProvider from '@/components/PostHogProvider'
import './globals.css'

// Render every route on demand instead of prerendering at build time. The
// marketing/auth pages ('/', '/about', '/login', …) are Client Components that
// build a Supabase browser client during render; static prerendering ran that
// at build time and crashed the deploy whenever the Supabase env vars weren't
// injected into the build. Forcing dynamic rendering keeps Supabase off the
// build step. The app is almost entirely dynamic already, so the cost is nil.
export const dynamic = 'force-dynamic'

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'Scout | Cornell',
  description: 'Connect with Cornell athlete alumni in your target industry',
  icons: {
    icon: '/favicon.svg',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                function getTheme() {
                  const stored = localStorage.getItem('theme');
                  if (stored) return stored;
                  // Default to light mode
                  return 'light';
                }
                document.documentElement.setAttribute('data-theme', getTheme());
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen">
        <PostHogProvider>
          {children}
        </PostHogProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}