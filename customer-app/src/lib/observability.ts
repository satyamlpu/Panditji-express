import * as Sentry from "@sentry/react-native";

// Crash / error monitoring. No-op unless EXPO_PUBLIC_SENTRY_DSN is set, so local
// dev and unconfigured builds never phone home. PII is not sent, and tracing is
// off by default (error capture only). Importing this module runs init once.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? "development",
  });
}
