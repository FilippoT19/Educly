"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initPostHog } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    initPostHog();
  }, []);

  // Track client-side navigations
  useEffect(() => {
    if (typeof window === "undefined") return;
    // posthog.capture_pageview is on, so page changes are tracked automatically
    // Nothing extra needed here — just keeping the hook for future custom page props
    void pathname;
  }, [pathname]);

  return <>{children}</>;
}
