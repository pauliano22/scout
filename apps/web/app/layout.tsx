import type { Metadata } from 'next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Analytics } from '@vercel/analytics/next'
import PostHogProvider from '@/components/PostHogProvider'
import './globals.css'

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
    <html lang="en" suppressHydrationWarning>
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