/** Server-side configuration. BACKEND_URL and REVALIDATE_SECRET are never sent
 * to the browser; SITE_URL is public (NEXT_PUBLIC_). */

export const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8099";

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const REVALIDATE_SECRET =
  process.env.REVALIDATE_SECRET || "change-me-revalidate-secret";

export function backendUrl(path: string): string {
  return BACKEND_URL + (path.startsWith("/") ? path : "/" + path);
}
