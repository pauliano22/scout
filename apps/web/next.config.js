const { withSentryConfig } = require('@sentry/nextjs')

/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-XSS-Protection',          value: '1; mode=block' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://*.cornell.edu",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      'report-uri /api/csp-report',
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scout/shared'],
  experimental: {
    outputFileTracingIncludes: {
      '/api/map/data': ['./data/alumni-map.json'],
      '/api/alumni/[id]/circle': ['./data/alumni-map.json'],
      '/api/alumni/warm-paths': ['./data/alumni-map.json'],
    },
  },
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }]
  },
}

module.exports = withSentryConfig(nextConfig, {
  // Silently disable Sentry telemetry
  telemetry: false,
  // Upload source maps during build
  widenClientFileUpload: true,
  // Hides source maps from the client — server-side errors get them, client-side don't
  hideSourceMaps: true,
  // Disable server-side auto-instrumentation for now
  disableServerWebpackPlugin: false,
  disableClientWebpackPlugin: false,
  // Silence the release health check toast
  silent: true,
})
