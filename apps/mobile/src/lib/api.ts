// Base URL for apps/web API routes. Set EXPO_PUBLIC_WEB_API_URL in your .env
// (e.g. https://yourapp.vercel.app) for production/staging builds.
export const WEB_API_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_API_URL ?? 'http://localhost:3000';
