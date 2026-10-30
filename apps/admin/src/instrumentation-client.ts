import * as Sentry from "@sentry/nextjs";

// Browser errors to Sentry (TODO.md Now #9); off until NEXT_PUBLIC_SENTRY_DSN is set. No PostHog
// here: one admin user, nothing to analyse. Server side: instrumentation.ts.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0, // errors only
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
