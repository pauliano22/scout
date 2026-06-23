// This file configures the initialization of Sentry on the client side.
// The config you add here will be used whenever a page is visited or a client-side action occurs.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV || 'development',
  // Replay captures user interactions and page views for debugging
  // Adjust this sample rate based on your business needs
  tracesSampleRate: 0.2,
  // This sets the sample rate to record session replays
  // replaysSessionSampleRate: 0.1,
  // This sets the sample rate to record replays on error
  // replaysOnErrorSampleRate: 1.0,
})
