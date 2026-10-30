import * as Sentry from "@sentry/nextjs";

// Server + edge errors to Sentry (TODO.md Now #9); off until NEXT_PUBLIC_SENTRY_DSN is set.
// Browser side: instrumentation-client.ts.
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment: process.env.VERCEL_ENV ?? "development",
    tracesSampleRate: 0,
  });
}

// Errors thrown while rendering server components, route handlers and server actions.
export const onRequestError = Sentry.captureRequestError;
