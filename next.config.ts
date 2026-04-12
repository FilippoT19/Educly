import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Suppress Sentry CLI output during builds
  silent: !process.env.CI,
  // Upload source maps only in CI/production builds
  sourcemaps: {
    disable: process.env.NODE_ENV !== "production",
  },
  // Tree-shake unused Sentry code from client bundle
  disableLogger: true,
  automaticVercelMonitors: false,
});
