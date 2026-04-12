<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of your project. Eight new events were instrumented across six files — four client-side events that were defined in `posthog.ts` but never called, two new auth failure events, and two server-side events covering exercise generation failures and rate limit hits. The PostHog initialization in `instrumentation-client.ts` and the server-side client in `posthog-server.ts` were already in place and required no changes. Environment variables were verified and updated in `.env.local`.

| Event | Description | File |
|---|---|---|
| `exercise_loaded` | Fired when an exercise loads successfully (from DB or Claude), with subject, topicId, difficulty, and fromDb properties | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `answer_submitted` | Fired when a student submits their answer, before correction begins | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `correction_result` | Fired after correction completes, capturing isCorrect and score | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `recommendation_clicked` | Fired when a student clicks a recommended exercise card after finishing | `src/app/practice/[subject]/[topicId]/PracticeSession.tsx` |
| `login_failed` | Fired when a login attempt fails due to wrong credentials | `src/app/login/page.tsx` |
| `signup_failed` | Fired when signup fails (auth error or profile creation error), with reason property | `src/app/signup/page.tsx` |
| `exercise_generation_failed` | Server-side: fired when Claude fails to generate an exercise | `src/app/api/exercise/generate/route.ts` |
| `rate_limit_hit` | Server-side: fired when a user hits the correction rate limit (30/hour) | `src/app/api/exercise/correct/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard** — [Analytics basics](https://eu.posthog.com/project/157682/dashboard/616528)
- **Signup → Exercise Funnel** — [Conversion funnel from signup through exercise completion](https://eu.posthog.com/project/157682/insights/8eRy3zSt)
- **Daily Active Learners** — [DAU trend for exercise_started and answer_submitted](https://eu.posthog.com/project/157682/insights/jjtLqx7M)
- **Auth Funnel: Signups vs Logins vs Failures** — [Track new signups, logins, and failed login attempts](https://eu.posthog.com/project/157682/insights/ihEoOsK4)
- **Hint & Solution Usage** — [hint_revealed, exercise_solution_viewed, recommendation_clicked over time](https://eu.posthog.com/project/157682/insights/aGLlnxVE)
- **Exercise Accuracy Rate** — [correction_result and exercise_corrected broken down by subject](https://eu.posthog.com/project/157682/insights/kYQHcuqw)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
