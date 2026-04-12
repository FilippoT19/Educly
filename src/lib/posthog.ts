// PostHog event tracking — import and call these anywhere client-side

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
  if (!key) return;
  posthog.init(key, {
    api_host: host,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    // Don't send in development
    loaded: (ph) => {
      if (process.env.NODE_ENV !== "production") ph.opt_out_capturing();
    },
  });
  initialized = true;
}

export function identifyUser(userId: string, email?: string) {
  posthog.identify(userId, { email });
}

export function resetUser() {
  posthog.reset();
}

// ── Key product events ────────────────────────────────────────────────────────

export function trackExerciseLoaded(props: {
  subject: string;
  topicId: string;
  difficulty: number;
  fromDb: boolean;
}) {
  posthog.capture("exercise_loaded", props);
}

export function trackAnswerSubmitted(props: {
  subject: string;
  topicId: string;
  exerciseId?: string;
}) {
  posthog.capture("answer_submitted", props);
}

export function trackCorrectionResult(props: {
  subject: string;
  topicId: string;
  isCorrect: boolean;
  score: number;
  usedDb: boolean; // true = no Claude call
}) {
  posthog.capture("correction_result", props);
}

export function trackRecommendationClicked(props: {
  exerciseId: string;
  isTop: boolean;
}) {
  posthog.capture("recommendation_clicked", props);
}
