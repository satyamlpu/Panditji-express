import { NextRequest, NextResponse } from "next/server";
import { backendUrl } from "@/lib/config";
import { COOKIE, extractRefresh } from "@/lib/session";

/**
 * Authenticated proxy to the FastAPI backend. Attaches the access token from the
 * httpOnly cookie; on a 401 it transparently refreshes (rotating the refresh
 * token), retries once, and updates the cookies on the response.
 */
async function forward(
  req: NextRequest,
  path: string[],
  access: string | undefined,
  body: ArrayBuffer | undefined,
): Promise<Response> {
  const url = backendUrl("/" + path.join("/")) + (req.nextUrl.search || "");
  const headers: Record<string, string> = {};
  // Preserve the exact content-type (incl. multipart boundary for uploads).
  const ct = req.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  if (access) headers["Authorization"] = `Bearer ${access}`;

  return fetch(url, { method: req.method.toUpperCase(), headers, body, redirect: "manual" });
}

async function refreshAccess(refresh: string | undefined) {
  if (!refresh) return null;
  const res = await fetch(backendUrl("/api/v1/auth/refresh"), {
    method: "POST",
    headers: { Cookie: `pje_refresh=${refresh}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.access_token) return null;
  return {
    access: data.access_token as string,
    refresh: extractRefresh(res.headers.getSetCookie?.() ?? []) ?? refresh,
  };
}

async function handle(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  let access = req.cookies.get(COOKIE.access)?.value;
  const refreshTok = req.cookies.get(COOKIE.refresh)?.value;

  // Read the body once as bytes so it can be replayed on the 401-retry and so
  // binary payloads (file uploads) are forwarded intact.
  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  let res = await forward(req, path, access, body);
  let rotated: { access: string; refresh: string } | null = null;

  if (res.status === 401 && refreshTok) {
    rotated = await refreshAccess(refreshTok);
    if (rotated) {
      access = rotated.access;
      res = await forward(req, path, access, body);
    }
  }

  const buf = await res.arrayBuffer();
  const out = new NextResponse(buf, {
    status: res.status,
    headers: {
      "Content-Type": res.headers.get("content-type") || "application/json",
    },
  });
  if (rotated) {
    const secure = process.env.NODE_ENV === "production";
    const base = { httpOnly: true, secure, sameSite: "lax" as const, path: "/" };
    out.cookies.set(COOKIE.access, rotated.access, { ...base, maxAge: 60 * 15 });
    out.cookies.set(COOKIE.refresh, rotated.refresh, {
      ...base,
      maxAge: 60 * 60 * 24 * 7,
    });
  }
  return out;
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
