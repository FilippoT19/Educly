import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";

Sentry.init({
  dsn: "https://a42616847c6bd87062171adbfa4d1a71@o4511205977423872.ingest.de.sentry.io/4511205982273616",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  defaults: "2026-01-30",
  person_profiles: "identified_only",
  capture_pageview: true,
  capture_pageleave: true,
  capture_exceptions: true,
  debug: process.env.NODE_ENV === "development",
});
