/** Cookie names and the backend contract for the admin BFF session.
 *
 * The browser never holds a JWT. The BFF (Next.js route handlers) exchanges
 * credentials with the FastAPI backend and keeps the tokens in this origin's
 * httpOnly cookies; every admin data call is proxied through /api/backend/*.
 */

export const COOKIE = {
  access: "pje_access",
  refresh: "pje_refresh",
} as const;

/** The httpOnly refresh cookie the FastAPI backend sets. */
export const BACKEND_REFRESH_COOKIE = "pje_refresh";

/** Pull the rotated refresh token out of a backend Set-Cookie header list. */
export function extractRefresh(setCookies: string[]): string | null {
  for (const c of setCookies) {
    if (c.startsWith(BACKEND_REFRESH_COOKIE + "=")) {
      const val = c.slice((BACKEND_REFRESH_COOKIE + "=").length).split(";")[0];
      return val || null;
    }
  }
  return null;
}
