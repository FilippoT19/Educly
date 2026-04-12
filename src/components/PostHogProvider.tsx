"use client";

// PostHog is initialized in instrumentation-client.ts (Next.js 15.3+ pattern).
// This component is kept as a thin wrapper for layout compatibility.

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
