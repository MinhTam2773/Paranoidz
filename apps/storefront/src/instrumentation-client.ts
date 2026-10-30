import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

// Error tracking (Sentry) + product analytics (PostHog), TODO.md Now #9. Each stays off until its
// key is set in Vercel: NEXT_PUBLIC_SENTRY_DSN, NEXT_PUBLIC_POSTHOG_KEY (NEXT_PUBLIC_POSTHOG_HOST
// for an EU project). Server side: instrumentation.ts.
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
  tracesSampleRate: 0, // errors only: performance tracing would use up the free quota
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    defaults: "2025-05-24", // pageview on every client-side navigation too
    person_profiles: "identified_only",
    // Off until the privacy policy mentions it (TODO.md Now #9).
    disable_session_recording: true,
  });
}
