// PostHog event tracking — import and call these anywhere client-side.
// PostHog is initialized in instrumentation-client.ts.

import posthog from "posthog-js";

export function identifyUser(userId: string, email?: string) {
  posthog.identify(userId, { email });
}

export function resetUser() {
  posthog.reset();
}

// ── Auth events ───────────────────────────────────────────────────────────────

export function trackUserLoggedIn(props: { email: string }) {
  posthog.capture("user_logged_in", props);
}

export function trackUserSignedUp(props: { email: string; course: string; year: number }) {
  posthog.capture("user_signed_up", props);
}

export function trackGuestLogin() {
  posthog.capture("guest_login");
}

// ── Exercise practice events ──────────────────────────────────────────────────

export function trackExerciseLoaded(props: {
  subject: string;
  topicId: string;
  difficulty: number;
  fromDb: boolean;
}) {
  posthog.capture("exercise_loaded", props);
}

export function trackExerciseStarted(props: { subject: string; topicId: string }) {
  posthog.capture("exercise_started", props);
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

export function trackHintRevealed(props: { subject: string; topicId: string }) {
  posthog.capture("hint_revealed", props);
}

export function trackRecommendationClicked(props: {
  exerciseId: string;
  isTop: boolean;
}) {
  posthog.capture("recommendation_clicked", props);
}

// ── Exercise browser events ───────────────────────────────────────────────────

export function trackExerciseBrowserFiltered(props: {
  subject: string;
  categoryId: string;
  filterType: "difficulty" | "tag";
  filterValue: string;
}) {
  posthog.capture("exercise_browser_filtered", props);
}

export function trackExerciseSolutionViewed(props: {
  subject: string;
  exerciseId: string;
  difficulty: number;
}) {
  posthog.capture("exercise_solution_viewed", props);
}
