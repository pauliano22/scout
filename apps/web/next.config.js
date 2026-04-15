/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ignoreDuringBuilds: true,
  transpilePackages: ['@scout/shared'],
}

module.exports = nextConfig
