import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  // Capture 100% of errors, 10% of performance traces (adjust after launch)
  tracesSampleRate: 0.1,
  // Don't send events in development
  enabled: process.env.NODE_ENV === "production",
});
