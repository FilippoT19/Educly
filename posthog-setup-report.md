<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Educly. Here's what was done:

- **PostHog init** moved to `instrumentation-client.ts` (Next.js 15.3+ recommended pattern), running alongside Sentry. Captures exceptions and page views automatically.
- **Reverse proxy** added to `next.config.ts` via `/ingest` rewrites, routing PostHog traffic through the Next.js server to avoid ad-blockers.
- **PostHogProvider** simplified to a thin wrapper (init is now handled by `instrumentation-client.ts`).
- **`src/lib/posthog.ts`** refactored: removed manual init, added new typed helper functions for all new events.
- **`src/lib/posthog-server.ts`** created: singleton `posthog-node` client for server-side event capture.
- **`posthog-node`** installed as a new dependency.
- **User identification** added on signup (`identifyUser`) and login, correlating client-side sessions with server-side events.
- **9 new events** instrumented across 7 files (see table below).

| Event | Description | File |
|---|---|---|
| `user_logged_in` | User successfully logged in with email/password | `src/app/login/page.tsx` |
| `user_signed_up` | User created a new account (includes `course`, `year`) | `src/app/signup/page.tsx` |
| `guest_login` | User logged in as guest/demo account | `src/components/GuestButton.tsx` |
| `exercise_started` | User clicked "Inizia" to begin a practice session | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `hint_revealed` | User revealed hints during an exercise (caps score at 70) | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `exercise_browser_filtered` | User applied a difficulty or tag filter in the exercise browser | `src/app/(app)/course/[subject]/esercizi/[topicId]/ExerciseBrowser.tsx` |
| `exercise_solution_viewed` | User revealed the solution in the exercise browser | `src/app/(app)/course/[subject]/esercizi/[topicId]/ExerciseBrowser.tsx` |
| `exercise_corrected` | Server-side: answer evaluated (DB lookup or Claude fallback) | `src/app/api/exercise/correct/route.ts` |
| `exercise_saved` | Server-side: result saved and topic stats updated | `src/app/api/exercise/save/route.ts` |

Previously existing events (`exercise_loaded`, `answer_submitted`, `correction_result`, `recommendation_clicked`) were left intact.

## Next steps

We've built a dashboard and five insights to keep an eye on user behaviour:

- **Dashboard**: https://us.posthog.com/project/378710/dashboard/1457631

- **User Acquisition (Signups, Logins, Guest)** — https://us.posthog.com/project/378710/insights/80HGVeCS
- **Exercise Practice Funnel** — https://us.posthog.com/project/378710/insights/rqLvxRc4
- **Correct vs Incorrect Answers** — https://us.posthog.com/project/378710/insights/TJo6NeIV
- **Hint Usage vs Answers Submitted** — https://us.posthog.com/project/378710/insights/EppirGZ3
- **Exercises Completed vs Solutions Peeked** — https://us.posthog.com/project/378710/insights/VKqo0CT3

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
