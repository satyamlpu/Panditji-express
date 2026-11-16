import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Security headers on every page response. The FastAPI backend sets its own
// headers for API responses.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    // Admin-uploaded images are served by the backend (/uploads/*). Allow the
    // local backend in dev and any https host in production (CMS-driven media).
    remotePatterns: [
      { protocol: "http", hostname: "localhost" },
      { protocol: "http", hostname: "127.0.0.1" },
      { protocol: "https", hostname: "**" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

// Wrap with Sentry. Runtime error capture is gated on the DSN env var (see the
// sentry.*.config.ts files); build-time source-map upload is skipped unless
// SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN are also set, so builds work
// unconfigured.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  disableLogger: true,
});
