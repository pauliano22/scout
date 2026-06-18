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
]

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@scout/shared'],
  experimental: {
    // Ship the pre-baked alumni map dataset with the serverless bundle
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

module.exports = nextConfig
