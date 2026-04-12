import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://a42616847c6bd87062171adbfa4d1a71@o4511205977423872.ingest.de.sentry.io/4511205982273616",
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === "production",
});
