// Sentry server-side init. No-op unless SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN)
// is set, so dev, CI and unconfigured deploys never reach the network.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
