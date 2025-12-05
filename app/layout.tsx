import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Scout | Cornell Athlete Alumni Network',
  description: 'Connect with Cornell athlete alumni in your target industry',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0b] text-[#fafafa]">
        {children}
      </body>
    </html>
  )
}